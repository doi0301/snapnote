import { describe, expect, it } from 'vitest'
import { memoContentToMarkdown } from './memoMarkdownExport'
import {
  looksLikeMarkdown,
  parseInlineMarkdown,
  parseMarkdownToEditorLines
} from './memoMarkdownImport'
import type { EditorLine } from './types'

function line(partial: Partial<EditorLine> & Pick<EditorLine, 'text'>): EditorLine {
  return {
    id: '1',
    indentLevel: 0,
    formatting: {},
    ...partial
  }
}

describe('looksLikeMarkdown', () => {
  it('detects task list and headings', () => {
    expect(looksLikeMarkdown('- [ ] todo')).toBe(true)
    expect(looksLikeMarkdown('plain text')).toBe(false)
    expect(looksLikeMarkdown('## title')).toBe(true)
  })
})

describe('parseInlineMarkdown', () => {
  it('parses bold and strike', () => {
    const r = parseInlineMarkdown('**a**~~b~~')
    expect(r.text).toBe('ab')
    expect(r.spans).toEqual([
      { start: 0, end: 1, bold: true },
      { start: 1, end: 2, strikethrough: true }
    ])
  })
})

describe('parseMarkdownToEditorLines', () => {
  it('parses checkbox with completed strikethrough', () => {
    const lines = parseMarkdownToEditorLines('  - [x] ~~done~~')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.indentLevel).toBe(1)
    expect(lines[0]?.formatting.hasCheckbox).toBe(true)
    expect(lines[0]?.formatting.checkboxChecked).toBe(true)
    expect(lines[0]?.formatting.strikethrough).toBe(true)
    expect(lines[0]?.text).toBe('done')
  })

  it('parses heading with SnapNote markers', () => {
    const lines = parseMarkdownToEditorLines('# **Title**')
    expect(lines[0]?.formatting.headingLevel).toBe(1)
    expect(lines[0]?.text).toBe('[Title]')
  })

  it('round-trips export format', () => {
    const source = [
      line({ id: '1', text: '[제목]', formatting: { headingLevel: 1 } }),
      line({
        id: '2',
        text: '항목',
        indentLevel: 1,
        formatting: { hasCheckbox: true, checkboxChecked: true, strikethrough: true }
      }),
      line({
        id: '3',
        text: 'abc',
        spans: [
          { start: 0, end: 1, bold: true },
          { start: 1, end: 3, strikethrough: true }
        ]
      })
    ]
    const md = memoContentToMarkdown(source)
    const parsed = parseMarkdownToEditorLines(md)
    expect(parsed).toHaveLength(3)
    expect(parsed[0]?.formatting.headingLevel).toBe(1)
    expect(parsed[0]?.text).toBe('[제목]')
    expect(parsed[1]?.formatting.hasCheckbox).toBe(true)
    expect(parsed[1]?.formatting.checkboxChecked).toBe(true)
    expect(parsed[1]?.indentLevel).toBe(1)
    expect(parsed[2]?.spans?.some((s) => s.bold)).toBe(true)
    expect(parsed[2]?.spans?.some((s) => s.strikethrough)).toBe(true)
  })
})
