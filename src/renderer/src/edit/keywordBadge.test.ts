import { describe, expect, it } from 'vitest'
import { findKeywordRanges } from './InlineSpan'

function findKeywords(text: string): string[] {
  return findKeywordRanges(text).map((r) => text.slice(r.start, r.end))
}

describe('keyword badge pattern (space 1개 허용, space 2개 종료)', () => {
  it('짧은 태그 사이에 공백이 하나뿐이면 다음 태그까지 이어붙는다', () => {
    expect(findKeywords('hello #work #plan world')).toEqual(['#work ', '#plan world'])
  })

  it('splits on hash so each #token starts fresh', () => {
    expect(findKeywords('#a#b')).toEqual(['#a', '#b'])
  })

  it('ignores lone hash (다음 글자가 공백이거나 없음)', () => {
    expect(findKeywords('x # y')).toEqual([])
    expect(findKeywords('trailing #')).toEqual([])
  })

  it('공백 1칸은 유지하고 여러 단어 키워드를 허용한다', () => {
    expect(findKeywords('#project alpha done')).toEqual(['#project alpha done'])
  })

  it('공백 2번 연속이면 그 지점에서 끊고 이후는 일반 텍스트로 남긴다', () => {
    expect(findKeywords('#work  next word')).toEqual(['#work'])
  })

  it('공백 3개 이상도 2개 이상으로 취급해 끊는다', () => {
    expect(findKeywords('#work   next')).toEqual(['#work'])
  })

  it('줄바꿈은 스페이스 규칙과 무관하게 항상 즉시 끊는다', () => {
    expect(findKeywords('#work\nnext')).toEqual(['#work'])
  })

  it('탭도 즉시 끊는다', () => {
    expect(findKeywords('#work\tnext')).toEqual(['#work'])
  })

  it('다른 #를 만나면 항상 새 키워드로 끊는다 (공백 1개를 물고 있어도)', () => {
    expect(findKeywords('#a b#c')).toEqual(['#a b', '#c'])
  })
})
