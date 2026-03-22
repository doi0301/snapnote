import { describe, expect, it } from 'vitest'
import {
  addBoldOnRange,
  caretReferenceCharIndex,
  insertionIndexIfSingleChar,
  rangeFullyHasAnyHighlight,
  rangeFullyHasHighlight,
  remapSpansAfterEdit,
  singleReplacementRange,
  splitSpansAt,
  toggleHighlightColor,
  toggleSpanProperty
} from './spanFormat'

describe('singleReplacementRange', () => {
  it('insert one char', () => {
    expect(singleReplacementRange('ab', 'acb')).toEqual({ start: 1, oldEnd: 1, newEnd: 2 })
  })
  it('delete', () => {
    expect(singleReplacementRange('abc', 'ac')).toEqual({ start: 1, oldEnd: 2, newEnd: 1 })
  })
})

describe('remapSpansAfterEdit', () => {
  it('shifts span after insert before it', () => {
    const spans = [{ start: 2, end: 4, bold: true }]
    const next = remapSpansAfterEdit('abcd', 'abXcd', spans)
    expect(next).toEqual([{ start: 3, end: 5, bold: true }])
  })
  it('extends span when typing inside bold', () => {
    const spans = [{ start: 1, end: 3, bold: true }]
    const next = remapSpansAfterEdit('hello', 'heXllo', spans)
    expect(next.some((s) => s.bold && s.start <= 1 && s.end >= 4)).toBe(true)
  })
})

describe('toggleSpanProperty', () => {
  it('adds then removes bold', () => {
    let s = toggleSpanProperty([], 'bold', 1, 3, 5)
    expect(s.some((x) => x.bold && x.start === 1 && x.end === 3)).toBe(true)
    s = toggleSpanProperty(s, 'bold', 1, 3, 5)
    expect(s.filter((x) => x.bold).length).toBe(0)
  })
})

describe('splitSpansAt', () => {
  it('splits crossing span', () => {
    const [L, R] = splitSpansAt([{ start: 0, end: 4, bold: true }], 2)
    expect(L).toEqual([{ start: 0, end: 2, bold: true }])
    expect(R).toEqual([{ start: 0, end: 2, bold: true }])
  })
})

describe('insertionIndexIfSingleChar', () => {
  it('detects insert position', () => {
    expect(insertionIndexIfSingleChar('ab', 'acb')).toBe(1)
  })
})

describe('addBoldOnRange', () => {
  it('adds span', () => {
    const s = addBoldOnRange([], 0, 1)
    expect(s[0]).toMatchObject({ start: 0, end: 1, bold: true })
  })
})

describe('caretReferenceCharIndex', () => {
  it('maps end-of-text caret', () => {
    expect(caretReferenceCharIndex(3, 3)).toBe(2)
  })
})

describe('rangeFullyHasAnyHighlight', () => {
  it('detects mixed highlight span', () => {
    const s = [{ start: 0, end: 2, highlight: 'yellow' as const }]
    expect(rangeFullyHasAnyHighlight(s, 0, 2)).toBe(true)
    expect(rangeFullyHasAnyHighlight(s, 0, 3)).toBe(false)
  })
})

describe('toggleHighlightColor', () => {
  it('applies yellow then toggles off', () => {
    let s = toggleHighlightColor([], 0, 3, 'yellow', 5)
    expect(rangeFullyHasHighlight(s, 0, 3, 'yellow')).toBe(true)
    s = toggleHighlightColor(s, 0, 3, 'yellow', 5)
    expect(s.filter((x) => x.highlight === 'yellow').length).toBe(0)
  })
})
