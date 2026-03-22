import { describe, expect, it } from 'vitest'
import {
  computeEditWindowSnapPosition,
  computeSnappedPosition,
  computeSnappedPositionWithLatch,
  createEmptyEdgeLatch,
  pickBestSnap1D,
  type SnapWorkArea
} from './edgeSnap'

const wa1920: SnapWorkArea = { x: 0, y: 0, width: 1920, height: 1040 }

describe('computeSnappedPosition', () => {
  it('snaps to left edge within threshold', () => {
    const r = computeSnappedPosition(
      { x: 12, y: 400, width: 280, height: 120 },
      [wa1920],
      20
    )
    expect(r.x).toBe(0)
    expect(r.y).toBe(400)
  })

  it('snaps to right edge within threshold', () => {
    const w = 280
    const r = computeSnappedPosition(
      { x: wa1920.width - w - 15, y: 100, width: w, height: 120 },
      [wa1920],
      20
    )
    expect(r.x).toBe(wa1920.width - w)
    expect(r.y).toBe(100)
  })

  it('snaps to top edge', () => {
    const r = computeSnappedPosition(
      { x: 300, y: 8, width: 200, height: 100 },
      [wa1920],
      20
    )
    expect(r.x).toBe(300)
    expect(r.y).toBe(0)
  })

  it('snaps to bottom edge', () => {
    const h = 100
    const r = computeSnappedPosition(
      { x: 400, y: wa1920.height - h - 10, width: 200, height: h },
      [wa1920],
      20
    )
    expect(r.x).toBe(400)
    expect(r.y).toBe(wa1920.height - h)
  })

  it('snaps to left-top corner', () => {
    const r = computeSnappedPosition(
      { x: 10, y: 12, width: 200, height: 80 },
      [wa1920],
      20
    )
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
  })

  it('does not snap when farther than threshold', () => {
    const r = computeSnappedPosition(
      { x: 80, y: 200, width: 200, height: 100 },
      [wa1920],
      20
    )
    expect(r.x).toBe(80)
    expect(r.y).toBe(200)
  })

  it('uses workArea containing window center (second monitor)', () => {
    const left: SnapWorkArea = { x: 0, y: 0, width: 1920, height: 1080 }
    const right: SnapWorkArea = { x: 1920, y: 0, width: 1920, height: 1080 }
    const w = 300
    const h = 200
    const r = computeSnappedPosition(
      { x: 1920 + 18, y: 400, width: w, height: h },
      [left, right],
      20
    )
    expect(r.x).toBe(1920)
    expect(r.y).toBe(400)
  })
})

describe('computeSnappedPositionWithLatch', () => {
  const wa = { x: 0, y: 0, width: 1920, height: 1040 }
  const opts = { snapInPx: 20, releasePx: 28 }

  it('keeps left latch until release distance', () => {
    const latched = { ...createEmptyEdgeLatch(), left: true }
    const still = computeSnappedPositionWithLatch(
      { x: 12, y: 400, width: 280, height: 120 },
      [wa],
      latched,
      opts
    )
    expect(still.x).toBe(0)
    expect(still.latch.left).toBe(true)

    const released = computeSnappedPositionWithLatch(
      { x: 35, y: 400, width: 280, height: 120 },
      [wa],
      latched,
      opts
    )
    expect(released.x).toBe(35)
    expect(released.latch.left).toBe(false)
  })

  it('releases right latch when gap exceeds releasePx', () => {
    const w = 280
    const latched = { ...createEmptyEdgeLatch(), right: true }
    const still = computeSnappedPositionWithLatch(
      { x: wa.width - w - 8, y: 100, width: w, height: 120 },
      [wa],
      latched,
      opts
    )
    expect(still.x).toBe(wa.width - w)
    expect(still.latch.right).toBe(true)

    const released = computeSnappedPositionWithLatch(
      { x: wa.width - w - 40, y: 100, width: w, height: 120 },
      [wa],
      latched,
      opts
    )
    expect(released.x).toBe(wa.width - w - 40)
    expect(released.latch.right).toBe(false)
  })

  it('snaps in when not latched', () => {
    const r = computeSnappedPositionWithLatch(
      { x: 10, y: 200, width: 200, height: 100 },
      [wa],
      createEmptyEdgeLatch(),
      opts
    )
    expect(r.x).toBe(0)
    expect(r.latch.left).toBe(true)
  })
})

describe('pickBestSnap1D', () => {
  it('picks closest candidate within threshold', () => {
    expect(pickBestSnap1D(100, [130, 105, 200], 40)).toBe(105)
  })

  it('keeps current when no candidate in range', () => {
    expect(pickBestSnap1D(100, [160, 170], 20)).toBe(100)
  })
})

describe('computeEditWindowSnapPosition', () => {
  const wa: SnapWorkArea = { x: 0, y: 0, width: 1920, height: 1040 }

  it('snaps moving window left edge to other right edge', () => {
    const other = { x: 400, y: 200, width: 300, height: 400 }
    const moving = { x: 718, y: 520, width: 280, height: 350 }
    const r = computeEditWindowSnapPosition(moving, [wa], [other], 20, 36)
    expect(r.x).toBe(700)
    expect(r.y).toBe(520)
  })

  it('snaps tops when horizontally overlapping', () => {
    const other = { x: 100, y: 300, width: 400, height: 300 }
    const moving = { x: 150, y: 325, width: 300, height: 250 }
    const r = computeEditWindowSnapPosition(moving, [wa], [other], 20, 40)
    expect(r.x).toBe(150)
    expect(r.y).toBe(300)
  })
})
