import { describe, expect, it } from 'vitest'
import { keycapDisplayChar, keycapStorageChar } from './keycapChar'

describe('keycapChar', () => {
  it('round-trips fullwidth storage to halfwidth display', () => {
    expect(keycapStorageChar(3)).toBe('３')
    expect(keycapDisplayChar('３')).toBe('3')
  })
})
