import { describe, expect, it } from 'vitest'
import {
  graphemeBoundaries,
  nativeAnchorOffsetFromTextarea,
  offsetFromMidpoints,
  snapToCodePointBoundary,
  snapToGraphemeBoundary
} from './editorCaretFromPoint'

describe('snapToCodePointBoundary', () => {
  it('does not split surrogate pairs', () => {
    const text = 'a🔴b'
    // 🔴 is U+1F534 = high+low surrogate at indices 1,2
    expect(snapToCodePointBoundary(text, 2)).toBe(3)
    expect(snapToCodePointBoundary(text, 1)).toBe(1)
    expect(snapToCodePointBoundary(text, 0)).toBe(0)
  })
})

describe('graphemeBoundaries / snapToGraphemeBoundary', () => {
  it('lists boundaries including start and end', () => {
    expect(graphemeBoundaries('ab')).toEqual([0, 1, 2])
  })

  it('keeps emoji as one grapheme unit when Segmenter available', () => {
    const text = 'a🔴b'
    const bounds = graphemeBoundaries(text)
    expect(bounds[0]).toBe(0)
    expect(bounds).toContain(text.length)
    // should not expose the low-surrogate index alone as a preferred snap from mid
    const mid = 2
    const snapped = snapToGraphemeBoundary(text, mid)
    expect(snapped === 1 || snapped === 3).toBe(true)
  })
})

describe('offsetFromMidpoints', () => {
  it('picks nearer caret by glyph midpoint (not right edge)', () => {
    // chars of width 10: caret at 0,10,20
    const boundaries = [0, 1, 2]
    const widths = [0, 10, 20]
    // x=6 is past midpoint of first glyph (5) → offset 1
    expect(offsetFromMidpoints(boundaries, widths, 6)).toBe(1)
    // x=4 is before midpoint → offset 0
    expect(offsetFromMidpoints(boundaries, widths, 4)).toBe(0)
    // x=15 → closer to 10 than 20? dist 5 vs 5 — prefer lower index on tie in our impl via <
    // actually equal distance: we use < so first wins when equal... check: d===bestDist && boundaries[i] < best
    expect(offsetFromMidpoints(boundaries, widths, 15)).toBe(1)
  })
})

describe('nativeAnchorOffsetFromTextarea', () => {
  it('uses selectionStart for forward selection', () => {
    const ta = {
      selectionStart: 3,
      selectionEnd: 8,
      selectionDirection: 'forward' as const
    } as HTMLTextAreaElement
    expect(nativeAnchorOffsetFromTextarea(ta)).toBe(3)
  })

  it('uses selectionEnd for backward selection', () => {
    const ta = {
      selectionStart: 2,
      selectionEnd: 9,
      selectionDirection: 'backward' as const
    } as HTMLTextAreaElement
    expect(nativeAnchorOffsetFromTextarea(ta)).toBe(9)
  })

  it('defaults to selectionStart when direction is none', () => {
    const ta = {
      selectionStart: 4,
      selectionEnd: 4,
      selectionDirection: 'none' as const
    } as HTMLTextAreaElement
    expect(nativeAnchorOffsetFromTextarea(ta)).toBe(4)
  })
})

/**
 * 줄 경계 전환 시 앵커 불변 계약:
 * native phase의 selectionStart/End 앵커가 virtual 전환 후 그대로 유지되어야 한다.
 */
describe('virtual transition anchor contract', () => {
  function virtualAnchorFromNative(ta: {
    selectionStart: number
    selectionEnd: number
    selectionDirection: 'forward' | 'backward' | 'none'
  }): number {
    return nativeAnchorOffsetFromTextarea(ta as HTMLTextAreaElement)
  }

  it('preserves forward drag anchor across line boundary', () => {
    // 같은 줄에서 2→10 드래그 중 아래 줄로 진입
    expect(
      virtualAnchorFromNative({
        selectionStart: 2,
        selectionEnd: 10,
        selectionDirection: 'forward'
      })
    ).toBe(2)
  })

  it('preserves backward drag anchor across line boundary', () => {
    expect(
      virtualAnchorFromNative({
        selectionStart: 1,
        selectionEnd: 12,
        selectionDirection: 'backward'
      })
    ).toBe(12)
  })
})
