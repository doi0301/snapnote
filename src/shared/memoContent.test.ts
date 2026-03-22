import { describe, expect, it } from 'vitest'
import { memoHasTextContent } from './memoContent'
import type { Memo } from './types'

function m(partial: Pick<Memo, 'content'>): Pick<Memo, 'content'> {
  return partial
}

describe('memoHasTextContent', () => {
  it('false for empty lines', () => {
    expect(memoHasTextContent(m({ content: [] }))).toBe(false)
    expect(memoHasTextContent(m({ content: [{ id: '1', text: '', indentLevel: 0, formatting: {} }] }))).toBe(false)
    expect(memoHasTextContent(m({ content: [{ id: '1', text: '  \n\t', indentLevel: 0, formatting: {} }] }))).toBe(false)
  })

  it('true when any line has non-whitespace', () => {
    expect(memoHasTextContent(m({ content: [{ id: '1', text: 'a', indentLevel: 0, formatting: {} }] }))).toBe(true)
    expect(
      memoHasTextContent(
        m({
          content: [
            { id: '1', text: '', indentLevel: 0, formatting: {} },
            { id: '2', text: 'x', indentLevel: 0, formatting: {} }
          ]
        })
      )
    ).toBe(true)
  })
})
