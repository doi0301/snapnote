import type { HighlightColor, TextSpan } from '@shared/types'

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** 단일 연속 편집(삽입·삭제·치환) 가정 — IME/붙여넣기는 경계만 맞으면 대부분 동작 */
export function singleReplacementRange(
  oldText: string,
  newText: string
): { start: number; oldEnd: number; newEnd: number } | null {
  if (oldText === newText) return null
  const oLen = oldText.length
  const nLen = newText.length
  let i = 0
  while (i < oLen && i < nLen && oldText[i] === newText[i]) i++
  let j = 0
  while (j < oLen - i && j < nLen - i && oldText[oLen - 1 - j] === newText[nLen - 1 - j]) j++
  const oldEnd = oLen - j
  const newEnd = nLen - j
  return { start: i, oldEnd, newEnd }
}

function mapEndpoint(p: number, start: number, oldEnd: number, newEnd: number): number {
  const delta = newEnd - oldEnd
  if (p < start) return p
  if (p >= oldEnd) return p + delta
  return start
}

export function remapSpansAfterEdit(
  oldText: string,
  newText: string,
  spans: TextSpan[] | undefined
): TextSpan[] {
  const list = spans ?? []
  if (oldText === newText) return list.map((s) => ({ ...s }))
  const r = singleReplacementRange(oldText, newText)
  if (!r) return list.map((s) => ({ ...s }))
  const { start, oldEnd, newEnd } = r
  const next: TextSpan[] = []
  const max = newText.length
  for (const s of list) {
    const ns = mapEndpoint(s.start, start, oldEnd, newEnd)
    const ne = mapEndpoint(s.end, start, oldEnd, newEnd)
    if (ns >= ne) continue
    const nsl = clamp(ns, 0, max)
    const nel = clamp(ne, 0, max)
    if (nsl >= nel) continue
    const copy: TextSpan = { start: nsl, end: nel }
    if (s.bold) copy.bold = true
    if (s.strikethrough) copy.strikethrough = true
    if (s.highlight) copy.highlight = s.highlight
    next.push(copy)
  }
  return next.sort((a, b) => a.start - b.start || a.end - b.end)
}

export type InlineFormatProp = 'bold' | 'strikethrough'

function hasPropAt(spans: TextSpan[], i: number, prop: InlineFormatProp): boolean {
  return spans.some((s) => i >= s.start && i < s.end && s[prop])
}

export function rangeFullyHasProp(
  spans: TextSpan[],
  a: number,
  b: number,
  prop: InlineFormatProp
): boolean {
  if (a >= b) return true
  for (let i = a; i < b; i++) {
    if (!hasPropAt(spans, i, prop)) return false
  }
  return true
}

function removePropFromSpan(s: TextSpan, prop: InlineFormatProp, a: number, b: number): TextSpan[] {
  if (!s[prop]) return [{ ...s }]
  const ss = s.start
  const se = s.end
  const lo = Math.max(ss, a)
  const hi = Math.min(se, b)
  if (lo >= hi) return [{ ...s }]
  const out: TextSpan[] = []
  if (ss < lo) {
    const left: TextSpan = { start: ss, end: lo }
    if (s.bold) left.bold = true
    if (s.strikethrough) left.strikethrough = true
    if (s.highlight) left.highlight = s.highlight
    out.push(left)
  }
  if (hi < se) {
    const right: TextSpan = { start: hi, end: se }
    if (s.bold) right.bold = true
    if (s.strikethrough) right.strikethrough = true
    if (s.highlight) right.highlight = s.highlight
    out.push(right)
  }
  if (lo < hi) {
    const mid: TextSpan = { start: lo, end: hi }
    if (prop !== 'bold' && s.bold) mid.bold = true
    if (prop !== 'strikethrough' && s.strikethrough) mid.strikethrough = true
    if (s.highlight) mid.highlight = s.highlight
    if (mid.bold || mid.strikethrough || mid.highlight) out.push(mid)
  }
  return out
}

function removePropertyFromRange(
  spans: TextSpan[],
  prop: InlineFormatProp,
  a: number,
  b: number
): TextSpan[] {
  const out: TextSpan[] = []
  for (const s of spans) {
    out.push(...removePropFromSpan(s, prop, a, b))
  }
  return out.sort((x, y) => x.start - y.start)
}

function addPropertyToRange(
  spans: TextSpan[],
  prop: InlineFormatProp,
  a: number,
  b: number
): TextSpan[] {
  const next = spans.map((s) => ({ ...s }))
  const add: TextSpan = { start: a, end: b }
  if (prop === 'bold') add.bold = true
  else add.strikethrough = true
  next.push(add)
  return next.sort((x, y) => x.start - y.start)
}

export function toggleSpanProperty(
  spans: TextSpan[] | undefined,
  prop: InlineFormatProp,
  a: number,
  b: number,
  textLength: number
): TextSpan[] {
  const list = spans ?? []
  const aa = clamp(a, 0, textLength)
  const bb = clamp(b, 0, textLength)
  if (aa >= bb) return list.map((s) => ({ ...s }))
  if (rangeFullyHasProp(list, aa, bb, prop)) {
    return removePropertyFromRange(list, prop, aa, bb)
  }
  return addPropertyToRange(list, prop, aa, bb)
}

/** Enter 줄 분리: split 기준 왼쪽 / 오른쪽 줄 span */
export function splitSpansAt(
  spans: TextSpan[] | undefined,
  split: number
): [TextSpan[], TextSpan[]] {
  const s = spans ?? []
  const left: TextSpan[] = []
  const right: TextSpan[] = []
  for (const sp of s) {
    const ss = sp.start
    const se = sp.end
    if (se <= split) {
      left.push({ ...sp })
      continue
    }
    if (ss >= split) {
      const sh: TextSpan = { ...sp, start: ss - split, end: se - split }
      right.push(sh)
      continue
    }
    if (ss < split) {
      const L: TextSpan = { ...sp, start: ss, end: split }
      left.push(L)
    }
    if (split < se) {
      const R: TextSpan = { ...sp, start: 0, end: se - split }
      right.push(R)
    }
  }
  return [left, right]
}

/** 이전 줄과 병합 시 오른쪽 줄 span을 왼쪽 텍스트 길이만큼 이동 */
export function shiftSpans(offset: number, spans: TextSpan[] | undefined): TextSpan[] {
  const s = spans ?? []
  return s.map((sp) => ({
    ...sp,
    start: sp.start + offset,
    end: sp.end + offset
  }))
}

/** 단일 문자 삽입 위치 (삽입 1글자일 때) */
export function insertionIndexIfSingleChar(oldText: string, newText: string): number | null {
  if (newText.length !== oldText.length + 1) return null
  const r = singleReplacementRange(oldText, newText)
  if (!r) return null
  const insLen = r.newEnd - r.start
  const delLen = r.oldEnd - r.start
  if (delLen !== 0 || insLen !== 1) return null
  return r.start
}

export function addBoldOnRange(spans: TextSpan[] | undefined, a: number, b: number): TextSpan[] {
  const list = spans ?? []
  return addPropertyToRange(list, 'bold', a, b)
}

function hasHighlightAt(spans: TextSpan[], i: number, color: HighlightColor): boolean {
  return spans.some((s) => s.highlight === color && i >= s.start && i < s.end)
}

export function rangeFullyHasHighlight(
  spans: TextSpan[],
  a: number,
  b: number,
  color: HighlightColor
): boolean {
  if (a >= b) return true
  for (let i = a; i < b; i++) {
    if (!hasHighlightAt(spans, i, color)) return false
  }
  return true
}

/** 캐럿(접힌 선택) 기준으로 볼드/취소선 등 한 글자 스타일을 볼 때 사용 */
export function caretReferenceCharIndex(selStart: number, textLength: number): number | null {
  if (textLength === 0) return null
  if (selStart >= textLength) return textLength - 1
  return selStart
}

/** [a,b)의 모든 문자에 어떤 색이든 하이라이트가 적용되어 있으면 true */
export function rangeFullyHasAnyHighlight(
  spans: TextSpan[] | undefined,
  a: number,
  b: number
): boolean {
  const list = spans ?? []
  if (a >= b) return false
  for (let i = a; i < b; i++) {
    if (!list.some((s) => s.highlight != null && i >= s.start && i < s.end)) return false
  }
  return true
}

/** 구간 [a,b) 안의 어떤 형태의 하이라이트도 제거 (다른 속성은 유지) */
export function removeHighlightFromRange(spans: TextSpan[] | undefined, a: number, b: number): TextSpan[] {
  const list = spans ?? []
  const out: TextSpan[] = []
  for (const s of list) {
    if (!s.highlight) {
      out.push({ ...s })
      continue
    }
    const col = s.highlight
    const ss = s.start
    const se = s.end
    const lo = Math.max(ss, a)
    const hi = Math.min(se, b)
    if (lo >= hi) {
      out.push({ ...s })
      continue
    }
    if (ss < lo) {
      const L: TextSpan = { start: ss, end: lo, highlight: col }
      if (s.bold) L.bold = true
      if (s.strikethrough) L.strikethrough = true
      out.push(L)
    }
    if (lo < hi) {
      const M: TextSpan = { start: lo, end: hi }
      if (s.bold) M.bold = true
      if (s.strikethrough) M.strikethrough = true
      if (M.bold || M.strikethrough) out.push(M)
    }
    if (hi < se) {
      const R: TextSpan = { start: hi, end: se, highlight: col }
      if (s.bold) R.bold = true
      if (s.strikethrough) R.strikethrough = true
      out.push(R)
    }
  }
  return out.sort((x, y) => x.start - y.start || x.end - y.end)
}

/** 특정 색만 구간에서 제거 */
export function removeHighlightColorFromRange(
  spans: TextSpan[] | undefined,
  a: number,
  b: number,
  color: HighlightColor
): TextSpan[] {
  const list = spans ?? []
  const out: TextSpan[] = []
  for (const s of list) {
    if (s.highlight !== color) {
      out.push({ ...s })
      continue
    }
    const ss = s.start
    const se = s.end
    const lo = Math.max(ss, a)
    const hi = Math.min(se, b)
    if (lo >= hi) {
      out.push({ ...s })
      continue
    }
    if (ss < lo) {
      const L: TextSpan = { start: ss, end: lo, highlight: color }
      if (s.bold) L.bold = true
      if (s.strikethrough) L.strikethrough = true
      out.push(L)
    }
    if (lo < hi) {
      const M: TextSpan = { start: lo, end: hi }
      if (s.bold) M.bold = true
      if (s.strikethrough) M.strikethrough = true
      if (M.bold || M.strikethrough) out.push(M)
    }
    if (hi < se) {
      const R: TextSpan = { start: hi, end: se, highlight: color }
      if (s.bold) R.bold = true
      if (s.strikethrough) R.strikethrough = true
      out.push(R)
    }
  }
  return out.sort((x, y) => x.start - y.start || x.end - y.end)
}

/** 선택 구간이 모두 해당 색이면 제거, 아니면 해당 색으로 덮어씀(구간 내 기존 하이라이트 제거 후) */
export function toggleHighlightColor(
  spans: TextSpan[] | undefined,
  a: number,
  b: number,
  color: HighlightColor,
  textLength: number
): TextSpan[] {
  const aa = clamp(a, 0, textLength)
  const bb = clamp(b, 0, textLength)
  if (aa >= bb) return (spans ?? []).map((s) => ({ ...s }))
  const list = spans ?? []
  if (rangeFullyHasHighlight(list, aa, bb, color)) {
    return removeHighlightColorFromRange(list, aa, bb, color)
  }
  const next = removeHighlightFromRange(list, aa, bb)
  next.push({ start: aa, end: bb, highlight: color })
  return next.sort((x, y) => x.start - y.start || x.end - y.end)
}
