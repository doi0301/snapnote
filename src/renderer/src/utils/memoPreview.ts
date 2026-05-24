import { isKeycapStorageChar, keycapDisplayChar } from '@shared/keycapChar'
import type { EditorLine, TextSpan } from '@shared/types'

export interface LinePreviewSpanned {
  text: string
  spans?: TextSpan[]
}

function clampSpanIndex(n: number, max: number): number {
  return Math.max(0, Math.min(n, max))
}

function copySpanSlice(s: TextSpan, start: number, end: number): TextSpan {
  const copy: TextSpan = { start, end }
  if (s.bold) copy.bold = true
  if (s.strikethrough) copy.strikethrough = true
  if (s.underline) copy.underline = true
  if (s.highlight) copy.highlight = s.highlight
  if (s.memoLinkId) copy.memoLinkId = s.memoLinkId
  if (s.keycap) copy.keycap = true
  return copy
}

function remapSpansForTrimmedLine(
  clipEnd: number,
  sourceSpans: TextSpan[] | undefined,
  leading: number
): TextSpan[] | undefined {
  const source = sourceSpans ?? []
  if (!source.length) return undefined
  const next: TextSpan[] = []
  for (const s of source) {
    const start = s.start - leading
    const end = s.end - leading
    if (end <= 0 || start >= clipEnd) continue
    const nsl = clampSpanIndex(start, clipEnd)
    const nel = clampSpanIndex(end, clipEnd)
    if (nsl >= nel) continue
    next.push(copySpanSlice(s, nsl, nel))
  }
  return next.length ? next : undefined
}

/** span 누락 시 전각 keycap 저장 문자에서 keycap span 추론 */
function mergeInferredKeycapSpans(
  text: string,
  contentEnd: number,
  spans: TextSpan[] | undefined
): TextSpan[] | undefined {
  const merged: TextSpan[] = [...(spans ?? [])]
  for (let i = 0; i < contentEnd; i++) {
    if (!isKeycapStorageChar(text[i]!)) continue
    if (merged.some((s) => s.keycap && i >= s.start && i < s.end)) continue
    merged.push({ start: i, end: i + 1, keycap: true })
  }
  return merged.length
    ? merged.sort((a, b) => a.start - b.start || a.end - b.end)
    : undefined
}

function previewFromTrimmedLine(
  trimmed: string,
  max: number,
  sourceSpans: TextSpan[] | undefined,
  leading: number
): LinePreviewSpanned {
  const truncated = trimmed.length > max
  const clipEnd = truncated ? max : trimmed.length
  const text = truncated ? `${trimmed.slice(0, max)}…` : trimmed
  const remapped = remapSpansForTrimmedLine(clipEnd, sourceSpans, leading)
  const spans = mergeInferredKeycapSpans(text, clipEnd, remapped)
  return spans ? { text, spans } : { text }
}

/** 첫 줄 trim + max 자르기 — text·spans 함께 반환 (리스트 미리보기용) */
export function firstLinePreviewSpanned(lines: EditorLine[], max = 10): LinePreviewSpanned {
  const line = lines[0]
  const raw = line?.text ?? ''
  const leading = raw.length - raw.trimStart().length
  const trimmed = raw.trim()
  if (!trimmed) return { text: '…' }
  return previewFromTrimmedLine(trimmed, max, line?.spans, leading)
}

/** tooltip·aria용 — keycap 구간만 반각 숫자로 치환 */
export function plainLinePreview(lines: EditorLine[], max = 10): string {
  const { text, spans } = firstLinePreviewSpanned(lines, max)
  if (text === '…' || !spans?.some((s) => s.keycap)) return text

  const keycapSpans = spans.filter((s) => s.keycap).sort((a, b) => a.start - b.start)
  let out = ''
  let i = 0
  for (const s of keycapSpans) {
    if (s.start > i) out += text.slice(i, s.start)
    out += keycapDisplayChar(text.slice(s.start, s.end))
    i = s.end
  }
  out += text.slice(i)
  return out
}

/** 폴디드 슬롯·프리뷰용 첫 줄 요약 (최대 `max`자) */
export function firstLinePreview(lines: EditorLine[], max = 10): string {
  return plainLinePreview(lines, max)
}

/** 호버 프리뷰용 — 비어 있지 않은 줄마다 text·spans (전체 max자 제한) */
export function fullContentPreviewLines(lines: EditorLine[], max = 320): LinePreviewSpanned[] {
  const result: LinePreviewSpanned[] = []
  let used = 0
  let first = true

  for (const line of lines) {
    const raw = line.text ?? ''
    const leading = raw.length - raw.trimStart().length
    const trimmed = raw.trim()
    if (!trimmed) continue

    if (!first) {
      if (used >= max) break
      used += 1
      if (used > max) break
    }
    first = false

    const budget = max - used
    if (budget <= 0) break

    const preview = previewFromTrimmedLine(trimmed, budget, line.spans, leading)
    result.push(preview)
    used += preview.text.length
    if (preview.text.endsWith('…')) break
  }

  return result.length ? result : [{ text: '…' }]
}

export function fullContentPreview(lines: EditorLine[], max = 320): string {
  const text = lines
    .map((line) => line.text.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim()
  if (!text) return '…'
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}
