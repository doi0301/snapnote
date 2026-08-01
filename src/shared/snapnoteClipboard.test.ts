import { describe, expect, it } from 'vitest'
import type { EditorLine } from './types'
import {
  deserializeSnapnoteClipboard,
  embedSnapnoteInHtml,
  extractSnapnoteFromHtml,
  extractLinesForSelection,
  linesToPlainText,
  parsePayloadJson,
  payloadToJson,
  serializeLinesForClipboard,
  sliceEditorLine
} from './snapnoteClipboard'

function line(partial: Partial<EditorLine> & Pick<EditorLine, 'text'>): EditorLine {
  return {
    id: 'a',
    indentLevel: 0,
    formatting: {},
    ...partial
  }
}

describe('serializeLinesForClipboard', () => {
  it('round-trips without id', () => {
    const src = [
      line({
        text: 'hello',
        indentLevel: 2,
        formatting: { hasCheckbox: true, checkboxChecked: true, strikethrough: true },
        spans: [{ start: 0, end: 5, bold: true }]
      })
    ]
    const payload = serializeLinesForClipboard(src)
    const json = payloadToJson(payload)
    const parsed = parsePayloadJson(json)
    expect(parsed).not.toBeNull()
    const restored = deserializeSnapnoteClipboard(parsed!)
    expect(restored[0]?.text).toBe('hello')
    expect(restored[0]?.indentLevel).toBe(2)
    expect(restored[0]?.formatting.hasCheckbox).toBe(true)
    expect(restored[0]?.spans?.[0]?.bold).toBe(true)
    expect(restored[0]?.id).not.toBe('a')
  })

  it('rejects invalid version', () => {
    expect(parsePayloadJson('{"version":2,"lines":[]}')).toBeNull()
  })
})

describe('linesToPlainText', () => {
  it('uses TSV for tables', () => {
    const text = linesToPlainText([
      line({
        text: '',
        formatting: { isTable: true, tableRows: [['A', 'B']] }
      })
    ])
    expect(text).toBe('A\tB')
  })

  it('converts keycap storage digits to display digits', () => {
    const text = linesToPlainText([
      line({
        text: '\uFF11\uFF12 task',
        spans: [
          { start: 0, end: 1, keycap: true },
          { start: 1, end: 2, keycap: true }
        ]
      })
    ])
    expect(text).toBe('12 task')
  })

  it('strips SnapNote heading markers for external paste', () => {
    const text = linesToPlainText([
      line({ text: '[회의록]', formatting: { headingLevel: 1 } })
    ])
    expect(text).toBe('회의록')
  })

  it('keeps a leading bracket/paren on a plain (non-heading) line', () => {
    const text = linesToPlainText([line({ text: '(초안) 검토 부탁드립니다' })])
    expect(text).toBe('(초안) 검토 부탁드립니다')
  })
})

describe('sliceEditorLine', () => {
  it('preserves spans in slice', () => {
    const sliced = sliceEditorLine(
      line({
        text: 'abcdef',
        spans: [
          { start: 1, end: 3, bold: true },
          { start: 4, end: 6, strikethrough: true }
        ]
      }),
      1,
      5
    )
    expect(sliced.text).toBe('bcde')
    expect(sliced.spans).toEqual([
      { start: 0, end: 2, bold: true },
      { start: 3, end: 4, strikethrough: true }
    ])
  })
})

describe('extractLinesForSelection', () => {
  it('extracts multi-line with formatting', () => {
    const lines = [
      line({ id: '1', text: 'aaa', formatting: { headingLevel: 1 } }),
      line({
        id: '2',
        text: 'bbb',
        indentLevel: 1,
        formatting: { hasCheckbox: true }
      })
    ]
    const extracted = extractLinesForSelection(lines, {
      startLine: 0,
      startOffset: 0,
      endLine: 1,
      endOffset: 3
    })
    expect(extracted).toHaveLength(2)
    expect(extracted[0]?.formatting.headingLevel).toBe(1)
    expect(extracted[1]?.indentLevel).toBe(1)
    expect(extracted[1]?.formatting.hasCheckbox).toBe(true)
  })
})

describe('emoji surrogate safety', () => {
  const REPLACEMENT = '\uFFFD'

  it('keeps emoji intact on full-line copy round trip', () => {
    const src = [line({ text: 'before 🔴 after 🤖' })]
    const payload = serializeLinesForClipboard(
      extractLinesForSelection(src, { startLine: 0, startOffset: 0, endLine: 0, endOffset: src[0]!.text.length })
    )
    const restored = deserializeSnapnoteClipboard(parsePayloadJson(payloadToJson(payload))!)
    expect(restored[0]?.text).toBe('before 🔴 after 🤖')
    expect(restored[0]?.text).not.toContain(REPLACEMENT)
  })

  it('does not split a surrogate pair when offsets land mid-emoji', () => {
    // text: x(0) high(1) low(2) y(3) — '🔴' occupies indices 1..3
    const text = 'x🔴y'
    const endsMid = sliceEditorLine(line({ text }), 0, 2)
    expect(endsMid.text).not.toContain(REPLACEMENT)
    const startsMid = sliceEditorLine(line({ text }), 2, text.length)
    expect(startsMid.text).not.toContain(REPLACEMENT)
    expect(linesToPlainText([endsMid, startsMid])).not.toContain(REPLACEMENT)
  })
})

describe('html backup', () => {
  it('embeds and extracts json', () => {
    const payload = serializeLinesForClipboard([line({ text: 'x' })])
    const json = payloadToJson(payload)
    const html = embedSnapnoteInHtml('x', json)
    const back = extractSnapnoteFromHtml(html)
    expect(back).toBe(json)
    expect(parsePayloadJson(back!)?.lines[0]?.text).toBe('x')
  })
})
