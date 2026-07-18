import { describe, expect, it } from 'vitest'

/** InlineSpan과 동일한 키워드 패턴 — 공백 단위로 끊김 */
const KEYWORD_BADGE_RE = /#[^\s#]+/g

function findKeywords(text: string): string[] {
  KEYWORD_BADGE_RE.lastIndex = 0
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = KEYWORD_BADGE_RE.exec(text)) !== null) out.push(m[0])
  return out
}

describe('keyword badge pattern', () => {
  it('matches space-delimited #keywords', () => {
    expect(findKeywords('hello #work #plan world')).toEqual(['#work', '#plan'])
  })

  it('splits on hash so each #token is separate', () => {
    expect(findKeywords('#a#b')).toEqual(['#a', '#b'])
  })

  it('ignores lone hash', () => {
    expect(findKeywords('x # y')).toEqual([])
  })
})
