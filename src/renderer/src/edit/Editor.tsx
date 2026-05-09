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
import type { EditorLine as EditorLineModel, HighlightColor, Memo, MemoId } from '@shared/types'
import { useAutoSave } from '@renderer/hooks/useAutoSave'
import { EditorLineView } from './EditorLine'
import { ClipboardHistoryControl } from './ClipboardPanel'
import { FormatToolbar } from './FormatToolbar'
import { TagInput } from './TagInput'
import { MAX_INDENT, normalizeEditorLines } from './editorLines'
import {
  addBoldOnRange,
  caretReferenceCharIndex,
  clearMemoLinksOnRange,
  insertionIndexIfSingleChar,
  memoLinkIdAtIndex,
  rangeFullyHasAnyHighlight,
  rangeFullyHasAnyMemoLink,
  rangeFullyHasProp,
  remapSpansAfterEdit,
  shiftSpans,
  splitSpansAt,
  toggleHighlightColor,
  toggleMemoLinkOnRange,
  toggleSpanProperty
} from './spanFormat'
import { findEditorTextareaUnderPoint, getCaretOffsetFromPointInTextarea } from './editorCaretFromPoint'
import { IconCopyAll, IconToolbarHistory } from './toolbarIcons'
import './editor.css'

export { normalizeEditorLines } from './editorLines'

export interface EditorHandle {
  appendTextFromClipboard: (text: string) => void
  copyAllToClipboard: () => void
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

interface LinkHoverHint {
  x: number
  y: number
}

interface ToolbarToggleUiState {
  boldActive: boolean
  strikeActive: boolean
  underlineActive: boolean
  highlightActive: boolean
  memoLinkActive: boolean
  lineCheckboxActive: boolean
  lineDividerActive: boolean
}

interface ToolbarLineSegmentEval {
  boldAll: boolean
  strikeAll: boolean
  underlineAll: boolean
  highlightAll: boolean
  memoLinkAll: boolean
}

interface PerfBadgeState {
  enabled: boolean
  warnToolbar: number
  warnResize: number
  warnMemoUpdate: number
  cacheLimit?: number
}

type SnapnotePerfConfigApi = {
  enable: () => void
  disable: () => void
  status: () => {
    enabled: boolean
    warn: { toolbarToggleUi: number; resizeTextareas: number; memoUpdate: number }
    toolbarSegmentCacheLimit?: number
  }
  setWarn: (name: keyof typeof PERF_WARN_MS, ms: number) => void
  clearWarn: (name?: keyof typeof PERF_WARN_MS) => void
  setToolbarSegmentCacheLimit: (limit: number) => void
  clearToolbarSegmentCacheLimit: () => void
}

declare global {
  interface Window {
    snapnotePerfConfig?: SnapnotePerfConfigApi
  }
}

const HEADING_MARKERS: Record<number, { open: string; close: string | null }> = {
  1: { open: '[', close: ']' },
  2: { open: '<', close: '>' },
  3: { open: '(', close: ')' },
  4: { open: '\u25B8 ', close: null },
  5: { open: '- ', close: null }
}

function stripAllHeadingMarkers(text: string): string {
  let t = text
  for (const m of Object.values(HEADING_MARKERS)) {
    if (m.close) {
      if (t.startsWith(m.open) && t.endsWith(m.close)) {
        t = t.slice(m.open.length, t.length - m.close.length)
      }
    } else {
      if (t.startsWith(m.open)) {
        t = t.slice(m.open.length)
      }
    }
  }
  return t
}

const PERF_LOG_COOLDOWN_MS = 500
const PERF_WARN_MS = {
  toolbarToggleUi: 5,
  resizeTextareas: 7,
  memoUpdate: 20
} as const

function getToolbarSegmentCacheLimit(lineCount: number, override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.max(100, Math.min(5000, Math.floor(override)))
  }
  if (lineCount <= 40) return 400
  if (lineCount <= 120) return 800
  return 1200
}

function parsePositiveNumber(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return n
}

function spanSignatureHash(line: EditorLineModel): number {
  const spans = line.spans
  if (!spans || spans.length === 0) return 0
  let hash = 2166136261
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i]!
    hash ^= s.start & 0xffff
    hash = Math.imul(hash, 16777619)
    hash ^= s.end & 0xffff
    hash = Math.imul(hash, 16777619)
    hash ^= s.bold ? 1 : 0
    hash = Math.imul(hash, 16777619)
    hash ^= s.strikethrough ? 2 : 0
    hash = Math.imul(hash, 16777619)
    hash ^= s.highlight === 'yellow' ? 3 : s.highlight === 'green' ? 5 : s.highlight === 'pink' ? 7 : s.highlight === 'gray' ? 11 : 0
    hash = Math.imul(hash, 16777619)
    if (s.memoLinkId) {
      const id = s.memoLinkId
      for (let j = 0; j < id.length; j++) {
        hash ^= id.charCodeAt(j)
        hash = Math.imul(hash, 16777619)
      }
    } else {
      hash ^= 13
      hash = Math.imul(hash, 16777619)
    }
  }
  return hash >>> 0
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

/** 가상 다중 줄 선택이 비어 있지 않은 범위인지 */
function isVirtualRangeSelection(sel: MultiLineSelection | null): boolean {
  if (!sel) return false
  return sel.anchorLine !== sel.focusLine || sel.anchorOffset !== sel.focusOffset
}

type NormSel = { startLine: number; startOffset: number; endLine: number; endOffset: number }

function getSegmentForNormalizedLine(norm: NormSel, lineIndex: number, lineText: string): { s: number; e: number } | null {
  if (lineIndex < norm.startLine || lineIndex > norm.endLine) return null
  const len = lineText.length
  if (norm.startLine === norm.endLine) {
    return {
      s: Math.min(norm.startOffset, len),
      e: Math.min(norm.endOffset, len)
    }
  }
  if (lineIndex === norm.startLine) {
    return { s: Math.min(norm.startOffset, len), e: len }
  }
  if (lineIndex === norm.endLine) {
    return { s: 0, e: Math.min(norm.endOffset, len) }
  }
  return { s: 0, e: len }
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { memo, onMemoUpdated, onHeadLineChange, tagRaw, onTagRawChange, tagSuggestions },
  imperativeRef
) {
  const isDev = import.meta.env.DEV
  const [lines, setLines] = useState<EditorLineModel[]>(() => normalizeEditorLines(memo.content))
  const linesRef = useRef(lines)
  linesRef.current = lines
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
  const [copyToastVisible, setCopyToastVisible] = useState(false)
  const [linkHoverHint, setLinkHoverHint] = useState<LinkHoverHint | null>(null)
  const linkHoverHintRef = useRef<LinkHoverHint | null>(null)
  const lastLinkHoverEvalAtRef = useRef(0)
  const linkHoverHintRafRef = useRef<number | null>(null)
  const prevLineTextsForResizeRef = useRef<string[] | null>(null)
  const perfEnabledRef = useRef(false)
  const perfLastLogAtRef = useRef<Record<string, number>>({})
  const perfWarnOverrideRef = useRef<Partial<Record<keyof typeof PERF_WARN_MS, number>>>({})
  const perfToolbarCacheLimitOverrideRef = useRef<number | undefined>(undefined)
  const [perfBadge, setPerfBadge] = useState<PerfBadgeState | null>(null)
  const multiSelectionToolbarCacheRef = useRef<{ key: string; value: ToolbarToggleUiState } | null>(null)
  const toolbarLineSegmentCacheRef = useRef<Map<string, ToolbarLineSegmentEval>>(new Map())
  const copyToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [linkPickerRequested, setLinkPickerRequested] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCurrentIdx, setSearchCurrentIdx] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
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
  /** undo/redo로 `setLines` 할 때 `beforeinput` 스냅 푸시 방지 */
  const isApplyingUndoRedoRef = useRef(false)

  useEffect(() => {
    perfEnabledRef.current =
      window.location.search.includes('snapnotePerf=1') || window.localStorage.getItem('snapnote:perf') === '1'
    perfWarnOverrideRef.current = {
      toolbarToggleUi: parsePositiveNumber(window.localStorage.getItem('snapnote:perf:warn:toolbarToggleUi')),
      resizeTextareas: parsePositiveNumber(window.localStorage.getItem('snapnote:perf:warn:resizeTextareas')),
      memoUpdate: parsePositiveNumber(window.localStorage.getItem('snapnote:perf:warn:memoUpdate'))
    }
    perfToolbarCacheLimitOverrideRef.current = parsePositiveNumber(window.localStorage.getItem('snapnote:perf:toolbarSegmentCacheLimit'))
  }, [])

  const getPerfWarnMs = useCallback((name: keyof typeof PERF_WARN_MS): number => {
    return perfWarnOverrideRef.current[name] ?? PERF_WARN_MS[name]
  }, [])

  useEffect(() => {
    const api: SnapnotePerfConfigApi = {
      enable: () => {
        window.localStorage.setItem('snapnote:perf', '1')
        perfEnabledRef.current = true
      },
      disable: () => {
        window.localStorage.removeItem('snapnote:perf')
        perfEnabledRef.current = false
      },
      status: () => ({
        enabled: perfEnabledRef.current,
        warn: {
          toolbarToggleUi: getPerfWarnMs('toolbarToggleUi'),
          resizeTextareas: getPerfWarnMs('resizeTextareas'),
          memoUpdate: getPerfWarnMs('memoUpdate')
        },
        toolbarSegmentCacheLimit: perfToolbarCacheLimitOverrideRef.current
      }),
      setWarn: (name, ms) => {
        if (!Number.isFinite(ms) || ms <= 0) return
        const key = `snapnote:perf:warn:${name}`
        const v = Math.max(1, Math.floor(ms))
        window.localStorage.setItem(key, String(v))
        perfWarnOverrideRef.current[name] = v
      },
      clearWarn: (name) => {
        if (name) {
          window.localStorage.removeItem(`snapnote:perf:warn:${name}`)
          perfWarnOverrideRef.current[name] = undefined
          return
        }
        ;(Object.keys(PERF_WARN_MS) as Array<keyof typeof PERF_WARN_MS>).forEach((k) => {
          window.localStorage.removeItem(`snapnote:perf:warn:${k}`)
          perfWarnOverrideRef.current[k] = undefined
        })
      },
      setToolbarSegmentCacheLimit: (limit) => {
        if (!Number.isFinite(limit) || limit <= 0) return
        const v = Math.max(100, Math.min(5000, Math.floor(limit)))
        window.localStorage.setItem('snapnote:perf:toolbarSegmentCacheLimit', String(v))
        perfToolbarCacheLimitOverrideRef.current = v
      },
      clearToolbarSegmentCacheLimit: () => {
        window.localStorage.removeItem('snapnote:perf:toolbarSegmentCacheLimit')
        perfToolbarCacheLimitOverrideRef.current = undefined
      }
    }
    window.snapnotePerfConfig = api
    return () => {
      if (window.snapnotePerfConfig === api) delete window.snapnotePerfConfig
    }
  }, [getPerfWarnMs])

  useEffect(() => {
    if (!isDev) return
    const syncBadge = (): void => {
      setPerfBadge({
        enabled: perfEnabledRef.current,
        warnToolbar: getPerfWarnMs('toolbarToggleUi'),
        warnResize: getPerfWarnMs('resizeTextareas'),
        warnMemoUpdate: getPerfWarnMs('memoUpdate'),
        cacheLimit: perfToolbarCacheLimitOverrideRef.current
      })
    }
    syncBadge()
    const id = window.setInterval(syncBadge, 1000)
    return () => window.clearInterval(id)
  }, [isDev, getPerfWarnMs])

  const logPerf = useCallback((name: string, durationMs: number, warnOverMs: number): void => {
    if (!perfEnabledRef.current) return
    if (durationMs < warnOverMs) return
    const now = performance.now()
    const last = perfLastLogAtRef.current[name] ?? 0
    if (now - last < PERF_LOG_COOLDOWN_MS) return
    perfLastLogAtRef.current[name] = now
    console.debug(`[snapnote:perf] ${name}: ${durationMs.toFixed(1)}ms`)
  }, [])

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
    isApplyingUndoRedoRef.current = true
    setLines(cloneLines(snapshot.lines))
    setMultiLineSelection(null)
    pendingFocusRef.current = {
      index: Math.max(0, Math.min(snapshot.focusIndex, snapshot.lines.length - 1)),
      cursor: Math.max(0, snapshot.cursor)
    }
    queueMicrotask(() => {
      isApplyingUndoRedoRef.current = false
    })
  }, [cloneLines])

  useEffect(() => {
    return () => {
      endSelectionDragRef.current?.()
      endSelectionDragRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    linkHoverHintRef.current = linkHoverHint
  }, [linkHoverHint])

  useEffect(() => {
    return () => {
      const raf = linkHoverHintRafRef.current
      if (raf != null) cancelAnimationFrame(raf)
      linkHoverHintRafRef.current = null
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
    toolbarLineSegmentCacheRef.current.clear()
    multiSelectionToolbarCacheRef.current = null
  }, [memo.id])

  const firstLineText = lines[0]?.text ?? ''
  useEffect(() => {
    onHeadLineChange?.(firstLineText)
  }, [firstLineText, onHeadLineChange])

  const save = useCallback(async () => {
    const t0 = perfEnabledRef.current ? performance.now() : 0
    const updated = await window.snapnote.memo.update({
      id: memo.id,
      patch: { content: lines }
    })
    if (perfEnabledRef.current) logPerf('memo.update', performance.now() - t0, getPerfWarnMs('memoUpdate'))
    onMemoUpdated(updated)
  }, [memo.id, lines, onMemoUpdated, logPerf, getPerfWarnMs])

  useAutoSave(save, [lines, memo.id])

  useLayoutEffect(() => {
    const t0 = perfEnabledRef.current ? performance.now() : 0
    const resizeOne = (el: HTMLTextAreaElement | null): void => {
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${Math.max(28, el.scrollHeight)}px`
    }
    const prevTexts = prevLineTextsForResizeRef.current
    const lineCount = lines.length
    const nextTexts = new Array<string>(lineCount)
    let resizedCount = 0
    if (!prevTexts || prevTexts.length !== lineCount) {
      textareaRefs.current.forEach((el) => {
        resizeOne(el)
        if (el) resizedCount++
      })
      for (let i = 0; i < lineCount; i++) nextTexts[i] = lines[i]?.text ?? ''
      prevLineTextsForResizeRef.current = nextTexts
      if (perfEnabledRef.current) logPerf(`resizeTextareas(${resizedCount})`, performance.now() - t0, getPerfWarnMs('resizeTextareas'))
      return
    }
    for (let i = 0; i < lineCount; i++) {
      const text = lines[i]?.text ?? ''
      nextTexts[i] = text
      if (prevTexts[i] === text) continue
      resizeOne(textareaRefs.current[i] ?? null)
      resizedCount++
    }
    prevLineTextsForResizeRef.current = nextTexts
    if (perfEnabledRef.current) logPerf(`resizeTextareas(${resizedCount})`, performance.now() - t0, getPerfWarnMs('resizeTextareas'))
  }, [lines, logPerf, getPerfWarnMs])

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

  const searchMatches = useMemo(() => {
    if (!searchQuery || !searchOpen) return []
    const q = searchQuery.toLowerCase()
    const hits: { lineIdx: number; start: number; end: number }[] = []
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].text.toLowerCase()
      let pos = 0
      while (pos < text.length) {
        const idx = text.indexOf(q, pos)
        if (idx === -1) break
        hits.push({ lineIdx: i, start: idx, end: idx + q.length })
        pos = idx + 1
      }
    }
    return hits
  }, [lines, searchQuery, searchOpen])

  useEffect(() => {
    if (searchMatches.length > 0) {
      const hit = searchMatches[0]
      const ta = textareaRefs.current[hit.lineIdx]
      if (ta) {
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setSearchCurrentIdx(0)
    }
  }, [searchMatches])

  const navigateSearch = useCallback((dir: 1 | -1) => {
    if (searchMatches.length === 0) return
    const next = (searchCurrentIdx + dir + searchMatches.length) % searchMatches.length
    setSearchCurrentIdx(next)
    const hit = searchMatches[next]
    if (hit) {
      const ta = textareaRefs.current[hit.lineIdx]
      if (ta) {
        ta.focus()
        ta.setSelectionRange(hit.start, hit.end)
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [searchMatches, searchCurrentIdx])

  const toolbarToggleUi = useMemo(() => {
    const t0 = perfEnabledRef.current ? performance.now() : 0
    const finish = <T,>(value: T): T => {
      if (perfEnabledRef.current) logPerf('toolbarToggleUi', performance.now() - t0, getPerfWarnMs('toolbarToggleUi'))
      return value
    }
    const idx = Math.min(focusLineIndex, Math.max(0, lines.length - 1))
    const line = lines[idx]
    const ta = textareaRefs.current[idx]
    const pendingBold = Boolean(line && pendingBoldLineIdsRef.current.has(line.id))
    const lineCheckboxActive = Boolean(line?.formatting?.hasCheckbox)
    const lineDividerActive = Boolean(line?.formatting?.hasDivider)

    if (multiLineSelection && isVirtualRangeSelection(multiLineSelection)) {
      const norm = normalizeSelection(multiLineSelection)
      const cacheSegments: string[] = [String(norm.startLine), String(norm.startOffset), String(norm.endLine), String(norm.endOffset)]
      for (let i = norm.startLine; i <= norm.endLine; i++) {
        const ln = lines[i]
        if (!ln) continue
        cacheSegments.push(
          ln.id,
          String(ln.text.length),
          String(ln.spans?.length ?? 0),
          String(spanSignatureHash(ln)),
          ln.formatting?.hasCheckbox ? '1' : '0',
          ln.formatting?.hasDivider ? '1' : '0'
        )
      }
      cacheSegments.push(pendingBold ? '1' : '0')
      const cacheKey = cacheSegments.join('|')
      const cached = multiSelectionToolbarCacheRef.current
      if (cached && cached.key === cacheKey) {
        return finish(cached.value)
      }

      let hasAnySegment = false
      let boldAll = true
      let strikeAll = true
      let underlineAll = true
      let hlAll = true
      let memoLinkAll = true
      let allCb = true
      let allDiv = true
      for (let i = norm.startLine; i <= norm.endLine; i++) {
        const ln = lines[i]
        if (!ln) continue
        allCb = allCb && Boolean(ln.formatting?.hasCheckbox)
        allDiv = allDiv && Boolean(ln.formatting?.hasDivider)
        const seg = getSegmentForNormalizedLine(norm, i, ln.text)
        if (!seg || seg.s === seg.e) continue
        hasAnySegment = true
        const lineSig = spanSignatureHash(ln)
        const segmentKey = `${ln.id}:${ln.text.length}:${lineSig}:${seg.s}:${seg.e}`
        const cachedSeg = toolbarLineSegmentCacheRef.current.get(segmentKey)
        let segEval: ToolbarLineSegmentEval
        if (cachedSeg) {
          segEval = cachedSeg
        } else {
          const sp = ln.spans ?? []
          segEval = {
            boldAll: rangeFullyHasProp(sp, seg.s, seg.e, 'bold'),
            strikeAll: rangeFullyHasProp(sp, seg.s, seg.e, 'strikethrough'),
            underlineAll: rangeFullyHasProp(sp, seg.s, seg.e, 'underline'),
            highlightAll: rangeFullyHasAnyHighlight(sp, seg.s, seg.e),
            memoLinkAll: rangeFullyHasAnyMemoLink(sp, seg.s, seg.e)
          }
          const cache = toolbarLineSegmentCacheRef.current
          cache.set(segmentKey, segEval)
          const cacheLimit = getToolbarSegmentCacheLimit(lines.length, perfToolbarCacheLimitOverrideRef.current)
          if (cache.size > cacheLimit) {
            const first = cache.keys().next().value
            if (first) cache.delete(first)
          }
        }
        boldAll = boldAll && segEval.boldAll
        strikeAll = strikeAll && segEval.strikeAll
        underlineAll = underlineAll && segEval.underlineAll
        hlAll = hlAll && segEval.highlightAll
        memoLinkAll = memoLinkAll && segEval.memoLinkAll
        if (!boldAll && !strikeAll && !underlineAll && !hlAll && !memoLinkAll && !allCb && !allDiv) break
      }
      if (hasAnySegment) {
        const value = {
          boldActive: pendingBold || boldAll,
          strikeActive: strikeAll,
          underlineActive: underlineAll,
          highlightActive: hlAll,
          memoLinkActive: memoLinkAll,
          lineCheckboxActive: allCb,
          lineDividerActive: allDiv
        }
        multiSelectionToolbarCacheRef.current = { key: cacheKey, value }
        return finish(value)
      }
    }

    multiSelectionToolbarCacheRef.current = null

    if (!line || !ta) {
      return finish({
        boldActive: pendingBold,
        strikeActive: false,
        underlineActive: false,
        highlightActive: false,
        memoLinkActive: false,
        lineCheckboxActive,
        lineDividerActive
      })
    }

    const s = ta.selectionStart
    const e = ta.selectionEnd
    const sp = line.spans ?? []
    const len = line.text.length

    if (s === e) {
      const ref = caretReferenceCharIndex(s, len)
      const boldAtCaret = ref === null ? false : rangeFullyHasProp(sp, ref, ref + 1, 'bold')
      const strikeAtCaret = ref === null ? false : rangeFullyHasProp(sp, ref, ref + 1, 'strikethrough')
      const underlineAtCaret = ref === null ? false : rangeFullyHasProp(sp, ref, ref + 1, 'underline')
      const hlAtCaret = ref === null ? false : rangeFullyHasAnyHighlight(sp, ref, ref + 1)
      const memoLinkAtCaret =
        ref === null ? false : rangeFullyHasAnyMemoLink(sp, ref, ref + 1)
      return finish({
        boldActive: pendingBold || boldAtCaret,
        strikeActive: strikeAtCaret,
        underlineActive: underlineAtCaret,
        highlightActive: hlAtCaret,
        memoLinkActive: memoLinkAtCaret,
        lineCheckboxActive,
        lineDividerActive
      })
    }

    return finish({
      boldActive: pendingBold || rangeFullyHasProp(sp, s, e, 'bold'),
      strikeActive: rangeFullyHasProp(sp, s, e, 'strikethrough'),
      underlineActive: rangeFullyHasProp(sp, s, e, 'underline'),
      highlightActive: rangeFullyHasAnyHighlight(sp, s, e),
      memoLinkActive: rangeFullyHasAnyMemoLink(sp, s, e),
      lineCheckboxActive,
      lineDividerActive
    })
  }, [lines, focusLineIndex, selectionTick, toolbarTick, multiLineSelection, normalizeSelection, logPerf, getPerfWarnMs])

  const bumpToolbar = useCallback(() => {
    setToolbarTick((t) => t + 1)
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

      if (newT === '[] ') {
        pendingFocusRef.current = { index, cursor: 0 }
        setLines((prev) => {
          const cur = prev[index]
          if (!cur) return prev
          const f = cur.formatting ?? {}
          return prev.map((l, i) =>
            i === index
              ? { ...l, text: '', formatting: { ...f, hasCheckbox: true, checkboxChecked: false } }
              : l
          )
        })
        return
      }

      if (newT === '- ' || newT === '+ ') {
        pendingFocusRef.current = { index, cursor: 2 }
        setLines((prev) => {
          const cur = prev[index]
          if (!cur) return prev
          const oldT = cur.text
          const spans = remapSpansAfterEdit(oldT, '• ', cur.spans)
          return prev.map((l, i) => (i === index ? { ...l, text: '• ', spans } : l))
        })
        return
      }

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
        const mergedFormatting = { ...(before.formatting ?? {}) }
        if (current.formatting?.hasDivider) {
          mergedFormatting.hasDivider = true
        }
        const merged: EditorLineModel = {
          ...before,
          text: before.text + remaining,
          spans: mergedSpans.length ? mergedSpans : undefined,
          formatting: mergedFormatting
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
    const virtual = multiLineSelectionRef.current
    if (virtual && isVirtualRangeSelection(virtual)) {
      const norm = normalizeSelection(virtual)
      pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
      setLines((prev) => {
        const next = prev.map((line, lineIdx) => {
          if (lineIdx < norm.startLine || lineIdx > norm.endLine) return line
          const seg = getSegmentForNormalizedLine(norm, lineIdx, line.text)
          if (!seg || seg.s === seg.e) return line
          const nextSpans = toggleSpanProperty(line.spans, 'bold', seg.s, seg.e, line.text.length)
          pendingBoldLineIdsRef.current.delete(line.id)
          return { ...line, spans: nextSpans }
        })
        queueMicrotask(bumpToolbar)
        return next
      })
      return
    }

    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    pushUndoSnapshot(lines, i, s)
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
  }, [bumpToolbar, lines, normalizeSelection, pushUndoSnapshot])

  const toggleStrikethrough = useCallback(() => {
    const virtual = multiLineSelectionRef.current
    if (virtual && isVirtualRangeSelection(virtual)) {
      const norm = normalizeSelection(virtual)
      let any = false
      for (let lineIdx = norm.startLine; lineIdx <= norm.endLine; lineIdx++) {
        const line = lines[lineIdx]
        if (!line) continue
        const seg = getSegmentForNormalizedLine(norm, lineIdx, line.text)
        if (seg && seg.s !== seg.e) {
          any = true
          break
        }
      }
      if (!any) return
      pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
      setLines((prev) =>
        prev.map((line, lineIdx) => {
          if (lineIdx < norm.startLine || lineIdx > norm.endLine) return line
          const seg = getSegmentForNormalizedLine(norm, lineIdx, line.text)
          if (!seg || seg.s === seg.e) return line
          const nextSpans = toggleSpanProperty(line.spans, 'strikethrough', seg.s, seg.e, line.text.length)
          return { ...line, spans: nextSpans }
        })
      )
      return
    }

    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    if (s === e) return
    pushUndoSnapshot(lines, i, s)
    setLines((prev) => {
      const line = prev[i]
      if (!line) return prev
      const nextSpans = toggleSpanProperty(line.spans, 'strikethrough', s, e, line.text.length)
      return prev.map((l, j) => (j === i ? { ...l, spans: nextSpans } : l))
    })
  }, [lines, normalizeSelection, pushUndoSnapshot])

  const toggleUnderline = useCallback(() => {
    const virtual = multiLineSelectionRef.current
    if (virtual && isVirtualRangeSelection(virtual)) {
      const norm = normalizeSelection(virtual)
      let any = false
      for (let lineIdx = norm.startLine; lineIdx <= norm.endLine; lineIdx++) {
        const line = lines[lineIdx]
        if (!line) continue
        const seg = getSegmentForNormalizedLine(norm, lineIdx, line.text)
        if (seg && seg.s !== seg.e) { any = true; break }
      }
      if (!any) return
      pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
      setLines((prev) =>
        prev.map((line, lineIdx) => {
          if (lineIdx < norm.startLine || lineIdx > norm.endLine) return line
          const seg = getSegmentForNormalizedLine(norm, lineIdx, line.text)
          if (!seg || seg.s === seg.e) return line
          const nextSpans = toggleSpanProperty(line.spans, 'underline', seg.s, seg.e, line.text.length)
          return { ...line, spans: nextSpans }
        })
      )
      return
    }
    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    if (s === e) return
    pushUndoSnapshot(lines, i, s)
    setLines((prev) => {
      const line = prev[i]
      if (!line) return prev
      const nextSpans = toggleSpanProperty(line.spans, 'underline', s, e, line.text.length)
      return prev.map((l, j) => (j === i ? { ...l, spans: nextSpans } : l))
    })
  }, [lines, normalizeSelection, pushUndoSnapshot])

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

  const applyHighlightToSelection = useCallback(
    (color: HighlightColor) => {
      const virtual = multiLineSelectionRef.current
      if (virtual && isVirtualRangeSelection(virtual)) {
        const norm = normalizeSelection(virtual)
        let any = false
        for (let lineIdx = norm.startLine; lineIdx <= norm.endLine; lineIdx++) {
          const line = lines[lineIdx]
          if (!line) continue
          const seg = getSegmentForNormalizedLine(norm, lineIdx, line.text)
          if (seg && seg.s !== seg.e) {
            any = true
            break
          }
        }
        if (!any) return
        pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
        setLines((prev) =>
          prev.map((line, lineIdx) => {
            if (lineIdx < norm.startLine || lineIdx > norm.endLine) return line
            const seg = getSegmentForNormalizedLine(norm, lineIdx, line.text)
            if (!seg || seg.s === seg.e) return line
            const nextSpans = toggleHighlightColor(line.spans, seg.s, seg.e, color, line.text.length)
            return { ...line, spans: nextSpans }
          })
        )
        return
      }

      const i = lastFocusIndex.current
      const ta = textareaRefs.current[i]
      if (!ta) return
      const s = ta.selectionStart
      const e = ta.selectionEnd
      if (s === e) return
      pushUndoSnapshot(lines, i, s)
      setLines((prev) => {
        const line = prev[i]
        if (!line) return prev
        const nextSpans = toggleHighlightColor(line.spans, s, e, color, line.text.length)
        return prev.map((l, j) => (j === i ? { ...l, spans: nextSpans } : l))
      })
    },
    [lines, normalizeSelection, pushUndoSnapshot]
  )

  const onPickHighlightColor = useCallback(
    (c: HighlightColor) => {
      setLastHighlightColor(c)
      applyHighlightToSelection(c)
    },
    [applyHighlightToSelection]
  )

  const applyMemoLinkToSelection = useCallback(
    async (targetMemoId: MemoId) => {
      if (targetMemoId === memo.id) return
      const virtual = multiLineSelectionRef.current
      if (virtual && isVirtualRangeSelection(virtual)) {
        const norm = normalizeSelection(virtual)
        let any = false
        for (let lineIdx = norm.startLine; lineIdx <= norm.endLine; lineIdx++) {
          const ln = lines[lineIdx]
          if (!ln) continue
          const seg = getSegmentForNormalizedLine(norm, lineIdx, ln.text)
          if (seg && seg.s !== seg.e) {
            any = true
            break
          }
        }
        if (!any) return
        pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
        setLines((prev) =>
          prev.map((line, lineIdx) => {
            if (lineIdx < norm.startLine || lineIdx > norm.endLine) return line
            const seg = getSegmentForNormalizedLine(norm, lineIdx, line.text)
            if (!seg || seg.s === seg.e) return line
            const nextSpans = toggleMemoLinkOnRange(
              line.spans,
              seg.s,
              seg.e,
              targetMemoId,
              line.text.length
            )
            return { ...line, spans: nextSpans }
          })
        )
        return
      }

      const i = lastFocusIndex.current
      const ta = textareaRefs.current[i]
      if (!ta) return
      const s = ta.selectionStart
      const ed = ta.selectionEnd
      if (s === ed) {
        const target = await window.snapnote.memo.get(targetMemoId).catch(() => null)
        if (!target) return
        const title = (target.content[0]?.text ?? '').trim() || '(제목 없음)'
        pushUndoSnapshot(linesRef.current, i, s)
        pendingFocusRef.current = { index: i, cursor: s + title.length }
        setLines((prev) => {
          const line = prev[i]
          if (!line) return prev
          const newText = `${line.text.slice(0, s)}${title}${line.text.slice(s)}`
          const remapped = remapSpansAfterEdit(line.text, newText, line.spans)
          const nextSpans = toggleMemoLinkOnRange(remapped, s, s + title.length, targetMemoId, newText.length)
          return prev.map((l, j) => (j === i ? { ...l, text: newText, spans: nextSpans } : l))
        })
        return
      }
      pushUndoSnapshot(lines, i, s)
      setLines((prev) => {
        const line = prev[i]
        if (!line) return prev
        const nextSpans = toggleMemoLinkOnRange(line.spans, s, ed, targetMemoId, line.text.length)
        return prev.map((l, j) => (j === i ? { ...l, spans: nextSpans } : l))
      })
    },
    [lines, memo.id, normalizeSelection, pushUndoSnapshot]
  )

  const clearMemoLinksFromSelection = useCallback(() => {
    const virtual = multiLineSelectionRef.current
    if (virtual && isVirtualRangeSelection(virtual)) {
      const norm = normalizeSelection(virtual)
      let any = false
      for (let lineIdx = norm.startLine; lineIdx <= norm.endLine; lineIdx++) {
        const ln = lines[lineIdx]
        if (!ln) continue
        const seg = getSegmentForNormalizedLine(norm, lineIdx, ln.text)
        if (seg && seg.s !== seg.e) {
          any = true
          break
        }
      }
      if (!any) return
      pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
      setLines((prev) =>
        prev.map((line, lineIdx) => {
          if (lineIdx < norm.startLine || lineIdx > norm.endLine) return line
          const seg = getSegmentForNormalizedLine(norm, lineIdx, line.text)
          if (!seg || seg.s === seg.e) return line
          const nextSpans = clearMemoLinksOnRange(line.spans, seg.s, seg.e, line.text.length)
          return { ...line, spans: nextSpans }
        })
      )
      return
    }

    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    if (!ta) return
    const s = ta.selectionStart
    const ed = ta.selectionEnd
    if (s === ed) return
    pushUndoSnapshot(lines, i, s)
    setLines((prev) => {
      const line = prev[i]
      if (!line) return prev
      const nextSpans = clearMemoLinksOnRange(line.spans, s, ed, line.text.length)
      return prev.map((l, j) => (j === i ? { ...l, spans: nextSpans } : l))
    })
  }, [lines, normalizeSelection, pushUndoSnapshot])

  const toggleLineHasCheckbox = useCallback(() => {
    const virtual = multiLineSelectionRef.current
    if (virtual && isVirtualRangeSelection(virtual)) {
      const norm = normalizeSelection(virtual)
      const first = lines[norm.startLine]
      if (!first) return
      pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
      const f0 = first.formatting ?? {}
      const nextHas = !f0.hasCheckbox
      setLines((prev) =>
        prev.map((l, idx) => {
          if (idx < norm.startLine || idx > norm.endLine) return l
          const f = l.formatting ?? {}
          return {
            ...l,
            formatting: nextHas
              ? { ...f, hasCheckbox: true, checkboxChecked: false, strikethrough: false }
              : { ...f, hasCheckbox: false, checkboxChecked: false, strikethrough: false }
          }
        })
      )
      return
    }

    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    pushUndoSnapshot(lines, i, ta?.selectionStart ?? 0)
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
  }, [lines, normalizeSelection, pushUndoSnapshot])

  const toggleLineDivider = useCallback(() => {
    const virtual = multiLineSelectionRef.current
    if (virtual && isVirtualRangeSelection(virtual)) {
      const norm = normalizeSelection(virtual)
      const first = lines[norm.startLine]
      if (!first) return
      pushUndoSnapshot(lines, norm.startLine, norm.startOffset)
      const f0 = first.formatting ?? {}
      const nextDiv = !f0.hasDivider
      setLines((prev) =>
        prev.map((l, idx) => {
          if (idx < norm.startLine || idx > norm.endLine) return l
          const f = l.formatting ?? {}
          return { ...l, formatting: { ...f, hasDivider: nextDiv } }
        })
      )
      return
    }

    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    pushUndoSnapshot(lines, i, ta?.selectionStart ?? 0)
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l
        const f = l.formatting ?? {}
        return { ...l, formatting: { ...f, hasDivider: !f.hasDivider } }
      })
    )
  }, [lines, normalizeSelection, pushUndoSnapshot])

  const applyHeading = useCallback(
    (level: 1 | 2 | 3 | 4 | 5) => {
      const index = lastFocusIndex.current
      const line = lines[index]
      if (!line) return
      const ta = textareaRefs.current[index]
      pushUndoSnapshot(lines, index, ta?.selectionStart ?? 0)

      setLines((prev) =>
        prev.map((l, i) => {
          if (i !== index) return l
          const cur = l.formatting?.headingLevel
          const stripped = stripAllHeadingMarkers(l.text)
          const marker = HEADING_MARKERS[level]

          if (cur === level) {
            return {
              ...l,
              text: stripped,
              spans: undefined,
              formatting: { ...(l.formatting ?? {}), headingLevel: undefined }
            }
          }

          const newText = marker.close
            ? marker.open + stripped + marker.close
            : marker.open + stripped

          return {
            ...l,
            text: newText,
            spans: undefined,
            formatting: { ...(l.formatting ?? {}), headingLevel: level }
          }
        })
      )

      requestAnimationFrame(() => {
        const taEl = textareaRefs.current[index]
        if (!taEl) return
        const marker = HEADING_MARKERS[level]
        const curLevel = line.formatting?.headingLevel
        const stripped = stripAllHeadingMarkers(line.text)
        if (curLevel === level) {
          taEl.setSelectionRange(stripped.length, stripped.length)
        } else {
          const cursorPos = marker.close
            ? marker.open.length + stripped.length
            : marker.open.length + stripped.length
          taEl.setSelectionRange(cursorPos, cursorPos)
        }
      })
    },
    [lines, pushUndoSnapshot]
  )

  const insertTextAtCursor = useCallback((snippet: string) => {
    setMultiLineSelection(null)
    const i = lastFocusIndex.current
    const ta = textareaRefs.current[i]
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    pushUndoSnapshot(lines, i, start)
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
  }, [lines, pushUndoSnapshot])

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
    const ta = textareaRefs.current[index]
    pushUndoSnapshot(lines, index, ta?.selectionStart ?? 0)
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
  }, [lines, pushUndoSnapshot])

  const copyAllMemoTextToClipboard = useCallback(async () => {
    const text = linesRef.current.map((l) => l.text).join('\n')
    try {
      await window.snapnote.clipboard.writeSystem(text, { skipHistory: true })
      if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current)
      setCopyToastVisible(true)
      copyToastTimeoutRef.current = setTimeout(() => {
        copyToastTimeoutRef.current = null
        setCopyToastVisible(false)
      }, 2200)
    } catch {
      /* 클립보드 실패 시 조용히 무시 */
    }
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

  const handleBeforeLineInput = useCallback(
    (index: number, e: React.FormEvent<HTMLTextAreaElement>) => {
      if (isApplyingUndoRedoRef.current) return
      const ne = e.nativeEvent as InputEvent
      if (ne.isComposing) return
      const it = ne.inputType
      if (it === 'historyUndo' || it === 'historyRedo') return
      if (it && (it.startsWith('insertComposition') || it.startsWith('deleteComposition'))) return
      const ta = e.currentTarget
      pushUndoSnapshot(lines, index, ta.selectionStart)
    },
    [lines, pushUndoSnapshot]
  )

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

      if (mod && key === 'a') {
        e.preventDefault()
        if (lines.length === 0) return
        const lastLine = lines.length - 1
        const lastLen = lines[lastLine]?.text.length ?? 0
        setMultiLineSelection({
          anchorLine: 0,
          anchorOffset: 0,
          focusLine: lastLine,
          focusOffset: lastLen
        })
        lastFocusIndex.current = lastLine
        setFocusLineIndex(lastLine)
        pendingFocusRef.current = { index: lastLine, cursor: lastLen }
        return
      }

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
      if (mod && key === 'u') {
        e.preventDefault()
        toggleUnderline()
        return
      }
      if (mod && key === 'm') {
        e.preventDefault()
        setLinkPickerRequested((prev) => prev + 1)
        return
      }
      if (mod && key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return
      }
      if (mod && !e.shiftKey && key >= '1' && key <= '5') {
        e.preventDefault()
        const level = Number(key) as 1 | 2 | 3 | 4 | 5
        applyHeading(level)
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        pushUndoSnapshot(lines, index, start)
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
        e.key === ' ' &&
        !e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        start === end
      ) {
        const val = ta.value
        if (start === 1 && (val === '-' || val === '+')) {
          e.preventDefault()
          pendingFocusRef.current = { index, cursor: 2 }
          setLines((prev) => {
            const cur = prev[index]
            if (!cur) return prev
            const oldT = cur.text
            const newT = '• '
            const spans = remapSpansAfterEdit(oldT, newT, cur.spans)
            return prev.map((l, i) => (i === index ? { ...l, text: newT, spans } : l))
          })
          return
        }
        if (start === 2 && val === '[]') {
          e.preventDefault()
          pushUndoSnapshot(lines, index, start)
          pendingFocusRef.current = { index, cursor: 0 }
          setLines((prev) => {
            const cur = prev[index]
            if (!cur) return prev
            const f = cur.formatting ?? {}
            return prev.map((l, i) =>
              i === index
                ? { ...l, text: '', formatting: { ...f, hasCheckbox: true, checkboxChecked: false } }
                : l
            )
          })
          return
        }
      }

      if (
        e.key === '>' &&
        !e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        start === end &&
        start > 0
      ) {
        const prevCh = line.text[start - 1]
        if (prevCh === '-' || prevCh === '=') {
          e.preventDefault()
          const replaceStart = start - 1
          const replaceEnd = start
          const insert = prevCh === '-' ? '→' : '⇒'
          pendingFocusRef.current = { index, cursor: replaceStart + 1 }
          setLines((prev) => {
            const cur = prev[index]
            if (!cur) return prev
            const oldT = cur.text
            const newT = oldT.slice(0, replaceStart) + insert + oldT.slice(replaceEnd)
            const spans = remapSpansAfterEdit(oldT, newT, cur.spans)
            return prev.map((l, i) => (i === index ? { ...l, text: newT, spans } : l))
          })
          return
        }
      }

      if (
        e.key === '<' &&
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
          const newT = oldT.slice(0, replaceStart) + '←' + oldT.slice(replaceEnd)
          const spans = remapSpansAfterEdit(oldT, newT, cur.spans)
          return prev.map((l, i) => (i === index ? { ...l, text: newT, spans } : l))
        })
        return
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        pushUndoSnapshot(lines, index, start)
        const before = line.text.slice(0, start)
        const after = line.text.slice(end)
        const [leftSpans, rightSpans] = splitSpansAt(line.spans, start)

        const listPrefixMatch = line.text.match(/^(\s*(?:[-+•]\s|>\s))/)
        const listPrefix = listPrefixMatch?.[1] ?? ''
        const isEmptyListLine = listPrefix && line.text.trim() === listPrefix.trim()

        let newText = after
        let newCursor = 0
        let clearCurrentLine = false
        if (isEmptyListLine) {
          clearCurrentLine = true
          newText = ''
        } else if (listPrefix && start >= listPrefix.length) {
          newText = listPrefix + after
          newCursor = listPrefix.length
        }

        const prevHadDivider = Boolean(line.formatting?.hasDivider)
        const newLineFormatting: Record<string, unknown> = {}
        if (prevHadDivider) newLineFormatting.hasDivider = true

        const newLine: EditorLineModel = {
          id: crypto.randomUUID(),
          text: newText,
          indentLevel: line.indentLevel,
          formatting: newLineFormatting,
          spans: (!listPrefix && rightSpans.length) ? rightSpans : undefined
        }
        pendingFocusRef.current = { index: index + 1, cursor: newCursor }
        setLines((prev) => {
          const next = [...prev]
          const updatedCurrent = {
            ...next[index],
            text: clearCurrentLine ? '' : before,
            spans: leftSpans.length ? leftSpans : undefined,
            formatting: {
              ...(next[index].formatting ?? {}),
              ...(prevHadDivider ? { hasDivider: false } : {})
            }
          }
          next[index] = updatedCurrent
          next.splice(index + 1, 0, newLine)
          return next
        })
        return
      }

      if (e.key === 'Backspace' && start === 0 && index > 0) {
        e.preventDefault()
        const prevLine = lines[index - 1]
        if (prevLine?.formatting?.hasDivider) {
          pushUndoSnapshot(lines, index, start)
          setLines((prev) =>
            prev.map((l, i) =>
              i === index - 1
                ? { ...l, formatting: { ...(l.formatting ?? {}), hasDivider: false } }
                : l
            )
          )
          return
        }
        pushUndoSnapshot(lines, index, start)
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
      toggleStrikethrough,
      toggleUnderline,
      handleBeforeLineInput
    ]
  )

  useImperativeHandle(
    imperativeRef,
    () => ({
      appendTextFromClipboard: (text: string) => {
        setMultiLineSelection(null)
        const i = lastFocusIndex.current
        const ta = textareaRefs.current[i]
        pushUndoSnapshot(linesRef.current, i, ta?.selectionStart ?? 0)
        setLines((prev) =>
          prev.map((l, idx) => {
            if (idx !== i) return l
            const oldT = l.text
            const newT = l.text + text
            const spans = remapSpansAfterEdit(oldT, newT, l.spans)
            return { ...l, text: newT, spans }
          })
        )
      },
      copyAllToClipboard: () => {
        void copyAllMemoTextToClipboard()
      }
    }),
    [pushUndoSnapshot, copyAllMemoTextToClipboard]
  )

  const serialized = useMemo(() => JSON.stringify(lines), [lines])

  const setRefAt = useCallback((i: number, el: HTMLTextAreaElement | null) => {
    textareaRefs.current[i] = el
  }, [])

  const onLinePointerDown = useCallback((index: number, e: React.PointerEvent<HTMLTextAreaElement>) => {
    if (e.button !== 0) return
    setLinkHoverHint(null)
    const ta = e.currentTarget
    const ln = linesRef.current[index]
    if ((e.ctrlKey || e.metaKey) && !e.altKey && ln) {
      const off = getCaretOffsetFromPointInTextarea(ta, e.clientX, e.clientY)
      const linkId = memoLinkIdAtIndex(ln.spans, off, ln.text.length)
      if (linkId) {
        e.preventDefault()
        if (linkId !== memo.id) {
          void window.snapnote.memo.openEdit(linkId)
        }
        return
      }
    }
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
        const lineChanged = found.index !== lineIndexDown
        if (!lineChanged) return
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
  }, [memo.id])

  const onLinePointerMove = useCallback(
    (index: number, e: React.PointerEvent<HTMLTextAreaElement>) => {
      if (draggingSelectionRef.current) return
      const now = performance.now()
      if (now - lastLinkHoverEvalAtRef.current < 42) return
      lastLinkHoverEvalAtRef.current = now
      const line = linesRef.current[index]
      if (!line) {
        if (linkHoverHintRef.current) setLinkHoverHint(null)
        return
      }
      if (!(line.spans?.some((s) => Boolean(s.memoLinkId)))) {
        if (linkHoverHintRef.current) setLinkHoverHint(null)
        return
      }
      const ta = e.currentTarget
      const off = getCaretOffsetFromPointInTextarea(ta, e.clientX, e.clientY)
      const linkId = memoLinkIdAtIndex(line.spans, off, line.text.length)
      if (!linkId) {
        if (linkHoverHintRef.current) setLinkHoverHint(null)
        return
      }
      const next = { x: e.clientX, y: e.clientY }
      const prev = linkHoverHintRef.current
      if (prev && Math.abs(prev.x - next.x) < 4 && Math.abs(prev.y - next.y) < 4) return
      if (linkHoverHintRafRef.current != null) cancelAnimationFrame(linkHoverHintRafRef.current)
      linkHoverHintRafRef.current = requestAnimationFrame(() => {
        setLinkHoverHint(next)
        linkHoverHintRafRef.current = null
      })
    },
    []
  )

  const onLinePointerLeave = useCallback(() => {
    setLinkHoverHint(null)
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
      {searchOpen && (
        <div className="editor-search-bar">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchCurrentIdx(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
              if (e.key === 'Enter') navigateSearch(e.shiftKey ? -1 : 1)
            }}
            placeholder="검색..."
          />
          <span className="editor-search-bar-count">
            {searchMatches.length > 0
              ? `${searchCurrentIdx + 1}/${searchMatches.length}`
              : searchQuery ? '0건' : ''}
          </span>
          <button type="button" onClick={() => navigateSearch(-1)} title="이전">&#9650;</button>
          <button type="button" onClick={() => navigateSearch(1)} title="다음">&#9660;</button>
          <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery('') }} title="닫기">&#10005;</button>
        </div>
      )}
      <div className="editor-scroll" onPointerDown={onEditorScrollPointerDown}>
        <div className="editor-lines">
          {lines.map((line, index) => (
            <EditorLineView
              key={line.id}
              ref={(el) => setRefAt(index, el)}
              line={line}
              placeholder={index === 0 ? '내용을 입력하세요.' : ''}
              isStickyTitle={index === 0}
              searchHighlights={
                searchOpen && searchQuery
                  ? searchMatches
                      .filter((m) => m.lineIdx === index)
                      .map((m) => ({ start: m.start, end: m.end }))
                  : undefined
              }
              onChange={(e) => handleLineChange(index, e)}
              onBeforeInput={(e) => handleBeforeLineInput(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPointerDown={(e) => onLinePointerDown(index, e)}
              onPointerMove={(e) => onLinePointerMove(index, e)}
              onPointerLeave={onLinePointerLeave}
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
          <button
            type="button"
            className="format-toolbar-btn format-toolbar-btn--icon"
            title="전체 복사 (앱 클립보드 히스토리에 넣지 않음)"
            aria-label="전체 복사, 클립보드 히스토리 제외"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => copyAllMemoTextToClipboard()}
          >
            <IconCopyAll size={18} />
          </button>
          <FormatToolbar
            boldActive={toolbarToggleUi.boldActive}
            strikeActive={toolbarToggleUi.strikeActive}
            underlineActive={toolbarToggleUi.underlineActive ?? false}
            lineCheckboxActive={toolbarToggleUi.lineCheckboxActive}
            lineDividerActive={toolbarToggleUi.lineDividerActive}
            onBold={toggleBold}
            onStrikethrough={toggleStrikethrough}
            onUnderline={toggleUnderline}
            lastHighlightColor={lastHighlightColor}
            onPickHighlightColor={onPickHighlightColor}
            onToggleLineCheckbox={toggleLineHasCheckbox}
            onToggleLineDivider={toggleLineDivider}
            currentMemoId={memo.id}
            onApplyMemoLink={applyMemoLinkToSelection}
            onClearMemoLinks={clearMemoLinksFromSelection}
            openLinkPicker={linkPickerRequested > 0 ? true : undefined}
            headingLevel={lines[focusLineIndex]?.formatting?.headingLevel}
            onHeading={applyHeading}
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
      {copyToastVisible ? (
        <div className="editor-copy-toast" role="status" aria-live="polite">
          클립보드에 복사했습니다
        </div>
      ) : null}
      {linkHoverHint ? (
        <div
          className="editor-link-hover-hint"
          role="status"
          aria-live="polite"
          style={{ left: linkHoverHint.x + 12, top: linkHoverHint.y + 14 }}
        >
          ctrl+클릭 메모로 이동
        </div>
      ) : null}
      {isDev && perfBadge ? (
        <div className="editor-perf-badge" aria-live="off">
          <span className="editor-perf-badge__row">
            perf {perfBadge.enabled ? 'on' : 'off'}
          </span>
          <span className="editor-perf-badge__row">
            warn t:{perfBadge.warnToolbar} r:{perfBadge.warnResize} m:{perfBadge.warnMemoUpdate}
          </span>
          <span className="editor-perf-badge__row">
            cache {perfBadge.cacheLimit ?? 'auto'}
          </span>
        </div>
      ) : null}
    </div>
  )
})
