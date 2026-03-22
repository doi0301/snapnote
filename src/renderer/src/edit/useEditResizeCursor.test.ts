import { describe, expect, it } from 'vitest'
import { resizeCursorForClientPos } from './useEditResizeCursor'

describe('resizeCursorForClientPos', () => {
  const W = 400
  const H = 500

  it('bottom edge', () => {
    expect(resizeCursorForClientPos(200, H - 4, W, H)).toBe('s-resize')
  })

  it('bottom-left corner', () => {
    expect(resizeCursorForClientPos(4, H - 4, W, H)).toBe('sw-resize')
  })

  it('left edge below title', () => {
    expect(resizeCursorForClientPos(4, 200, W, H)).toBe('w-resize')
  })

  it('right edge below title', () => {
    expect(resizeCursorForClientPos(W - 4, 200, W, H)).toBe('e-resize')
  })

  it('top-left corner', () => {
    expect(resizeCursorForClientPos(4, 4, W, H)).toBe('nw-resize')
  })

  it('top-right title strip: no ne cursor (overlaps buttons)', () => {
    expect(resizeCursorForClientPos(W - 4, 4, W, H)).toBe('')
  })

  it('center has no resize cursor', () => {
    expect(resizeCursorForClientPos(200, 200, W, H)).toBe('')
  })
})
