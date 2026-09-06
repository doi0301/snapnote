import { describe, expect, it } from 'vitest'
import { MEMO_COLOR_PALETTE, isMemoColorKey, pickRandomMemoColor } from './memoColors'

describe('memoColors', () => {
  it('has exactly 12 distinct colors including the legacy 3', () => {
    expect(MEMO_COLOR_PALETTE).toHaveLength(12)
    expect(new Set(MEMO_COLOR_PALETTE).size).toBe(12)
    expect(MEMO_COLOR_PALETTE).toEqual(expect.arrayContaining(['coral', 'green', 'blue']))
  })

  it('isMemoColorKey recognizes palette members only', () => {
    expect(isMemoColorKey('coral')).toBe(true)
    expect(isMemoColorKey('rose')).toBe(true)
    expect(isMemoColorKey('nope')).toBe(false)
  })

  it('picks a color not currently used when some are free', () => {
    const used = MEMO_COLOR_PALETTE.slice(0, 11) // all but the last
    for (let i = 0; i < 20; i++) {
      expect(pickRandomMemoColor(used)).toBe(MEMO_COLOR_PALETTE[11])
    }
  })

  it('never repeats the same color deterministically when many are used (regression for the old rotation bug)', () => {
    // 11개 색이 이미 열린 창에서 쓰이는 상황을 반복해도, 남은 1개 색만 매번 골라야 한다
    // (버그 재현판: 예전 로직은 활성 메모 개수 % 3 이라 특정 색에 고착됐다)
    const usedAllButOne = MEMO_COLOR_PALETTE.slice(1)
    const results = new Set<string>()
    for (let i = 0; i < 30; i++) results.add(pickRandomMemoColor(usedAllButOne))
    expect(results).toEqual(new Set([MEMO_COLOR_PALETTE[0]]))
  })

  it('falls back to the full palette once every color is in use', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(pickRandomMemoColor(MEMO_COLOR_PALETTE))
    // 넉넉히 반복하면 12색 전체가 골고루 나와야 한다 (완전 소진 시 전체 팔레트에서 랜덤)
    expect(seen.size).toBeGreaterThan(1)
    for (const c of seen) expect(MEMO_COLOR_PALETTE).toContain(c)
  })

  it('returns a valid palette color when nothing is in use', () => {
    for (let i = 0; i < 20; i++) {
      expect(MEMO_COLOR_PALETTE).toContain(pickRandomMemoColor([]))
    }
  })
})
