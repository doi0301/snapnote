/**
 * 드래그 중 마지막 줄 textarea 위에 포인터가 올라가지 않아도 줄을 찾는다.
 *
 * elementFromPoint 만 쓰면 줄 경계에서 아래쪽 textarea 가 잡혀, 위로 드래그할 때
 * 의도보다 한 줄 아래까지 선택되는 경우가 많다. 수직 거리로 가장 가까운 줄을 고르고,
 * 동일 거리(두 줄 사이)면 인접한 두 줄이면 갭의 수직 중점으로 구분하고,
 * 그 외에는 앵커 줄 기준으로 보조한다.
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
    if (clientX < r.left || clientX > r.right) continue
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

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')
  }
  return measureCtx
}

/** [start, end) 한 시각 줄: pre-wrap + 최대 너비에 맞는 최장 접두(줄바꿈 전까지) */
function longestPrefixFits(
  text: string,
  start: number,
  maxWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const firstNl = text.indexOf('\n', start)
  let hi = firstNl === -1 || firstNl === start ? text.length : firstNl
  let lo = start + 1
  let best = start
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const w = ctx.measureText(text.slice(start, mid)).width
    if (w <= maxWidth) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (best > start) return best
  return start + 1
}

function buildVisualLines(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D
): Array<{ start: number; end: number }> {
  const lines: Array<{ start: number; end: number }> = []
  let pos = 0
  while (pos < text.length) {
    if (text[pos] === '\n') {
      lines.push({ start: pos, end: pos + 1 })
      pos++
      continue
    }
    const end = longestPrefixFits(text, pos, maxWidth, ctx)
    lines.push({ start: pos, end })
    pos = end
  }
  return lines
}

const visualLinesCache = new WeakMap<
  HTMLTextAreaElement,
  { value: string; maxWidth: number; lines: Array<{ start: number; end: number }> }
>()

function getCachedVisualLines(
  ta: HTMLTextAreaElement,
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D
): Array<{ start: number; end: number }> {
  const prev = visualLinesCache.get(ta)
  if (prev && prev.value === text && prev.maxWidth === maxWidth) {
    return prev.lines
  }
  const lines = buildVisualLines(text, maxWidth, ctx)
  visualLinesCache.set(ta, { value: text, maxWidth, lines })
  return lines
}

function offsetInRowFromX(rowText: string, relX: number, ctx: CanvasRenderingContext2D): number {
  if (rowText.length === 0) return 0
  const rx = Math.max(0, relX)
  let lo = 0
  let hi = rowText.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const w = ctx.measureText(rowText.slice(0, mid)).width
    if (w < rx) lo = mid
    else hi = mid - 1
  }
  return Math.min(lo, rowText.length)
}

/**
 * textarea 내 문자 오프셋 (pre-wrap 줄바꿈 반영; 캔버스 재사용으로 드래그 시 떨림 완화)
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
  const style = window.getComputedStyle(ta)
  const font = `${style.fontSize} ${style.fontFamily}`
  const padLeft = parseFloat(style.paddingLeft) || 0
  const padRight = parseFloat(style.paddingRight) || 0
  const padTop = parseFloat(style.paddingTop) || 0
  /** 서브픽셀에서 인접 오프셋이 번갈아 잡히는 것 완화 */
  const relX = Math.round(clientX - rect.left - padLeft + ta.scrollLeft)
  const relY = Math.round(clientY - rect.top - padTop + ta.scrollTop)

  const ctx = getMeasureCtx()
  if (!ctx) {
    return Math.min(
      text.length,
      Math.max(0, Math.round((relX / Math.max(rect.width, 1)) * text.length))
    )
  }
  ctx.font = font
  const maxWidth = Math.max(1, ta.clientWidth - padLeft - padRight)
  const fontSize = parseFloat(style.fontSize) || 14
  const lineHeightStr = style.lineHeight
  const lineHeightPx =
    lineHeightStr === 'normal' ? fontSize * 1.38 : parseFloat(lineHeightStr) || fontSize * 1.38

  if (relY < 0) return 0
  if (relY >= ta.scrollHeight) return text.length

  const lines = getCachedVisualLines(ta, text, maxWidth, ctx)
  if (lines.length === 0) return 0

  let y = 0
  for (let r = 0; r < lines.length; r++) {
    const { start, end } = lines[r]!
    const nextY = y + lineHeightPx
    const lastRow = r === lines.length - 1
    if (relY >= y && (relY < nextY || lastRow)) {
      let rowStart = start
      let rowEnd = end
      if (text[rowStart] === '\n') {
        return Math.min(rowStart + 1, text.length)
      }
      if (end > start && text[end - 1] === '\n') {
        rowEnd = end - 1
      }
      const rowText = text.slice(rowStart, rowEnd)
      const offsetInRow = offsetInRowFromX(rowText, relX, ctx)
      return Math.min(rowStart + offsetInRow, text.length)
    }
    y = nextY
  }
  return text.length
}
