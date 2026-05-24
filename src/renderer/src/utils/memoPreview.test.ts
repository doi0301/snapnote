import { describe, expect, it } from 'vitest'
import { keycapStorageChar } from '@shared/keycapChar'
import type { EditorLine } from '@shared/types'
import { firstLinePreviewSpanned, fullContentPreviewLines, plainLinePreview } from './memoPreview'

function line(text: string, spans?: EditorLine['spans']): EditorLine[] {
  return [{ id: '1', text, spans, formatting: {}, indentLevel: 0 }]
}

describe('firstLinePreviewSpanned', () => {
  it('keeps keycap span after clip', () => {
    const k = keycapStorageChar(1)
    const { text, spans } = firstLinePreviewSpanned(
      line(`${k}abc`, [{ start: 0, end: 1, keycap: true }]),
      10
    )
    expect(text).toBe(`${k}abc`)
    expect(spans).toEqual([{ start: 0, end: 1, keycap: true }])
  })

  it('adjusts spans when trimming leading spaces', () => {
    const k = keycapStorageChar(2)
    const { text, spans } = firstLinePreviewSpanned(
      line(`  ${k}`, [{ start: 2, end: 3, keycap: true }]),
      10
    )
    expect(text).toBe(k)
    expect(spans).toEqual([{ start: 0, end: 1, keycap: true }])
  })

  it('clamps span end when truncating with ellipsis', () => {
    const k = keycapStorageChar(3)
    const { text, spans } = firstLinePreviewSpanned(
      line(`${k}abcdef`, [{ start: 0, end: 1, keycap: true }]),
      3
    )
    expect(text).toBe(`${k}ab…`)
    expect(spans).toEqual([{ start: 0, end: 1, keycap: true }])
  })

  it('returns ellipsis for empty first line', () => {
    expect(firstLinePreviewSpanned(line('   '), 10)).toEqual({ text: '…' })
  })
})

describe('fullContentPreviewLines', () => {
  it('returns keycap spans for multi-line content', () => {
    const a = keycapStorageChar(1)
    const b = keycapStorageChar(2)
    const lines: EditorLine[] = [
      { id: '1', text: `${a} ${b}`, spans: [{ start: 0, end: 1, keycap: true }, { start: 2, end: 3, keycap: true }], formatting: {}, indentLevel: 0 },
      { id: '2', text: 'hello', formatting: {}, indentLevel: 0 }
    ]
    const preview = fullContentPreviewLines(lines, 700)
    expect(preview).toHaveLength(2)
    expect(preview[0]?.spans).toEqual([
      { start: 0, end: 1, keycap: true },
      { start: 2, end: 3, keycap: true }
    ])
    expect(preview[1]?.text).toBe('hello')
  })

  it('returns ellipsis for empty content', () => {
    expect(fullContentPreviewLines([], 10)).toEqual([{ text: '…' }])
  })

  it('infers keycap spans from fullwidth digits when spans missing', () => {
    const a = keycapStorageChar(1)
    const b = keycapStorageChar(2)
    const preview = fullContentPreviewLines(
      [{ id: '1', text: `${a} ${b}`, formatting: {}, indentLevel: 0 }],
      700
    )
    expect(preview[0]?.spans).toEqual([
      { start: 0, end: 1, keycap: true },
      { start: 2, end: 3, keycap: true }
    ])
  })
})

describe('plainLinePreview', () => {
  it('converts keycap spans to halfwidth digits', () => {
    const a = keycapStorageChar(1)
    const b = keycapStorageChar(2)
    const plain = plainLinePreview(
      line(`${a} ${b}`, [
        { start: 0, end: 1, keycap: true },
        { start: 2, end: 3, keycap: true }
      ]),
      10
    )
    expect(plain).toBe('1 2')
  })
})
