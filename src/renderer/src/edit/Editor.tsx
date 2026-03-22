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

  useEffect(() => {
    let raf = 0
    const onSel = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setSelectionTick((t) => t + 1))
    }
    document.addEventListener('selectionchange', onSel)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('selectionchange', onSel)
    }
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

  useAutoSave(save, [lines, memo])

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

    if (!line || !ta) {
      return {
        boldActive: pendingBold,
        strikeActive: false,
        highlightActive: false,
        lineCheckboxActive
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
        lineCheckboxActive
      }
    }

    return {
      boldActive: pendingBold || rangeFullyHasProp(sp, s, e, 'bold'),
      strikeActive: rangeFullyHasProp(sp, s, e, 'strikethrough'),
      highlightActive: rangeFullyHasAnyHighlight(sp, s, e),
      lineCheckboxActive
    }
  }, [lines, focusLineIndex, selectionTick, toolbarTick])

  const bumpToolbar = useCallback(() => {
    setToolbarTick((t) => t + 1)
  }, [])

  const handleLineChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
    (index: number) => {
      if (index <= 0) return
      setLines((prev) => {
        const before = prev[index - 1]
        const current = prev[index]
        if (!before || !current) return prev
        const joinAt = before.text.length
        pendingFocusRef.current = { index: index - 1, cursor: joinAt }
        const shifted = shiftSpans(before.text.length, current.spans)
        const mergedSpans = [...(before.spans ?? []), ...shifted]
        const merged: EditorLineModel = {
          ...before,
          text: before.text + current.text,
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

  const insertTextAtCursor = useCallback((snippet: string) => {
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

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing || e.key === 'Process') return

      const line = lines[index]
      if (!line) return
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd

      if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleBold()
        return
      }
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'x') {
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

      if (e.key === 'Backspace' && start === 0 && end === 0 && index > 0) {
        e.preventDefault()
        mergeWithPrevious(index)
        return
      }
    },
    [lines, mergeWithPrevious, toggleBold, toggleStrikethrough]
  )

  useImperativeHandle(
    imperativeRef,
    () => ({
      appendTextFromClipboard: (text: string) => {
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

  return (
    <div className="editor-root-inner">
      <div className="editor-scroll">
        <div className="editor-shell editor-shell--flat">
          <div className="editor-lines">
            {lines.map((line, index) => (
              <EditorLineView
                key={line.id}
                ref={(el) => setRefAt(index, el)}
                line={line}
                placeholder={index === 0 ? '내용을 입력하세요.' : ''}
                onChange={(e) => handleLineChange(index, e)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onFocus={() => {
                  lastFocusIndex.current = index
                  setFocusLineIndex(index)
                }}
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
      </div>
      <div className="editor-bottom-bar">
        <TagInput
          value={tagRaw}
          onChange={onTagRawChange}
          suggestions={tagSuggestions}
          variant="bottom"
        />
        <div className="editor-toolbar-stack">
          <ClipboardHistoryControl />
          <FormatToolbar
            boldActive={toolbarToggleUi.boldActive}
            strikeActive={toolbarToggleUi.strikeActive}
            highlightActive={toolbarToggleUi.highlightActive}
            lineCheckboxActive={toolbarToggleUi.lineCheckboxActive}
            onBold={toggleBold}
            onStrikethrough={toggleStrikethrough}
            lastHighlightColor={lastHighlightColor}
            onHighlightPrimaryClick={onHighlightPrimaryClick}
            onPickHighlightColor={onPickHighlightColor}
            onToggleLineCheckbox={toggleLineHasCheckbox}
            symbolPaletteOpen={emojiPaletteOpen}
            onToggleSymbolPalette={toggleEmojiPalette}
            onSymbolSelect={handleEmojiSelect}
            onCloseSymbolPalette={() => setEmojiPaletteOpen(false)}
          />
          <span className="editor-toolbar-flex-spacer" aria-hidden />
          <button
            type="button"
            className="format-toolbar-btn format-toolbar-btn--history"
            title="메모 히스토리 (Ctrl+H)"
            aria-label="메모 히스토리"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void window.snapnote.app.openHistory()}
          >
            🕐
          </button>
        </div>
      </div>
    </div>
  )
})
