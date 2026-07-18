import { describe, expect, it } from 'vitest'
import {
  graphemeBoundaries,
  nativeAnchorOffsetFromTextarea,
  offsetFromMidpoints,
  pickOffsetFromClusterRects,
  snapToCodePointBoundary,
  snapToGraphemeBoundary,
  type ClusterRect
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

describe('pickOffsetFromClusterRects', () => {
  /** 폭 10, 높이 20 글자를 rows×cols로 배치 */
  function cluster(
    start: number,
    col: number,
    row: number,
    opts?: { newline?: boolean; width?: number }
  ): ClusterRect {
    const w = opts?.width ?? 10
    return {
      start,
      end: start + 1,
      left: col * 10,
      right: col * 10 + w,
      top: row * 20,
      bottom: row * 20 + 20,
      newline: Boolean(opts?.newline)
    }
  }

  it('picks offset by glyph midpoint within a row', () => {
    const cs = [cluster(0, 0, 0), cluster(1, 1, 0), cluster(2, 2, 0)]
    expect(pickOffsetFromClusterRects(cs, 4, 10)).toBe(0) // 첫 글자 중점(5) 이전
    expect(pickOffsetFromClusterRects(cs, 6, 10)).toBe(1) // 첫 글자 중점 이후
    expect(pickOffsetFromClusterRects(cs, 999, 10)).toBe(3) // 행 오른쪽 끝 너머 → 행 끝
  })

  it('returns row start without off-by-one at wrapped row start', () => {
    // "abcd" 가 2글자씩 wrap: row0 = a,b / row1 = c,d
    const cs = [cluster(0, 0, 0), cluster(1, 1, 0), cluster(2, 0, 1), cluster(3, 1, 1)]
    // 두 번째 시각 행의 왼쪽 끝 클릭 → wrap 지점 오프셋 2 (3이 아니어야 함)
    expect(pickOffsetFromClusterRects(cs, 0, 30)).toBe(2)
    expect(pickOffsetFromClusterRects(cs, 999, 30)).toBe(4)
  })

  it('treats newline cluster as end-of-row, not next-line start', () => {
    // "ab\ncd": row0 = a,b,\n / row1 = c,d
    const cs = [
      cluster(0, 0, 0),
      cluster(1, 1, 0),
      cluster(2, 2, 0, { newline: true, width: 0 }),
      cluster(3, 0, 1),
      cluster(4, 1, 1)
    ]
    // 첫 행 오른쪽 여백 클릭 → \n 앞(2), 다음 줄 시작(3) 아님
    expect(pickOffsetFromClusterRects(cs, 999, 10)).toBe(2)
    expect(pickOffsetFromClusterRects(cs, 999, 30)).toBe(5)
  })

  it('snaps to nearest row when y is outside all rows', () => {
    const cs = [cluster(0, 0, 0), cluster(1, 1, 0), cluster(2, 0, 1), cluster(3, 1, 1)]
    expect(pickOffsetFromClusterRects(cs, 0, -50)).toBe(0)
    expect(pickOffsetFromClusterRects(cs, 999, 500)).toBe(4)
  })

  it('returns null for empty cluster list', () => {
    expect(pickOffsetFromClusterRects([], 0, 0)).toBe(null)
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
