import { describe, expect, it } from 'vitest'
import { padTableRows, tableRowsToTsv } from './tableLine'

describe('tableRowsToTsv', () => {
  it('uses tab between cells and CRLF between rows', () => {
    const tsv = tableRowsToTsv([
      ['a', 'b'],
      ['c', 'd']
    ])
    expect(tsv).toBe('a\tb\r\nc\td')
  })

  it('escapes cells with tabs', () => {
    expect(tableRowsToTsv([['a\tb', 'c']])).toBe('"a\tb"\tc')
  })
})

describe('padTableRows', () => {
  it('pads to col count', () => {
    expect(padTableRows([['a']], 5, 2)).toEqual([['a', '']])
  })
})
