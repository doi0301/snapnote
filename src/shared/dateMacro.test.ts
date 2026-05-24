import { describe, expect, it } from 'vitest'
import { formatTodayShort, tryExpandTodayMacro } from './dateMacro'

describe('formatTodayShort', () => {
  it('formats as yy-mm-dd', () => {
    expect(formatTodayShort(new Date(2025, 4, 24))).toBe('25-05-24')
  })
})

describe('tryExpandTodayMacro', () => {
  it('expands #오늘 at end of beforeCursor', () => {
    const fixed = new Date(2025, 4, 24)
    const r = tryExpandTodayMacro('메모 #오늘', ' ', fixed)
    expect(r).toEqual({ text: '메모 25-05-24 ', cursor: '메모 25-05-24'.length })
  })

  it('returns null when macro not at cursor', () => {
    expect(tryExpandTodayMacro('오늘', ' ', new Date())).toBeNull()
    expect(tryExpandTodayMacro('#오늘날', ' ', new Date())).toBeNull()
  })
})
