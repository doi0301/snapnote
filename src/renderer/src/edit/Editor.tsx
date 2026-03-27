import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef
} from 'react'
import type { EditorLine as EditorLineModel, HighlightColor, Memo } from '@shared/types'
import { useAutoSave } from '@renderer/hooks/useAutoSave'
import { EditorLineView } from './EditorLine'
import { ClipboardHistoryControl } from './ClipboardPanel'
import { FormatToolbar } from './FormatToolbar'
import { TagInput } from './TagInput'
import { MAX_INDENT, normalizeEditorLines } from './editorLines'
import {
  addBoldOnRange,
  caretReferenceCharIndex,
  insertionIndexIfSingleChar,
  rangeFullyHasAnyHighlight,
  rangeFullyHasProp,
  remapSpansAfterEdit,
  shiftSpans,
  splitSpansAt,
  toggleHighlightColor,
  toggleSpanProperty
} from './spanFormat'
import { findEditorTextareaUnderPoint, getCaretOffsetFromPointInTextarea } from './editorCaretFromPoint'
import { IconToolbarHistory } from './toolbarIcons'
import './editor.css'

export { normalizeEditorLines } from './editorLines'

export interface EditorHandle {
  appendTextFromClipboard: (text: string) => void
}

interface EditorProps {
  memo: Memo
  onMemoUpdated: (m: Memo) => void
  /** 타이틀바 미리보기 등 — 없으면 호출 생략 */
  onHeadLineChange?: (firstLine: string) => void
  tagRaw: string
  onTagRawChange: (raw: string) => void
  tagSuggestions: string[]
}

interface MultiLineSelection {
  anchorLine: number
  anchorOffset: number
  focusLine: number
  focusOffset: number
}

interface EditorSnapshot {
  lines: EditorLineModel[]
  focusIndex: number
  cursor: number
}

function multiLineSelectionEqual(a: MultiLineSelection | null, b: MultiLineSelection): boolean {
  if (!a) return false
  return (
    a.anchorLine === b.anchorLine &&
    a.anchorOffset === b.anchorOffset &&
    a.focusLine === b.focusLine &&
    a.focusOffset === b.focusOffset
  )
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { memo, onMemoUpdated, onHeadLineChange, tagRaw, onTagRawChange, tagSuggestions },
  imperativeRef
) {
  const [lines, setLines] = useState<EditorLineModel[]>(() => normalizeEditorLines(memo.content))
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([])
  const lastFocusIndex = useRef(0)
  /** Enter·줄 병합·삽입 직후 DOM 반영 뒤 포커스 복구 (리마운트/배치 타이밍 이슈 방지) */
  const pendingFocusRef = useRef<{ index: number; cursor: number } | null>(null)
  const [focusLineIndex, setFocusLineIndex] = useState(0)
  const pendingBoldLineIdsRef = useRef<Set<string>>(new Set())
  const [toolbarTick, setToolbarTick] = useState(0)
  const [lastHighlightColor, setLastHighlightColor] = useState<HighlightColor>('yellow')
  const [emojiPaletteOpen, setEmojiPaletteOpen] = useState(false)
  const [selectionTick, setSelectionTick] = useState(0)
  const [compactToolbarActions, setCompactToolbarActions] = useState(false)
  const [multiLineSelection, setMultiLineSelection] = useState<MultiLineSelection | null>(null)
  const multiLineSelectionRef = useRef<MultiLineSelection | null>(null)
  multiLineSelectionRef.current = multiLineSelection
  const selectionAnchorRef = useRef<{ line: number; anchorOffset: number } | null>(null)
  const suppressNextFocusSelectionClearRef = useRef(false)
  /** document 포인터 리스너 정리용 — 새 드래그 시작·언마운트 시 이전 세션 종료 */
  const endSelectionDragRef = useRef<(() => void) | null>(null)
  const draggingSelectionRef = useRef(false)
  const toolbarStackRef = useRef<HTMLDivElement | null>(null)
  const undoStackRef = useRef<EditorSnapshot[]>([])
  const redoStackRef = useRef<EditorSnapshot[]>([])

  const cloneLines = useCallback((src: EditorLineModel[]): EditorLineModel[] => {
    return src.map((line) => ({
      ...line,
      formatting: { ...(line.formatting ?? {}) },
      spans: line.spans ? line.spans.map((s) => ({ ...s })) : undefined
    }))
  }, [])

  const pushUndoSnapshot = useCallback(
    (srcLines: EditorLineModel[], focusIndex: number, cursor: number) => {
      const next: EditorSnapshot = {
        lines: cloneLines(srcLines),
        focusIndex,
        cursor
      }
      undoStackRef.current.push(next)
      if (undoStackRef.current.length > 50) undoStackRef.current.shift()
      redoStackRef.current = []
    },
    [cloneLines]
  )

  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setLines(cloneLines(snapshot.lines))
    setMultiLineSelection(null)
    pendingFocusRef.current = {
      index: Math.max(0, Math.min(snapshot.focusIndex, snapshot.lines.length - 1)),
      cursor: Math.max(0, snapshot.cursor)
    }
  }, [cloneLines])

  useEffect(() => {
    return () => {
      endSelectionDragRef.current?.()
      endSelectionDragRef.current = null
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const onSel = (): void => {
      /** 가상 다중 줄 드래그 중 setSelectionRange 동기화가 매 프레임 selectionchange 를 쏘아 툴바·전체 줄이 흔들린다 */
      if (draggingSelectionRef.current) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setSelectionTick((t) => t + 1))
    }
    document.addEventListener('selectionchange', onSel)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('selectionchange', onSel)
    }
  }, [])

  useLayoutEffect(() => {
    const root = toolbarStackRef.current
    if (!root) return
    const update = (): void => {
      const w = root.getBoundingClientRect().width
      setCompactToolbarActions(w < 360)
    }
    update()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (ro) ro.observe(root)
    window.addEventListener('resize', update)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    const onUp = (): void => {
      draggingSelectionRef.current = false
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  useEffect(() => {
    setLines(normalizeEditorLines(memo.content))
  }, [memo.id])

  useEffect(() => {
    onHeadLineChange?.(lines[0]?.text ?? '')
  }, [lines, onHeadLineChange])

  const save = useCallback(async () => {
    const updated = await window.snapnote.memo.update({
      id: memo.id,
      patch: { content: lines }
    })
    onMemoUpdated(updated)
  }, [memo.id, lines, onMemoUpdated])

  useAutoSave(save, [lines, memo.id])

  const resizeTextareas = useCallback(() => {
    textareaRefs.current.forEach((el) => {
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${Math.max(28, el.scrollHeight)}px`
    })
  }, [])

  useLayoutEffect(() => {
    resizeTextareas()
  }, [lines, resizeTextareas])

  useLayoutEffect(() => {
    const p = pendingFocusRef.current
    if (!p) return
    pendingFocusRef.current = null
    const el = textareaRefs.current[p.index]
    if (!el) return
    el.focus()
    el.setSelectionRange(p.cursor, p.cursor)
    lastFocusIndex.current = p.index
    setFocusLineIndex(p.index)
  }, [lines])

  const toolbarToggleUi = useMemo(() => {
    const idx = Math.min(focusLineIndex, Math.max(0, lines.length - 1))
    const line = lines[idx]
    const ta = textareaRefs.current[idx]
    const pendingBold = Boolean(line && pendingBoldLineIdsRef.current.has(line.id))
    const lineCheckboxActive = Boolean(line?.formatting?.hasCheckbox)
    const lineDividerActive = Boolean(line?.formatting?.hasDivider)

    if (!line || !ta) {
      return {
        boldActive: pendingBold,
        strikeActive: false,
        highlightActive: false,
        lineCheckboxActive,
        lineDividerActive
      }
    }

    const s = ta.selectionStart
    const e = ta.selectionEnd
    const sp = line.spans ?? []
    const len = line.text.length

    if (s === e) {
      const ref = caretReferenceCharIndex(s, len)
      const boldAtCaret = ref === null ? false : rangeFullyHasProp(sp, ref, ref + 1, 'bold')
      const strikeAtCaret = ref === null ? false : rangeFullyHasProp(sp, ref, ref + 1, 'strikethrough')
      const hlAtCaret = ref === null ? false : rangeFullyHasAnyHighlight(sp, ref, ref + 1)
      return {
        boldActive: pendingBold || boldAtCaret,
        strikeActive: strikeAtCaret,
        highlightActive: hlAtCaret,
        lineCheckboxActive,
        lineDividerActive
      }
    }

    return {
      boldActive: pendingBold || rangeFullyHasProp(sp, s, e, 'bold'),
      strikeActive: rangeFullyHasProp(sp, s, e, 'strikethrough'),
      highlightActive: rangeFullyHasAnyHighlight(sp, s, e),
      lineCheckboxActive,
      lineDividerActive
    }
  }, [lines, focusLineIndex, selectionTick, toolbarTick])

  const bumpToolbar = useCallback(() => {
    setToolbarTick((t) => t + 1)
  }, [])

  const normalizeSelection = useCallback((sel: MultiLineSelection) => {
    const startBeforeEnd =
      sel.anchorLine < sel.focusLine ||
      (sel.anchorLine === sel.focusLine && sel.anchorOffset <= sel.focusOffset)
    if (startBeforeEnd) {
      return {
        startLine: sel.anchorLine,
        startOffset: sel.anchorOffset,
        endLine: sel.focusLine,
        endOffset: sel.focusOffset
      }
    }
    return {
      startLine: sel.focusLine,
      startOffset: sel.focusOffset,
      endLine: sel.anchorLine,
      endOffset: sel.anchorOffset
    }
  }, [])

  const getLineSelectionRange = useCallback(
    (index: number): { start: number; end: number } | null => {
      if (!multiLineSelection) return null
      const norm = normalizeSelection(multiLineSelection)
      if (index < norm.startLine || index > norm.endLine) return null
      const t = lines[index]?.text ?? ''
      const len = t.length
      if (norm.startLine === norm.endLine) {
        return {
          start: Math.min(norm.startOffset, len),
          end: Math.min(norm.endOffset, len)
        }
      }
      if (index === norm.startLine) {
        return { start: Math.min(norm.startOffset, len), end: len }
      }
      if (index === norm.endLine) {
        return { start: 0, end: Math.min(norm.endOffset, len) }
      }
      return { start: 0, end: len }
    },
    [lines, multiLineSelection, normalizeSelection]
  )

  useLayoutEffect(() => {
    const sel = multiLineSelection
    if (!sel) return
    const norm = normalizeSelection(sel)
    for (let i = 0; i < textareaRefs.current.length; i++) {
      const ta = textareaRefs.current[i]
      if (!ta) continue
      const len = ta.value.length
      if (i < norm.startLine || i > norm.endLine) {
        ta.setSelectionRange(0, 0)
        continue
      }
      /**
       * 포커스가 없는 textarea 는 Chromium/Electron 에서 ::selection 글자색(투명)이 적용되지 않는 경우가 있어
       * 네이티브 선택이 파란 배경+검정 글자로 미러(흰 글자)와 섞여 보인다.
       * 가상 다중 줄 선택은 미러만 전 구간을 칠하고, 네이티브 범위는 포커스 줄(커서가 있는 줄)에만 둔다.
       */
      if (i !== sel.focusLine) {
        ta.setSelectionRange(0, 0)
        continue
      }
      let s = 0
      let e = 0
      if (norm.startLine === norm.endLine) {
        s = Math.min(norm.startOffset, len)
        e = Math.min(norm.endOffset, len)
      } else if (i === norm.startLine) {
        s = Math.min(norm.startOffset, len)
        e = len
      } else if (i === norm.endLine) {
        s = 0
        e = Math.min(norm.endOffset, len)
      } else {
        s = 0
        e = len
      }
      if (s === e) {
        ta.setSelectionRange(s, e)
        continue
      }
      /**
       * 기본 setSelectionRange 는 forward → 캐럿이 항상 range 끝(아래쪽)에 그려짐.
       * 아래→위 드래그 시 포커스는 위쪽 끝인데 캐럿이 아래 끝에 있으면 네이티브 선택 하이라이트가
       * 커서가 닿은 쪽만 검정 글자로 덮는 것처럼 보인다. 포커스 줄에서 방향을 맞춘다.
       */
      const fo = Math.min(Math.max(sel.focusOffset, 0), len)
      let direction: 'forward' | 'backward' = 'forward'
      if (fo <= s) direction = 'backward'
      else if (fo >= e) direction = 'forward'
      else {
        direction = fo - s <= e - fo ? 'backward' : 'forward'
      }
      ta.setSelectionRange(s, e, direction)
    }
  }, [lines, multiLineSelection, normalizeSelection])

  const handleLineChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
      /** 클릭으로만 잡힌 multiLineSelection 이 남으면 lines 변경 시 selection sync effect 가 오래된 offset 으로 커서를 되돌려 앞쪽 삽입 버그가 난다 */
      setMultiLineSelection(null)
      const newT = e.target.value
      setLines((prev) => {
        const line = prev[index]
        if (!line) return prev
        const oldT = line.text
        let spans = remapSpansAfterEdit(oldT, newT, line.spans)
        const ins = insertionIndexIfSingleChar(oldT, newT)
        if (ins !== null && pendingBoldLineIdsRef.current.has(line.id)) {
          spans = addBoldOnRange(spans, ins, ins + 1)
        }
        return prev.map((l, i) => (i === index ? { ...l, text: newT, spans } : l))
      })
    },
    []
  )

  const mergeWithPrevious = useCallback(
    (index: number, cutStart = 0) => {
      if (index <= 0) return
      setLines((prev) => {
        const before = prev[index - 1]
        const current = prev[index]
        if (!before || !current) return prev
        const joinAt = before.text.length
        pendingFocusRef.current = { index: index - 1, cursor: joinAt }
        const remaining = current.text.slice(cutStart)
        const shiftedSource =
          cutStart > 0 ? remapSpansAfterEdit(current.text, remaining, current.spans) : current.spans
        const shifted = shiftSpans(before.text.length, shiftedSource)
        const mergedSpans = [...(before.spans ?? []), ...shifted]
        const merged: EditorLineModel = {
          ...before,
          text: before.text + remaining,
          spans: mergedSpans.length ? mergedSpans : undefined,
          formatting: { ...(before.formatting ?? {}) }
        }
        pendingBoldLineIdsRef.current.delete(current.id)
        const next = [...prev.slice(0, index - 1), merged, ...prev.slice(index + 1)]
        return next.length ? next : normalizeEditorLines([])
      })
      bumpToolbar()
    },
    [bumpToolbar]
  )

  const toggleBold = useCallback(() => {
    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    setLines((prev) => {
      const line = prev[i]
      if (!line) return prev
      if (s === e) {
        const next = new Set(pendingBoldLineIdsRef.current)
        if (next.has(line.id)) next.delete(line.id)
        else next.add(line.id)
        pendingBoldLineIdsRef.current = next
        queueMicrotask(bumpToolbar)
        return prev
      }
      const nextSpans = toggleSpanProperty(line.spans, 'bold', s, e, line.text.length)
      pendingBoldLineIdsRef.current.delete(line.id)
      queueMicrotask(bumpToolbar)
      return prev.map((l, j) => (j === i ? { ...l, spans: nextSpans } : l))
    })
  }, [bumpToolbar])

  const toggleStrikethrough = useCallback(() => {
    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    if (s === e) return
    setLines((prev) => {
      const line = prev[i]
      if (!line) return prev
      const nextSpans = toggleSpanProperty(line.spans, 'strikethrough', s, e, line.text.length)
      return prev.map((l, j) => (j === i ? { ...l, spans: nextSpans } : l))
    })
  }, [])

  const deleteMultiLineSelection = useCallback(
    (sel: MultiLineSelection) => {
      const norm = normalizeSelection(sel)
      setLines((prev) => {
        const first = prev[norm.startLine]
        const last = prev[norm.endLine]
        if (!first || !last) return prev
        const mergedText =
          first.text.slice(0, norm.startOffset) + last.text.slice(norm.endOffset)
        const merged: EditorLineModel = {
          ...first,
          text: mergedText,
          spans: undefined
        }
        const removed = prev.slice(norm.startLine + 1, norm.endLine + 1)
        for (const line of removed) pendingBoldLineIdsRef.current.delete(line.id)
        const next = [
          ...prev.slice(0, norm.startLine),
          merged,
          ...prev.slice(norm.endLine + 1)
        ]
        pendingFocusRef.current = { index: norm.startLine, cursor: norm.startOffset }
        return next.length ? next : normalizeEditorLines([])
      })
      setMultiLineSelection(null)
      bumpToolbar()
    },
    [bumpToolbar, normalizeSelection]
  )

  const applyHighlightToSelection = useCallback((color: HighlightColor) => {
    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    if (s === e) return
    setLines((prev) => {
      const line = prev[i]
      if (!line) return prev
      const nextSpans = toggleHighlightColor(line.spans, s, e, color, line.text.length)
      return prev.map((l, j) => (j === i ? { ...l, spans: nextSpans } : l))
    })
  }, [])

  const onHighlightPrimaryClick = useCallback(() => {
    applyHighlightToSelection(lastHighlightColor)
  }, [applyHighlightToSelection, lastHighlightColor])

  const onPickHighlightColor = useCallback(
    (c: HighlightColor) => {
      setLastHighlightColor(c)
      applyHighlightToSelection(c)
    },
    [applyHighlightToSelection]
  )

  const toggleLineHasCheckbox = useCallback(() => {
    const i = lastFocusIndex.current
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l
        const f = l.formatting ?? {}
        const nextHas = !f.hasCheckbox
        return {
          ...l,
          formatting: nextHas
            ? { ...f, hasCheckbox: true, checkboxChecked: false, strikethrough: false }
            : { ...f, hasCheckbox: false, checkboxChecked: false, strikethrough: false }
        }
      })
    )
  }, [])

  const toggleLineDivider = useCallback(() => {
    const i = lastFocusIndex.current
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l
        const f = l.formatting ?? {}
        return { ...l, formatting: { ...f, hasDivider: !f.hasDivider } }
      })
    )
  }, [])

  const insertTextAtCursor = useCallback((snippet: string) => {
    setMultiLineSelection(null)
    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const caret = start + snippet.length
    pendingFocusRef.current = { index: i, cursor: caret }
    setLines((prev) => {
      const line = prev[i]
      if (!line) return prev
      const oldT = line.text
      const newT = oldT.slice(0, start) + snippet + oldT.slice(end)
      const spans = remapSpansAfterEdit(oldT, newT, line.spans)
      return prev.map((l, j) => (j === i ? { ...l, text: newT, spans } : l))
    })
  }, [])

  const handleEmojiSelect = useCallback(
    (char: string) => {
      insertTextAtCursor(char)
      void window.snapnote.clipboard.writeSystem(char, { skipHistory: true })
      setEmojiPaletteOpen(false)
    },
    [insertTextAtCursor]
  )

  const toggleEmojiPalette = useCallback(() => {
    setEmojiPaletteOpen((o) => !o)
  }, [])

  const handleLineCheckboxToggle = useCallback((index: number) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index || !l.formatting?.hasCheckbox) return l
        const f = l.formatting
        const checked = !f.checkboxChecked
        return {
          ...l,
          formatting: {
            ...f,
            checkboxChecked: checked,
            strikethrough: checked
          }
        }
      })
    )
  }, [])

  const copyMultiLineSelectionToClipboard = useCallback(
    (sel: MultiLineSelection) => {
      const norm = normalizeSelection(sel)
      const parts: string[] = []
      for (let i = norm.startLine; i <= norm.endLine; i++) {
        const t = lines[i]?.text ?? ''
        if (i === norm.startLine && i === norm.endLine) {
          parts.push(t.slice(norm.startOffset, norm.endOffset))
        } else if (i === norm.startLine) {
          parts.push(t.slice(norm.startOffset))
        } else if (i === norm.endLine) {
          parts.push(t.slice(0, norm.endOffset))
        } else {
          parts.push(t)
        }
      }
      void window.snapnote.clipboard.writeSystem(parts.join('\n'), { skipHistory: true })
    },
    [lines, normalizeSelection]
  )

  const moveFocusToLine = useCallback((nextIndex: number, nextCursor: number) => {
    const ta = textareaRefs.current[nextIndex]
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(nextCursor, nextCursor)
    lastFocusIndex.current = nextIndex
    setFocusLineIndex(nextIndex)
    if (!draggingSelectionRef.current) setMultiLineSelection(null)
  }, [])

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing || e.key === 'Process') return

      const line = lines[index]
      if (!line) return
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      /** Windows Ctrl / macOS Cmd — 단축키 일관 처리 */
      const mod = (e.ctrlKey || e.metaKey) && !e.altKey
      const key = e.key.toLowerCase()

      if (
        multiLineSelection &&
        (multiLineSelection.anchorLine !== multiLineSelection.focusLine ||
          multiLineSelection.anchorOffset !== multiLineSelection.focusOffset)
      ) {
        const norm = normalizeSelection(multiLineSelection)
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault()
          pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
          deleteMultiLineSelection(multiLineSelection)
          return
        }
        /** 여러 줄 가상 선택: 네이티브 cut 이 한 textarea 에만 적용되어 실패하므로 명시 처리 */
        if (mod && key === 'x' && !e.shiftKey) {
          e.preventDefault()
          pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
          copyMultiLineSelectionToClipboard(multiLineSelection)
          deleteMultiLineSelection(multiLineSelection)
          return
        }
        if (mod && key === 'c' && !e.shiftKey) {
          e.preventDefault()
          copyMultiLineSelectionToClipboard(multiLineSelection)
          return
        }
      }

      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const prev = undoStackRef.current.pop()
        if (!prev) return
        redoStackRef.current.push({
          lines: cloneLines(lines),
          focusIndex: index,
          cursor: start
        })
        restoreSnapshot(prev)
        return
      }

      if (mod && e.shiftKey && key === 'z') {
        e.preventDefault()
        const next = redoStackRef.current.pop()
        if (!next) return
        undoStackRef.current.push({
          lines: cloneLines(lines),
          focusIndex: index,
          cursor: start
        })
        restoreSnapshot(next)
        return
      }

      if (mod && key === 'b') {
        e.preventDefault()
        toggleBold()
        return
      }
      if (mod && e.shiftKey && key === 'x') {
        e.preventDefault()
        toggleStrikethrough()
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        setLines((prev) =>
          prev.map((l, i) => {
            if (i !== index) return l
            const next = Math.min(MAX_INDENT, Math.max(0, l.indentLevel + (e.shiftKey ? -1 : 1)))
            return { ...l, indentLevel: next }
          })
        )
        return
      }

      if (e.key === 'ArrowUp' && start === end && start === 0 && index > 0) {
        e.preventDefault()
        const prevLen = lines[index - 1]?.text.length ?? 0
        moveFocusToLine(index - 1, prevLen)
        return
      }

      if (
        e.key === 'ArrowDown' &&
        start === end &&
        end === line.text.length &&
        index < lines.length - 1
      ) {
        e.preventDefault()
        moveFocusToLine(index + 1, 0)
        return
      }

      if (
        e.key === '>' &&
        !e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        start === end &&
        start > 0 &&
        line.text[start - 1] === '-'
      ) {
        e.preventDefault()
        const replaceStart = start - 1
        const replaceEnd = start
        pendingFocusRef.current = { index, cursor: replaceStart + 1 }
        setLines((prev) => {
          const cur = prev[index]
          if (!cur) return prev
          const oldT = cur.text
          const newT = oldT.slice(0, replaceStart) + '→' + oldT.slice(replaceEnd)
          const spans = remapSpansAfterEdit(oldT, newT, cur.spans)
          return prev.map((l, i) => (i === index ? { ...l, text: newT, spans } : l))
        })
        return
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const before = line.text.slice(0, start)
        const after = line.text.slice(end)
        const [leftSpans, rightSpans] = splitSpansAt(line.spans, start)
        const newLine: EditorLineModel = {
          id: crypto.randomUUID(),
          text: after,
          indentLevel: line.indentLevel,
          formatting: {},
          spans: rightSpans.length ? rightSpans : undefined
        }
        pendingFocusRef.current = { index: index + 1, cursor: 0 }
        setLines((prev) => {
          const next = [...prev]
          next[index] = {
            ...next[index],
            text: before,
            spans: leftSpans.length ? leftSpans : undefined
          }
          next.splice(index + 1, 0, newLine)
          return next
        })
        return
      }

      if (e.key === 'Backspace' && start === 0 && index > 0) {
        e.preventDefault()
        mergeWithPrevious(index, end)
        return
      }
    },
    [
      copyMultiLineSelectionToClipboard,
      cloneLines,
      deleteMultiLineSelection,
      lines,
      mergeWithPrevious,
      moveFocusToLine,
      multiLineSelection,
      normalizeSelection,
      pushUndoSnapshot,
      restoreSnapshot,
      toggleBold,
      toggleStrikethrough
    ]
  )

  useImperativeHandle(
    imperativeRef,
    () => ({
      appendTextFromClipboard: (text: string) => {
        setMultiLineSelection(null)
        const i = lastFocusIndex.current
        setLines((prev) =>
          prev.map((l, idx) => {
            if (idx !== i) return l
            const oldT = l.text
            const newT = l.text + text
            const spans = remapSpansAfterEdit(oldT, newT, l.spans)
            return { ...l, text: newT, spans }
          })
        )
      }
    }),
    []
  )

  const serialized = useMemo(() => JSON.stringify(lines), [lines])

  const setRefAt = useCallback((i: number, el: HTMLTextAreaElement | null) => {
    textareaRefs.current[i] = el
  }, [])

  const onLinePointerDown = useCallback((index: number, e: React.PointerEvent<HTMLTextAreaElement>) => {
    if (e.button !== 0) return
    const ta = e.currentTarget
    endSelectionDragRef.current?.()
    endSelectionDragRef.current = null

    draggingSelectionRef.current = true
    ta.focus()
    lastFocusIndex.current = index
    setFocusLineIndex(index)
    /**
     * mousedown 직후에는 브라우저가 아직 캐럿/선택을 갱신하지 않아 selectionStart/End 가 이전 줄 전체 선택 등
     * 으로 남을 수 있다. multiLineSelection 을 여기서 채우면 sync effect 가 그대로 DOM 에 박혀
     * "줄 클릭 시 전체 선택" 처럼 보인다. 실제 드래그가 시작된 뒤에만 가상 선택을 연다.
     */
    setMultiLineSelection(null)
    selectionAnchorRef.current = null
    const dragStartClient = { x: e.clientX, y: e.clientY }
    const lineIndexDown = index
    let dragSelectionActive = false
    let moveRafId = 0
    let pendingPointer: { x: number; y: number } | null = null

    const flushMove = (): void => {
      moveRafId = 0
      if (!draggingSelectionRef.current) return
      const p = pendingPointer
      if (!p) return
      const clientX = p.x
      const clientY = p.y
      const found = findEditorTextareaUnderPoint(clientX, clientY, textareaRefs.current, lineIndexDown)
      if (!found) return

      if (!dragSelectionActive) {
        const movedEnough =
          Math.hypot(clientX - dragStartClient.x, clientY - dragStartClient.y) >= 4
        const lineChanged = found.index !== lineIndexDown
        if (!movedEnough && !lineChanged) return
        const ta0 = textareaRefs.current[lineIndexDown]
        if (!ta0) return
        dragSelectionActive = true
        const s = Math.min(ta0.selectionStart, ta0.selectionEnd)
        selectionAnchorRef.current = { line: lineIndexDown, anchorOffset: s }
        const { ta: taUnder, index: elIndex } = found
        taUnder.focus()
        lastFocusIndex.current = elIndex
        setFocusLineIndex((prev) => (prev === elIndex ? prev : elIndex))
        const focusOffset = getCaretOffsetFromPointInTextarea(taUnder, clientX, clientY)
        const nextSel: MultiLineSelection = {
          anchorLine: lineIndexDown,
          anchorOffset: s,
          focusLine: elIndex,
          focusOffset
        }
        setMultiLineSelection((prev) => (multiLineSelectionEqual(prev, nextSel) ? prev : nextSel))
        return
      }

      const { ta: taUnder, index: elIndex } = found
      taUnder.focus()
      lastFocusIndex.current = elIndex
      setFocusLineIndex((prev) => (prev === elIndex ? prev : elIndex))
      const focusOffset = getCaretOffsetFromPointInTextarea(taUnder, clientX, clientY)
      setMultiLineSelection((prev) => {
        const anchor = selectionAnchorRef.current
        if (!anchor) return prev
        const next: MultiLineSelection = !prev
          ? {
              anchorLine: anchor.line,
              anchorOffset: anchor.anchorOffset,
              focusLine: elIndex,
              focusOffset
            }
          : {
              anchorLine: prev.anchorLine,
              anchorOffset: prev.anchorOffset,
              focusLine: elIndex,
              focusOffset
            }
        return multiLineSelectionEqual(prev, next) ? prev : next
      })
    }

    const move = (ev: PointerEvent): void => {
      if (!draggingSelectionRef.current) return
      if ((ev.buttons & 1) !== 1) return
      pendingPointer = { x: ev.clientX, y: ev.clientY }
      if (moveRafId) return
      moveRafId = requestAnimationFrame(flushMove)
    }

    const endDrag = (): void => {
      if (moveRafId) {
        cancelAnimationFrame(moveRafId)
        moveRafId = 0
      }
      pendingPointer = null
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', endDrag)
      document.removeEventListener('pointercancel', endDrag)
      endSelectionDragRef.current = null
      draggingSelectionRef.current = false
      selectionAnchorRef.current = null
      const before = multiLineSelectionRef.current
      setMultiLineSelection((p) => {
        if (!p) return null
        if (p.anchorLine === p.focusLine && p.anchorOffset === p.focusOffset) return null
        return p
      })
      const hadRange =
        before &&
        !(before.anchorLine === before.focusLine && before.anchorOffset === before.focusOffset)
      if (hadRange) {
        suppressNextFocusSelectionClearRef.current = true
        window.setTimeout(() => {
          suppressNextFocusSelectionClearRef.current = false
        }, 0)
      }
    }

    endSelectionDragRef.current = endDrag
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', endDrag)
    document.addEventListener('pointercancel', endDrag)
  }, [])

  const onEditorScrollPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.closest('.editor-line')) return
    if (target.closest('button,input,textarea,[role="button"]')) return
    e.preventDefault()
    setLines((prev) => {
      const safe = prev.length ? prev : normalizeEditorLines([])
      const lastIndex = safe.length - 1
      const last = safe[lastIndex]
      if (!last) return safe
      if ((last.text ?? '').trim().length === 0) {
        pendingFocusRef.current = { index: lastIndex, cursor: 0 }
        return safe
      }
      const nextLine: EditorLineModel = {
        id: crypto.randomUUID(),
        text: '',
        indentLevel: 0,
        formatting: {}
      }
      const next = [...safe, nextLine]
      pendingFocusRef.current = { index: next.length - 1, cursor: 0 }
      return next
    })
  }, [])

  const virtualSelectionActive =
    multiLineSelection !== null &&
    (multiLineSelection.anchorLine !== multiLineSelection.focusLine ||
      multiLineSelection.anchorOffset !== multiLineSelection.focusOffset)

  return (
    <div
      className={
        virtualSelectionActive ? 'editor-root-inner editor--virtual-selection-active' : 'editor-root-inner'
      }
    >
      <div className="editor-scroll" onPointerDown={onEditorScrollPointerDown}>
        <div className="editor-lines">
          {lines.map((line, index) => (
            <EditorLineView
              key={line.id}
              ref={(el) => setRefAt(index, el)}
              line={line}
              placeholder={index === 0 ? '내용을 입력하세요.' : ''}
              onChange={(e) => handleLineChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPointerDown={(e) => onLinePointerDown(index, e)}
              onFocus={() => {
                lastFocusIndex.current = index
                setFocusLineIndex(index)
                if (suppressNextFocusSelectionClearRef.current) {
                  suppressNextFocusSelectionClearRef.current = false
                  return
                }
                if (!draggingSelectionRef.current) setMultiLineSelection(null)
              }}
              mirrorSelectionRange={getLineSelectionRange(index) ?? undefined}
              onCheckboxToggle={
                line.formatting?.hasCheckbox ? () => handleLineCheckboxToggle(index) : undefined
              }
            />
          ))}
        </div>
        <textarea
          className="edit-serialized-content"
          aria-hidden
          tabIndex={-1}
          readOnly
          value={serialized}
          onChange={() => {}}
        />
      </div>
      <div className="editor-bottom-bar">
        <div className="editor-bottom-bar-tags">
          <TagInput
            value={tagRaw}
            onChange={onTagRawChange}
            suggestions={tagSuggestions}
            variant="bottom"
          />
        </div>
        <div className="editor-toolbar-stack" ref={toolbarStackRef}>
          <ClipboardHistoryControl />
          <FormatToolbar
            boldActive={toolbarToggleUi.boldActive}
            strikeActive={toolbarToggleUi.strikeActive}
            highlightActive={toolbarToggleUi.highlightActive}
            lineCheckboxActive={toolbarToggleUi.lineCheckboxActive}
            lineDividerActive={toolbarToggleUi.lineDividerActive}
            onBold={toggleBold}
            onStrikethrough={toggleStrikethrough}
            lastHighlightColor={lastHighlightColor}
            onHighlightPrimaryClick={onHighlightPrimaryClick}
            onPickHighlightColor={onPickHighlightColor}
            onToggleLineCheckbox={toggleLineHasCheckbox}
            onToggleLineDivider={toggleLineDivider}
            compactActions={compactToolbarActions}
            symbolPaletteOpen={emojiPaletteOpen}
            onToggleSymbolPalette={toggleEmojiPalette}
            onSymbolSelect={handleEmojiSelect}
            onCloseSymbolPalette={() => setEmojiPaletteOpen(false)}
          />
          <span className="editor-toolbar-flex-spacer" aria-hidden />
          <button
            type="button"
            className="format-toolbar-btn format-toolbar-btn--history format-toolbar-btn--icon"
            title="히스토리 (Ctrl+H)"
            aria-label="히스토리"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void window.snapnote.app.openHistory()}
          >
            <IconToolbarHistory size={18} />
          </button>
        </div>
      </div>
    </div>
  )
})
