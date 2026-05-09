import { normalizeHighlightColor } from '@shared/highlight'
import type { HighlightColor, LineFormatting, TextSpan } from '@shared/types'
import { clamp } from './spanFormat'

const HL_CLASS: Record<HighlightColor, string> = {
  yellow: 'inline-hl-yellow',
  green: 'inline-hl-green',
  pink: 'inline-hl-pink',
  gray: 'inline-hl-gray'
}

function collectBreakpoints(
  text: string,
  spans: TextSpan[],
  selectionStart?: number,
  selectionEnd?: number
): number[] {
  const p = new Set<number>([0, text.length])
  for (const s of spans) {
    p.add(clamp(s.start, 0, text.length))
    p.add(clamp(s.end, 0, text.length))
  }
  if (selectionStart !== undefined && selectionEnd !== undefined) {
    p.add(clamp(selectionStart, 0, text.length))
    p.add(clamp(selectionEnd, 0, text.length))
  }
  return [...p].sort((a, b) => a - b)
}

function sliceOverlapsSelection(
  a: number,
  b: number,
  selectionStart?: number,
  selectionEnd?: number
): boolean {
  if (selectionStart === undefined || selectionEnd === undefined) return false
  if (selectionEnd <= selectionStart) return false
  return a < selectionEnd && b > selectionStart
}

function classForSlice(
  sliceStart: number,
  sliceEnd: number,
  mid: number,
  spans: TextSpan[],
  lineStrike: boolean,
  selectionStart?: number,
  selectionEnd?: number
): string {
  const parts: string[] = []
  if (lineStrike) parts.push('inline-strike')
  if (sliceOverlapsSelection(sliceStart, sliceEnd, selectionStart, selectionEnd)) {
    parts.push('inline-selected')
  }
  for (const s of spans) {
    if (mid >= s.start && mid < s.end) {
      if (s.bold) parts.push('inline-bold')
      if (s.strikethrough) parts.push('inline-strike')
      if (s.underline) parts.push('inline-underline')
      if (s.highlight) {
        const col = normalizeHighlightColor(String(s.highlight))
        const c = col ? HL_CLASS[col] : undefined
        if (c) parts.push(c)
      }
      if (s.memoLinkId) parts.push('inline-memo-link')
    }
  }
  return parts.join(' ')
}

export interface SearchHighlight {
  start: number
  end: number
}

export interface SpannedLineMirrorProps {
  text: string
  spans?: TextSpan[] | undefined
  lineFormatting?: LineFormatting
  selectionStart?: number
  selectionEnd?: number
  searchHighlights?: SearchHighlight[]
}

export function SpannedLineMirror({
  text,
  spans,
  lineFormatting,
  selectionStart,
  selectionEnd,
  searchHighlights
}: SpannedLineMirrorProps): React.JSX.Element {
  const s = spans ?? []
  const lineStrike = Boolean(
    lineFormatting?.checkboxChecked && lineFormatting?.hasCheckbox
  )
  if (!text) {
    return <span className="editor-line-mirror-empty" />
  }
  const bp = collectBreakpoints(text, s, selectionStart, selectionEnd)
  if (searchHighlights?.length) {
    for (const h of searchHighlights) {
      bp.push(clamp(h.start, 0, text.length))
      bp.push(clamp(h.end, 0, text.length))
    }
    bp.sort((a, b) => a - b)
  }
  const uniq = [...new Set(bp)]
  const parts: React.JSX.Element[] = []
  for (let k = 0; k < uniq.length - 1; k++) {
    const a = uniq[k]!
    const b = uniq[k + 1]!
    if (a === b) continue
    const slice = text.slice(a, b)
    const mid = Math.min(a + Math.floor((b - a - 1) / 2), text.length - 1)
    let cls = classForSlice(a, b, mid >= a ? mid : a, s, lineStrike, selectionStart, selectionEnd)
    if (searchHighlights?.length) {
      const inSearch = searchHighlights.some((h) => a >= h.start && b <= h.end)
      if (inSearch) cls = cls ? cls + ' editor-search-highlight' : 'editor-search-highlight'
    }
    parts.push(
      <span key={`${a}:${b}`} className={cls}>
        {slice}
      </span>
    )
  }
  return <span className="editor-line-mirror-parts">{parts}</span>
}
