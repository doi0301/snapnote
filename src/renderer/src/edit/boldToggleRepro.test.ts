import { describe, expect, it } from 'vitest'
import type { TextSpan } from '@shared/types'
import { rangeFullyHasProp, setSpanPropertyOnRange } from './spanFormat'

function isAllBold(spans: TextSpan[], a: number, b: number): boolean {
  return rangeFullyHasProp(spans, a, b, 'bold')
}

/**
 * 여러 줄/구간에 걸친 통일 토글을 모사한다(Editor.toggleBold 가상 선택 경로).
 * 선택 전체가 모두 볼드면 enable=false(전체 해제), 아니면 enable=true(전체 적용).
 */
type Seg = { spans: TextSpan[]; s: number; e: number; len: number }

function unifiedToggle(segs: Seg[]): Seg[] {
  const allBold = segs.every((g) => rangeFullyHasProp(g.spans, g.s, g.e, 'bold'))
  const enable = !allBold
  return segs.map((g) => ({
    ...g,
    spans: setSpanPropertyOnRange(g.spans, 'bold', g.s, g.e, g.len, enable)
  }))
}

describe('unified bold toggle on mixed selection', () => {
  it('single line: first press bolds all, second removes all', () => {
    const initial: TextSpan[] = [{ start: 2, end: 5, bold: true }]
    const a1 = setSpanPropertyOnRange(initial, 'bold', 0, 8, 10, true)
    expect(isAllBold(a1, 0, 8)).toBe(true)
    const enable2 = !isAllBold(a1, 0, 8)
    const a2 = setSpanPropertyOnRange(a1, 'bold', 0, 8, 10, enable2)
    expect(isAllBold(a2, 0, 8)).toBe(false)
    expect(a2.some((s) => s.bold && s.start < 8 && s.end > 0)).toBe(false)
  })

  it('multi-segment: mixed bold/non-bold -> all bold first, all clear second (no XOR)', () => {
    // 줄1: 전부 볼드, 줄2: 볼드 없음, 줄3: 일부 볼드
    let segs: Seg[] = [
      { spans: [{ start: 0, end: 6, bold: true }], s: 0, e: 6, len: 6 },
      { spans: [], s: 0, e: 6, len: 6 },
      { spans: [{ start: 1, end: 3, bold: true }], s: 0, e: 6, len: 6 }
    ]

    // 1번째: 전체 볼드 적용 (이미 볼드인 줄1도 풀리지 않아야 함)
    segs = unifiedToggle(segs)
    for (const g of segs) expect(isAllBold(g.spans, g.s, g.e)).toBe(true)

    // 2번째: 전체 해제
    segs = unifiedToggle(segs)
    for (const g of segs) expect(isAllBold(g.spans, g.s, g.e)).toBe(false)
  })

  it('setSpanPropertyOnRange enable=true on already-bold range does not duplicate', () => {
    const initial: TextSpan[] = [{ start: 0, end: 5, bold: true }]
    const out = setSpanPropertyOnRange(initial, 'bold', 0, 5, 5, true)
    expect(out).toHaveLength(1)
    expect(isAllBold(out, 0, 5)).toBe(true)
  })
})
