/**
 * 멀티 모니터 workArea 기준 창 위치 스냅 (TRD S2-02)
 * 화면 가장자리: `SNAP_SCREEN_EDGE_PX`, 편집창끼리: `SNAP_EDIT_WINDOW_TO_WINDOW_PX`
 */
export interface SnapWorkArea {
  x: number
  y: number
  width: number
  height: number
}

export interface SnapBounds {
  x: number
  y: number
  width: number
  height: number
}

/** 가장자리별 스냅 래치 (히스테리시스: 붙기·떼기 임계 분리) */
export interface EdgeSnapLatch {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

export function createEmptyEdgeLatch(): EdgeSnapLatch {
  return { left: false, right: false, top: false, bottom: false }
}

export interface SnapHysteresisOptions {
  snapInPx: number
  /** 래치된 변에서 이 거리 이상 벗어나야 스냅 해제 (snapIn보다 커야 함) */
  releasePx: number
}

const DEFAULT_HYSTERESIS: SnapHysteresisOptions = {
  snapInPx: 20,
  releasePx: 28
}

/** 폴디드·일반 창 — 모니터 workArea 가장자리 스냅 허용 거리 (픽셀) */
export const SNAP_SCREEN_EDGE_PX = 52

/** 편집 창끼리 — 변·모서리 맞춤 스냅 허용 거리 */
export const SNAP_EDIT_WINDOW_TO_WINDOW_PX = 36

/**
 * 래치가 있으면 “떼기” 거리 전까지 가장자리에 고정, 없으면 snapIn 이내면 붙이기.
 * workArea는 창 중심(또는 겹침)으로 하나만 골라 적용해 멀티 모니터에서 래치가 꼬이지 않게 함.
 */
export function computeSnappedPositionWithLatch(
  newBounds: SnapBounds,
  workAreas: SnapWorkArea[],
  latchIn: EdgeSnapLatch,
  options: SnapHysteresisOptions = DEFAULT_HYSTERESIS
): { x: number; y: number; latch: EdgeSnapLatch } {
  const latch = { ...latchIn }
  const { snapInPx, releasePx } = options

  if (!workAreas.length) {
    return { x: newBounds.x, y: newBounds.y, latch: createEmptyEdgeLatch() }
  }

  const wa = pickWorkAreaForWindow(newBounds, workAreas) ?? workAreas[0]
  if (!wa) {
    return { x: newBounds.x, y: newBounds.y, latch: createEmptyEdgeLatch() }
  }

  let x = newBounds.x
  let y = newBounds.y
  const { width: w, height: h } = newBounds

  if (latch.left) {
    if (newBounds.x - wa.x > releasePx) {
      latch.left = false
      x = newBounds.x
    } else {
      x = wa.x
    }
  } else if (latch.right) {
    const gapRight = wa.x + wa.width - (newBounds.x + w)
    if (gapRight > releasePx) {
      latch.right = false
      x = newBounds.x
    } else {
      x = wa.x + wa.width - w
    }
  } else {
    const distL = Math.abs(newBounds.x - wa.x)
    const distR = Math.abs(newBounds.x + w - (wa.x + wa.width))
    if (distL <= snapInPx && distL <= distR) {
      x = wa.x
      latch.left = true
    } else if (distR <= snapInPx) {
      x = wa.x + wa.width - w
      latch.right = true
    } else {
      x = newBounds.x
    }
  }

  if (latch.top) {
    if (newBounds.y - wa.y > releasePx) {
      latch.top = false
      y = newBounds.y
    } else {
      y = wa.y
    }
  } else if (latch.bottom) {
    const gapBottom = wa.y + wa.height - (newBounds.y + h)
    if (gapBottom > releasePx) {
      latch.bottom = false
      y = newBounds.y
    } else {
      y = wa.y + wa.height - h
    }
  } else {
    const distT = Math.abs(newBounds.y - wa.y)
    const distB = Math.abs(newBounds.y + h - (wa.y + wa.height))
    if (distT <= snapInPx && distT <= distB) {
      y = wa.y
      latch.top = true
    } else if (distB <= snapInPx) {
      y = wa.y + wa.height - h
      latch.bottom = true
    } else {
      y = newBounds.y
    }
  }

  return { x, y, latch }
}

/**
 * 히스테리시스 없음 (단위 테스트·레거시 호출용).
 * `computeSnappedPositionWithLatch` + 빈 래치와 동등하지 않음(래치 없이 매 프레임 동일 임계).
 */
export function computeSnappedPosition(
  newBounds: SnapBounds,
  workAreas: SnapWorkArea[],
  thresholdPx = 20
): { x: number; y: number } {
  const pick = pickWorkAreaForWindow(newBounds, workAreas)
  const areas = pick ? [pick] : workAreas.length ? workAreas : []

  let x = newBounds.x
  let y = newBounds.y
  const { width: w, height: h } = newBounds

  for (const wa of areas) {
    const leftDist = Math.abs(x - wa.x)
    const rightDist = Math.abs(x + w - (wa.x + wa.width))
    const topDist = Math.abs(y - wa.y)
    const bottomDist = Math.abs(y + h - (wa.y + wa.height))

    if (leftDist <= thresholdPx && leftDist <= rightDist) {
      x = wa.x
    } else if (rightDist <= thresholdPx) {
      x = wa.x + wa.width - w
    }

    if (topDist <= thresholdPx && topDist <= bottomDist) {
      y = wa.y
    } else if (bottomDist <= thresholdPx) {
      y = wa.y + wa.height - h
    }
  }

  return { x, y }
}

/** 1차원: 현재값에 가장 가깝고 threshold 이내인 후보만 채택 */
export function pickBestSnap1D(current: number, candidates: number[], thresholdPx: number): number {
  let best = current
  let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.abs(c - current)
    if (d <= thresholdPx && d < bestDist) {
      best = c
      bestDist = d
    }
  }
  return best
}

/**
 * 편집 창 드래그 스냅: 먼저 모니터 가장자리, 이어 다른 편집 창과 변 맞춤(좌-우 붙임, 좌-좌 정렬 등)
 */
export function computeEditWindowSnapPosition(
  bounds: SnapBounds,
  workAreas: SnapWorkArea[],
  otherEditWindows: SnapBounds[],
  screenEdgePx: number = SNAP_SCREEN_EDGE_PX,
  windowSnapPx: number = SNAP_EDIT_WINDOW_TO_WINDOW_PX
): { x: number; y: number } {
  const { x: sx, y: sy } = computeSnappedPosition(bounds, workAreas, screenEdgePx)
  const b: SnapBounds = { ...bounds, x: sx, y: sy }
  if (!otherEditWindows.length) {
    return { x: sx, y: sy }
  }

  const { width: w, height: h } = b
  const xCands: number[] = []
  const yCands: number[] = []
  for (const o of otherEditWindows) {
    xCands.push(
      o.x + o.width,
      o.x - w,
      o.x,
      o.x + o.width - w
    )
    yCands.push(
      o.y + o.height,
      o.y - h,
      o.y,
      o.y + o.height - h
    )
  }
  return {
    x: pickBestSnap1D(b.x, xCands, windowSnapPx),
    y: pickBestSnap1D(b.y, yCands, windowSnapPx)
  }
}

/** 창 중심이 들어 있는 workArea 우선, 없으면 겹치는 면적 최대 */
function pickWorkAreaForWindow(
  bounds: SnapBounds,
  workAreas: SnapWorkArea[]
): SnapWorkArea | null {
  if (!workAreas.length) return null
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  for (const wa of workAreas) {
    if (
      cx >= wa.x &&
      cx < wa.x + wa.width &&
      cy >= wa.y &&
      cy < wa.y + wa.height
    ) {
      return wa
    }
  }
  let best: SnapWorkArea | null = null
  let bestArea = 0
  for (const wa of workAreas) {
    const a = intersectionArea(bounds, wa)
    if (a > bestArea) {
      bestArea = a
      best = wa
    }
  }
  return best
}

function intersectionArea(b: SnapBounds, wa: SnapWorkArea): number {
  const x1 = Math.max(b.x, wa.x)
  const y1 = Math.max(b.y, wa.y)
  const x2 = Math.min(b.x + b.width, wa.x + wa.width)
  const y2 = Math.min(b.y + b.height, wa.y + wa.height)
  const iw = Math.max(0, x2 - x1)
  const ih = Math.max(0, y2 - y1)
  return iw * ih
}
