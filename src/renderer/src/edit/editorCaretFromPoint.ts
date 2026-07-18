/**
 * 드래그 중 마지막 줄 textarea 위에 포인터가 올라가지 않아도 줄을 찾는다.
 *
 * elementFromPoint 만 쓰면 줄 경계에서 아래쪽 textarea 가 잡혀, 위로 드래그할 때
 * 의도보다 한 줄 아래까지 선택되는 경우가 많다. 수직 거리로 가장 가까운 줄을 고르고,
 * 동일 거리(두 줄 사이)면 인접한 두 줄이면 갭의 수직 중점으로 구분하고,
 * 그 외에는 앵커 줄 기준으로 보조한다.
 *
 * 좌표→오프셋은 사용자가 실제로 보는 mirror(.editor-line-mirror)의 글자 사각형을
 * Range.getClientRects()로 직접 측정한다 — 복제 DOM/Canvas 추정과 달리 렌더링과
 * 어긋날 수 없다. mirror 가 없을 때만(스티키·접힘) measurement DOM → Canvas 순서로
 * fallback 한다.
 */

function verticalDistanceToRect(clientY: number, r: DOMRect): number {
  if (clientY < r.top) return r.top - clientY
  if (clientY > r.bottom) return clientY - r.bottom
  return 0
}

/** textarea 박스는 내용 높이만큼만 잡혀 시각적 줄(.editor-line)보다 짧다 — 드래그 히트는 행 전체로 */
function getEditorLineRect(ta: HTMLTextAreaElement): DOMRect {
  const row = ta.closest('.editor-line')
  return row?.getBoundingClientRect() ?? ta.getBoundingClientRect()
}

function pickTiedLine(
  ties: { ta: HTMLTextAreaElement; index: number; dist: number }[],
  clientY: number,
  anchorLine: number
): { ta: HTMLTextAreaElement; index: number } {
  if (ties.length === 1) {
    const t = ties[0]!
    return { ta: t.ta, index: t.index }
  }
  if (ties.length === 2) {
    const lo = ties[0]!.index < ties[1]!.index ? ties[0]! : ties[1]!
    const hi = ties[0]!.index < ties[1]!.index ? ties[1]! : ties[0]!
    if (hi.index === lo.index + 1) {
      const ra = getEditorLineRect(lo.ta)
      const rb = getEditorLineRect(hi.ta)
      const gapMid = (ra.bottom + rb.top) / 2
      if (clientY < gapMid) return { ta: lo.ta, index: lo.index }
      return { ta: hi.ta, index: hi.index }
    }
  }

  const tieMin = Math.min(...ties.map((t) => t.index))
  const tieMax = Math.max(...ties.map((t) => t.index))
  if (anchorLine > tieMax) {
    const t = ties.find((x) => x.index === tieMin)!
    return { ta: t.ta, index: t.index }
  }
  if (anchorLine < tieMin) {
    const t = ties.find((x) => x.index === tieMax)!
    return { ta: t.ta, index: t.index }
  }
  let best = ties[0]!
  let bestD = Infinity
  for (const t of ties) {
    const r = getEditorLineRect(t.ta)
    const cy = r.top + r.height / 2
    const d = Math.abs(clientY - cy)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  return { ta: best.ta, index: best.index }
}

export function findEditorTextareaUnderPoint(
  clientX: number,
  clientY: number,
  refs: (HTMLTextAreaElement | null)[],
  /** mousedown 이 있었던 줄 — 드래그 방향(위/아래)에 따른 동점 처리에 사용 */
  anchorLine: number
): { ta: HTMLTextAreaElement; index: number } | null {
  const candidates: { ta: HTMLTextAreaElement; index: number; dist: number }[] = []
  for (let i = 0; i < refs.length; i++) {
    const ta = refs[i]
    if (!ta) continue
    const r = getEditorLineRect(ta)
    // X 는 필터하지 않는다 — 창 가장자리 밖·거터 쪽으로 드래그해도 선택이 이어져야
    // 하며, 줄 내 오프셋 계산이 X 를 자연스럽게 clamp 한다.
    const dist = verticalDistanceToRect(clientY, r)
    candidates.push({ ta, index: i, dist })
  }
  if (candidates.length === 0) {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    const ta = el.closest('textarea.editor-line-textarea') as HTMLTextAreaElement | null
    if (!ta) return null
    const index = refs.indexOf(ta)
    if (index < 0) return null
    return { ta, index }
  }

  const minDist = Math.min(...candidates.map((c) => c.dist))
  const ties = candidates.filter((c) => Math.abs(c.dist - minDist) < 0.5)
  return pickTiedLine(ties, clientY, anchorLine)
}

/**
 * 드래그 시작 줄의 네이티브 선택에서 앵커(mousedown 쪽) 오프셋을 추출한다.
 * forward/none → selectionStart, backward → selectionEnd.
 */
export function nativeAnchorOffsetFromTextarea(ta: HTMLTextAreaElement): number {
  const dir = ta.selectionDirection
  if (dir === 'backward') return ta.selectionEnd
  return ta.selectionStart
}

/** UTF-16 인덱스가 surrogate pair 중간에 떨어지면 한 칸 뒤로 보정 */
export function snapToCodePointBoundary(text: string, index: number): number {
  if (index <= 0 || index >= text.length) return index
  const code = text.charCodeAt(index)
  const prev = text.charCodeAt(index - 1)
  const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff
  const prevHighSurrogate = prev >= 0xd800 && prev <= 0xdbff
  return isLowSurrogate && prevHighSurrogate ? index + 1 : index
}

let graphemeSegmenter: Intl.Segmenter | null | undefined

function getGraphemeSegmenter(): Intl.Segmenter | null {
  if (graphemeSegmenter !== undefined) return graphemeSegmenter
  try {
    graphemeSegmenter =
      typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null
  } catch {
    graphemeSegmenter = null
  }
  return graphemeSegmenter
}

/** 가장 가까운 grapheme 경계로 스냅 (Segmenter 없으면 surrogate pair만) */
export function snapToGraphemeBoundary(text: string, index: number): number {
  const clamped = Math.max(0, Math.min(text.length, index))
  const seg = getGraphemeSegmenter()
  if (!seg) return snapToCodePointBoundary(text, clamped)
  let best = 0
  let bestDist = clamped
  for (const { index: start } of seg.segment(text)) {
    const d = Math.abs(start - clamped)
    if (d < bestDist) {
      bestDist = d
      best = start
    }
  }
  const endDist = Math.abs(text.length - clamped)
  if (endDist < bestDist) return text.length
  return best
}

/** grapheme 경계 오프셋 목록 (0, …, text.length) */
export function graphemeBoundaries(text: string): number[] {
  const out = [0]
  const seg = getGraphemeSegmenter()
  if (!seg) {
    for (let i = 0; i < text.length; ) {
      const code = text.charCodeAt(i)
      i += code >= 0xd800 && code <= 0xdbff && i + 1 < text.length ? 2 : 1
      out.push(i)
    }
    return out
  }
  for (const { index } of seg.segment(text)) {
    if (index > 0) out.push(index)
  }
  if (out[out.length - 1] !== text.length) out.push(text.length)
  return out
}

/**
 * 글자 중점 기준: 인접 caret X 중 더 가까운 쪽 선택.
 * widths[i] = prefix length i 의 누적 폭, boundaries는 오름차순 오프셋.
 */
export function offsetFromMidpoints(
  boundaries: number[],
  widths: number[],
  relX: number
): number {
  if (boundaries.length === 0) return 0
  if (boundaries.length === 1) return boundaries[0]!
  const rx = Math.max(0, relX)
  let best = boundaries[0]!
  let bestDist = Infinity
  for (let i = 0; i < boundaries.length; i++) {
    const w = widths[i] ?? 0
    const d = Math.abs(w - rx)
    if (d < bestDist || (d === bestDist && (boundaries[i]! ?? 0) < best)) {
      bestDist = d
      best = boundaries[i]!
    }
  }
  return best
}

/** 렌더링된 grapheme cluster 하나의 화면 사각형 */
export type ClusterRect = {
  start: number
  end: number
  left: number
  right: number
  top: number
  bottom: number
  newline: boolean
}

/**
 * cluster 사각형 목록에서 (x, y)가 가리키는 오프셋을 고른다.
 * 행은 Y로 결정(포함 행 우선, 없으면 최근접), 행 안에서는 글자 중점 기준.
 * 개행 cluster 는 "행의 끝"으로 취급 — 행 오른쪽 여백을 클릭해도 다음 줄로 넘어가지 않는다.
 */
export function pickOffsetFromClusterRects(
  clusters: ClusterRect[],
  x: number,
  y: number
): number | null {
  if (!clusters.length) return null
  type Row = { top: number; bottom: number; clusters: ClusterRect[] }
  const rows: Row[] = []
  for (const c of clusters) {
    const h = Math.max(1, c.bottom - c.top)
    const last = rows[rows.length - 1]
    // 문서 순서에서 이전 행과 세로로 절반 이상 겹치면 같은 시각 행
    if (last && c.top < last.bottom - h * 0.5) {
      last.clusters.push(c)
      last.top = Math.min(last.top, c.top)
      last.bottom = Math.max(last.bottom, c.bottom)
    } else {
      rows.push({ top: c.top, bottom: c.bottom, clusters: [c] })
    }
  }

  let row = rows[0]!
  let bestY = Infinity
  for (const r of rows) {
    if (y >= r.top && y < r.bottom) {
      row = r
      break
    }
    const d = y < r.top ? r.top - y : y - r.bottom
    if (d < bestY) {
      bestY = d
      row = r
    }
  }

  const cs = row.clusters
  for (const c of cs) {
    const mid = (c.left + c.right) / 2
    if (x < mid) return c.start
    if (x < c.right) return c.newline ? c.start : c.end
  }
  const last = cs[cs.length - 1]!
  return last.newline ? last.start : last.end
}

function textNodesWithOffsets(root: Element): { node: Text; start: number }[] {
  const out: { node: Text; start: number }[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let acc = 0
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    out.push({ node, start: acc })
    acc += node.nodeValue?.length ?? 0
  }
  return out
}

function locateInTextNodes(
  nodes: { node: Text; start: number }[],
  offset: number
): { node: Text; local: number } | null {
  for (const e of nodes) {
    const len = e.node.nodeValue?.length ?? 0
    if (offset < e.start + len) return { node: e.node, local: offset - e.start }
  }
  const last = nodes[nodes.length - 1]
  if (!last) return null
  return { node: last.node, local: last.node.nodeValue?.length ?? 0 }
}

/**
 * mirror 의 실제 텍스트 노드에서 grapheme cluster 별 화면 사각형을 얻는다.
 * mirror 텍스트가 textarea 값과 다르면(접힘·미리보기 등) null.
 */
function buildClusterRectsFromMirror(mirror: Element, text: string): ClusterRect[] | null {
  const nodes = textNodesWithOffsets(mirror)
  if (!nodes.length) return null
  let joined = ''
  for (const e of nodes) joined += e.node.nodeValue ?? ''
  if (joined !== text) return null

  const bounds = graphemeBoundaries(text)
  const range = document.createRange()
  const clusters: ClusterRect[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i]!
    const b = bounds[i + 1]!
    const sa = locateInTextNodes(nodes, a)
    const sb = locateInTextNodes(nodes, b)
    if (!sa || !sb) return null
    range.setStart(sa.node, sa.local)
    range.setEnd(sb.node, sb.local)
    const rects = range.getClientRects()
    let rect: DOMRect | null = null
    for (let k = 0; k < rects.length; k++) {
      const r = rects[k]!
      if (!rect || r.width > rect.width) rect = r
    }
    if (!rect) rect = range.getBoundingClientRect()
    clusters.push({
      start: a,
      end: b,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom || rect.top + 1,
      newline: text.slice(a, b) === '\n'
    })
  }
  return clusters
}

function mirrorForTextarea(ta: HTMLTextAreaElement): Element | null {
  const editor = ta.closest('.editor-line-editor')
  return editor ? editor.querySelector('.editor-line-mirror') : null
}

type CaretProbe = { offset: number; left: number; top: number; bottom: number }

type MeasureCache = {
  key: string
  probes: CaretProbe[]
}

const measureCacheByTa = new WeakMap<HTMLTextAreaElement, MeasureCache>()
let measureHost: HTMLDivElement | null = null
let measureTextNode: Text | null = null

function ensureMeasureHost(): { host: HTMLDivElement; textNode: Text } | null {
  if (typeof document === 'undefined') return null
  if (measureHost && measureTextNode && document.body.contains(measureHost)) {
    return { host: measureHost, textNode: measureTextNode }
  }
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'pointer-events:none',
    'left:-99999px',
    'top:0',
    'white-space:pre-wrap',
    'overflow-wrap:break-word',
    'word-break:break-word',
    'box-sizing:border-box',
    'margin:0',
    'border:0',
    'overflow:hidden'
  ].join(';')
  const textNode = document.createTextNode('')
  host.appendChild(textNode)
  document.body.appendChild(host)
  measureHost = host
  measureTextNode = textNode
  return { host, textNode }
}

function styleKey(style: CSSStyleDeclaration, contentWidth: number, text: string): string {
  return [
    text,
    contentWidth,
    style.font,
    style.fontSize,
    style.fontFamily,
    style.fontWeight,
    style.fontStyle,
    style.letterSpacing,
    style.wordSpacing,
    style.lineHeight,
    style.tabSize || (style as CSSStyleDeclaration & { MozTabSize?: string }).MozTabSize || '',
    style.paddingLeft,
    style.paddingRight,
    style.paddingTop,
    style.paddingBottom,
    style.whiteSpace,
    style.overflowWrap,
    style.wordBreak
  ].join('|')
}

function syncMeasureStyles(
  host: HTMLDivElement,
  ta: HTMLTextAreaElement,
  style: CSSStyleDeclaration,
  contentWidth: number
): void {
  host.style.width = `${contentWidth}px`
  host.style.font = style.font
  host.style.fontSize = style.fontSize
  host.style.fontFamily = style.fontFamily
  host.style.fontWeight = style.fontWeight
  host.style.fontStyle = style.fontStyle
  host.style.letterSpacing = style.letterSpacing
  host.style.wordSpacing = style.wordSpacing
  host.style.lineHeight = style.lineHeight
  host.style.tabSize = style.tabSize || (style as CSSStyleDeclaration & { MozTabSize?: string }).MozTabSize || '8'
  host.style.padding = '0'
  host.style.whiteSpace = 'pre-wrap'
  host.style.overflowWrap = style.overflowWrap || 'break-word'
  host.style.wordBreak = style.wordBreak || 'break-word'
  void ta
}

function buildCaretProbes(text: string, textNode: Text): CaretProbe[] {
  const boundaries = graphemeBoundaries(text)
  const probes: CaretProbe[] = []
  const range = document.createRange()
  for (const offset of boundaries) {
    range.setStart(textNode, offset)
    range.setEnd(textNode, offset)
    const rects = range.getClientRects()
    let rect = rects.length ? rects[0]! : range.getBoundingClientRect()
    // 빈 줄/개행 직후 등 폭 0 rect가 여러 개일 때 마지막(현재 행) 사용
    if (rects.length > 1) {
      rect = rects[rects.length - 1]!
    }
    probes.push({
      offset,
      left: rect.left,
      top: rect.top,
      bottom: rect.bottom || rect.top + 1
    })
  }
  return probes
}

function getCachedProbes(ta: HTMLTextAreaElement, text: string, style: CSSStyleDeclaration): CaretProbe[] | null {
  const padLeft = parseFloat(style.paddingLeft) || 0
  const padRight = parseFloat(style.paddingRight) || 0
  const contentWidth = Math.max(1, ta.clientWidth - padLeft - padRight)
  const key = styleKey(style, contentWidth, text)
  const cached = measureCacheByTa.get(ta)
  if (cached && cached.key === key) return cached.probes

  const measure = ensureMeasureHost()
  if (!measure) return null
  syncMeasureStyles(measure.host, ta, style, contentWidth)
  measure.textNode.nodeValue = text
  // 레이아웃 강제
  void measure.host.offsetHeight
  const probes = buildCaretProbes(text, measure.textNode)
  measureCacheByTa.set(ta, { key, probes })
  return probes
}

function offsetFromProbes(probes: CaretProbe[], clientX: number, clientY: number): number {
  if (!probes.length) return 0
  // 행 후보: Y가 행 범위 안이거나 가장 가까운 행
  type Row = { top: number; bottom: number; probes: CaretProbe[] }
  const rows: Row[] = []
  for (const p of probes) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(last.top - p.top) < 0.75) {
      last.probes.push(p)
      last.bottom = Math.max(last.bottom, p.bottom)
    } else {
      rows.push({ top: p.top, bottom: p.bottom, probes: [p] })
    }
  }
  let row = rows[0]!
  let bestY = Infinity
  for (const r of rows) {
    if (clientY >= r.top && clientY <= r.bottom) {
      row = r
      bestY = 0
      break
    }
    const d =
      clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0
    if (d < bestY) {
      bestY = d
      row = r
    }
  }

  const rowProbes = row.probes
  if (!rowProbes.length) return 0
  // 중점: 인접 caret left의 중간을 기준으로 더 가까운 쪽
  let best = rowProbes[0]!
  let bestDist = Infinity
  for (let i = 0; i < rowProbes.length; i++) {
    const cur = rowProbes[i]!
    const prev = rowProbes[i - 1]
    const next = rowProbes[i + 1]
    // 이 probe가 담당하는 X 구간: 이전 중점 ~ 다음 중점
    const leftBound = prev ? (prev.left + cur.left) / 2 : -Infinity
    const rightBound = next ? (cur.left + next.left) / 2 : Infinity
    if (clientX >= leftBound && clientX < rightBound) {
      return cur.offset
    }
    const d = Math.abs(cur.left - clientX)
    if (d < bestDist) {
      bestDist = d
      best = cur
    }
  }
  return best.offset
}

/** Canvas fallback — measurement DOM 불가 시 */
let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')
  }
  return measureCtx
}

function canvasFallbackOffset(
  ta: HTMLTextAreaElement,
  text: string,
  style: CSSStyleDeclaration,
  clientX: number,
  clientY: number
): number {
  const rect = ta.getBoundingClientRect()
  const padLeft = parseFloat(style.paddingLeft) || 0
  const padRight = parseFloat(style.paddingRight) || 0
  const padTop = parseFloat(style.paddingTop) || 0
  const relX = clientX - rect.left - padLeft + ta.scrollLeft
  const relY = clientY - rect.top - padTop + ta.scrollTop
  const ctx = getMeasureCtx()
  if (!ctx) {
    return Math.min(text.length, Math.max(0, Math.round((relX / Math.max(rect.width, 1)) * text.length)))
  }
  const fontWeight = style.fontWeight || '400'
  const fontStyle = style.fontStyle || 'normal'
  ctx.font = `${fontStyle} ${fontWeight} ${style.fontSize} ${style.fontFamily}`
  const maxWidth = Math.max(1, ta.clientWidth - padLeft - padRight)
  const fontSize = parseFloat(style.fontSize) || 14
  const lineHeightStr = style.lineHeight
  const lineHeightPx =
    lineHeightStr === 'normal' ? fontSize * 1.38 : parseFloat(lineHeightStr) || fontSize * 1.38

  // 명시적 개행은 별도 시각 행으로 두지 않음 — "a\nb" → 두 행
  const visual: Array<{ start: number; end: number }> = []
  let pos = 0
  while (pos < text.length) {
    if (text[pos] === '\n') {
      visual.push({ start: pos, end: pos + 1 })
      pos++
      continue
    }
    const nl = text.indexOf('\n', pos)
    const hardEnd = nl === -1 ? text.length : nl
    let end = pos
    let lo = pos + 1
    let hi = hardEnd
    let best = pos
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (ctx.measureText(text.slice(pos, mid)).width <= maxWidth) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    end = best > pos ? best : Math.min(pos + 1, hardEnd)
    visual.push({ start: pos, end })
    pos = end
  }

  if (relY < 0) return 0
  let y = 0
  for (let r = 0; r < visual.length; r++) {
    const { start, end } = visual[r]!
    const nextY = y + lineHeightPx
    const lastRow = r === visual.length - 1
    if (relY >= y && (relY < nextY || lastRow)) {
      if (text[start] === '\n') return Math.min(start + 1, text.length)
      let rowEnd = end
      if (end > start && text[end - 1] === '\n') rowEnd = end - 1
      const rowText = text.slice(start, rowEnd)
      const bounds = graphemeBoundaries(rowText).map((b) => b) // relative
      const widths = bounds.map((b) => ctx.measureText(rowText.slice(0, b)).width)
      const local = offsetFromMidpoints(bounds, widths, relX)
      return snapToGraphemeBoundary(text, start + local)
    }
    y = nextY
  }
  return text.length
}

/**
 * textarea 내 문자 오프셋 (mirror 실측 우선 → measurement DOM → Canvas fallback)
 */
export function getCaretOffsetFromPointInTextarea(
  ta: HTMLTextAreaElement,
  clientX: number,
  clientY: number
): number {
  const text = ta.value
  if (text.length === 0) return 0
  const rect = ta.getBoundingClientRect()
  /** 행(.editor-line)은 textarea 보다 크다 — 박스 아래·구분선 쪽은 줄 끝으로 본다 */
  if (clientY >= rect.bottom - 1) {
    return text.length
  }
  if (clientY < rect.top + 1 && clientX < rect.left + 1) {
    return 0
  }

  /** 사용자가 보는 mirror 글리프를 직접 히트테스트 — 렌더링과 정확히 일치 */
  const mirror = mirrorForTextarea(ta)
  if (mirror) {
    const clusters = buildClusterRectsFromMirror(mirror, text)
    if (clusters && clusters.length) {
      const off = pickOffsetFromClusterRects(clusters, clientX, clientY)
      if (off !== null) return snapToGraphemeBoundary(text, off)
    }
  }

  const style = window.getComputedStyle(ta)
  const padLeft = parseFloat(style.paddingLeft) || 0
  const padTop = parseFloat(style.paddingTop) || 0

  // measurement DOM은 document 좌표계의 절대 left/top을 쓰므로
  // 포인터도 동일 공간으로 맞춘다. 스크롤은 상대 오프셋으로 보정.
  const probes = getCachedProbes(ta, text, style)
  if (probes && probes.length) {
    // probes는 measureHost(좌측 숨김) 기준 절대좌표 → content 로컬로 변환
    const hostLeft = probes[0]!.left
    // 실제로는 각 probe.left가 host 기준. 첫 오프셋(0)의 left를 origin으로.
    const originProbe = probes.find((p) => p.offset === 0) ?? probes[0]!
    const localX = clientX - (rect.left + padLeft) + ta.scrollLeft
    const localY = clientY - (rect.top + padTop) + ta.scrollTop
    // probes를 origin 기준 로컬로 재매핑
    const localProbes: CaretProbe[] = probes.map((p) => ({
      offset: p.offset,
      left: p.left - originProbe.left,
      top: p.top - originProbe.top,
      bottom: p.bottom - originProbe.top
    }))
    void hostLeft
    return snapToGraphemeBoundary(text, offsetFromProbes(localProbes, localX, localY))
  }

  return snapToGraphemeBoundary(text, canvasFallbackOffset(ta, text, style, clientX, clientY))
}
