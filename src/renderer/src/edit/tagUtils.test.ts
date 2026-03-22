import { describe, expect, it } from 'vitest'
import { collectAllTags, parseHashAtCursor, parseTagString, tagsToInputString } from './tagUtils'

describe('tagUtils', () => {
  it('parseTagString dedupes and preserves first occurrence order', () => {
    expect(parseTagString('#a #b #a')).toEqual(['a', 'b'])
    expect(parseTagString('hello #태그1 world #태그2')).toEqual(['태그1', '태그2'])
  })

  it('tagsToInputString round-trips shape', () => {
    expect(tagsToInputString(['업무', '계획'])).toBe('#업무 #계획 ')
  })

  it('collectAllTags merges unique', () => {
    expect(
      collectAllTags([
        { tags: ['b', 'a'] },
        { tags: ['a', 'c'] }
      ])
    ).toEqual(['a', 'b', 'c'])
  })

  it('parseHashAtCursor finds #query at end', () => {
    const full = 'hello #업'
    const h = parseHashAtCursor(full, full.length)
    expect(h).toEqual({ start: 6, query: '업' })
  })

  it('parseHashAtCursor returns null when not in hash token', () => {
    expect(parseHashAtCursor('hello', 5)).toBeNull()
  })
})
