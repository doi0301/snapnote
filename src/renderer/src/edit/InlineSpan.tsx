import { normalizeHighlightColor } from '@shared/highlight'
import { keycapDisplayChar } from '@shared/keycapChar'
import type { HighlightColor, LineFormatting, TextSpan } from '@shared/types'
import { clamp } from './spanFormat'

const HL_CLASS: Record<HighlightColor, string> = {
  yellow: 'inline-hl-yellow',
  green: 'inline-hl-green',
  pink: 'inline-hl-pink',
  gray: 'inline-hl-gray',
  blue: 'inline-hl-blue',
  orange: 'inline-hl-orange',
  purple: 'inline-hl-purple'
}

/** 컬러 이모지 매칭 (variation selector·ZWJ 시퀀스 포함) */
const EMOJI_SEQUENCE_RE =
  /\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?)*/gu
const EMOJI_ONLY_RE =
  /^(\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?)*)+$/u

/** 이모지 구간 경계를 분리해 faux-bold text-shadow(검정 테두리)를 끌 수 있게 한다 */
function addEmojiBreakpoints(text: string, set: Set<number>): void {
  EMOJI_SEQUENCE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = EMOJI_SEQUENCE_RE.exec(text)) !== null) {
    set.add(m.index)
    set.add(m.index + m[0].length)
    if (m[0].length === 0) EMOJI_SEQUENCE_RE.lastIndex++
  }
}

/** 본문 #키워드 뱃지 — 공백 단위로 1개 (#\S+) */
const KEYWORD_BADGE_RE = /#[^\s#]+/g

function addKeywordBreakpoints(text: string, set: Set<number>): void {
  KEYWORD_BADGE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = KEYWORD_BADGE_RE.exec(text)) !== null) {
    set.add(m.index)
    set.add(m.index + m[0].length)
  }
}

function isKeywordBadge(slice: string): boolean {
  return /^#[^\s#]+$/.test(slice)
}

function isEmojiOnly(slice: string): boolean {
  return EMOJI_ONLY_RE.test(slice)
}

/** surrogate pair(이모지) 중간에서 끊기면 lone surrogate(U+FFFD) 렌더 방지 — 쌍 끝으로 보정 */
function snapBreakpoint(text: string, index: number): number {
  if (index <= 0 || index >= text.length) return index
  const code = text.charCodeAt(index)
  const prev = text.charCodeAt(index - 1)
  return code >= 0xdc00 && code <= 0xdfff && prev >= 0xd800 && prev <= 0xdbff ? index + 1 : index
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
      if (s.keycap) parts.push('snapnote-keycap-badge')
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
  /** mirror: 에디터(커서 정렬) · inline: 리스트 미리보기 */
  variant?: 'mirror' | 'inline'
}

export function SpannedLineMirror({
  text,
  spans,
  lineFormatting,
  selectionStart,
  selectionEnd,
  searchHighlights,
  variant = 'mirror'
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
  const snapped = new Set(bp.map((i) => snapBreakpoint(text, i)))
  addEmojiBreakpoints(text, snapped)
  addKeywordBreakpoints(text, snapped)
  const uniq = [...snapped].sort((a, b) => a - b)
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
    if (isEmojiOnly(slice)) cls = cls ? cls + ' inline-emoji' : 'inline-emoji'
    if (isKeywordBadge(slice)) cls = cls ? cls + ' inline-keyword-badge' : 'inline-keyword-badge'
    const hasKeycap = cls.includes('snapnote-keycap-badge')
    if (hasKeycap && variant === 'inline') {
      parts.push(
        <span key={`${a}:${b}`} className={cls}>
          {keycapDisplayChar(slice)}
        </span>
      )
    } else if (hasKeycap) {
      parts.push(
        <span
          key={`${a}:${b}`}
          className={cls}
          data-keycap-display={keycapDisplayChar(slice)}
        >
          {slice}
        </span>
      )
    } else {
      parts.push(
        <span key={`${a}:${b}`} className={cls}>
          {slice}
        </span>
      )
    }
  }
  return <span className="editor-line-mirror-parts">{parts}</span>
}
