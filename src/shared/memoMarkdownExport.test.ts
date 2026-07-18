import { describe, expect, it } from 'vitest'
import type { EditorLine } from './types'
import {
  editorLineToMarkdown,
  formatInlineMarkdown,
  memoContentToMarkdown,
  memoTitleFromContent,
  stripAllHeadingMarkers
} from './memoMarkdownExport'

function line(partial: Partial<EditorLine> & Pick<EditorLine, 'text'>): EditorLine {
  return {
    id: '1',
    indentLevel: 0,
    formatting: {},
    ...partial
  }
}

describe('stripAllHeadingMarkers', () => {
  it('strips bracket and prefix markers', () => {
    expect(stripAllHeadingMarkers('[제목]')).toBe('제목')
    expect(stripAllHeadingMarkers('- 항목')).toBe('항목')
    expect(stripAllHeadingMarkers('\u25B8 하위')).toBe('하위')
  })
})

describe('editorLineToMarkdown', () => {
  it('exports checkbox unchecked and checked with strikethrough', () => {
    expect(
      editorLineToMarkdown(
        line({
          text: '할 일',
          formatting: { hasCheckbox: true, checkboxChecked: false }
        })
      )
    ).toBe('- [ ] 할 일')

    expect(
      editorLineToMarkdown(
        line({
          text: '완료됨',
          formatting: { hasCheckbox: true, checkboxChecked: true, strikethrough: true }
        })
      )
    ).toBe('- [x] ~~완료됨~~')
  })

  it('exports indent as leading spaces', () => {
    expect(
      editorLineToMarkdown(
        line({
          text: '하위',
          indentLevel: 2,
          formatting: { hasCheckbox: true, checkboxChecked: false }
        })
      )
    ).toBe('    - [ ] 하위')
  })

  it('exports heading levels as ATX headers with bold for H1/H2', () => {
    expect(
      editorLineToMarkdown(
        line({
          text: '[큰 제목]',
          formatting: { headingLevel: 1 }
        })
      )
    ).toBe('# **큰 제목**')

    expect(
      editorLineToMarkdown(
        line({
          text: '- 소제목',
          formatting: { headingLevel: 4 }
        })
      )
    ).toBe('#### 소제목')
  })

  it('exports section title as H1 with structural bold', () => {
    expect(
      editorLineToMarkdown(
        line({
          text: '섹션 제목',
          formatting: { sectionTitle: true, accentBar: 'blue' }
        })
      )
    ).toBe('# **섹션 제목**')
  })

  it('exports inline bold and strikethrough spans', () => {
    expect(
      editorLineToMarkdown(
        line({
          text: 'abc',
          spans: [
            { start: 0, end: 1, bold: true },
            { start: 1, end: 3, strikethrough: true }
          ]
        })
      )
    ).toBe('**a**~~bc~~')
  })

  it('exports divider and table', () => {
    expect(
      editorLineToMarkdown(
        line({
          text: '',
          formatting: { hasDivider: true }
        })
      )
    ).toBe('---')

    expect(
      editorLineToMarkdown(
        line({
          text: '',
          formatting: {
            isTable: true,
            tableCols: 2,
            tableRows: [
              ['A', 'B'],
              ['1', '2']
            ]
          }
        })
      )
    ).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |')
  })
})

describe('memoContentToMarkdown', () => {
  it('joins lines with newlines', () => {
    const md = memoContentToMarkdown([
      line({ id: '1', text: '[제목]', formatting: { headingLevel: 1 } }),
      line({
        id: '2',
        text: '항목',
        indentLevel: 1,
        formatting: { hasCheckbox: true, checkboxChecked: true, strikethrough: true }
      })
    ])
    expect(md).toBe('# **제목**\n  - [x] ~~항목~~')
  })
})

describe('memoTitleFromContent', () => {
  it('strips heading markers from first line', () => {
    expect(memoTitleFromContent([line({ text: '[회의록]' })])).toBe('회의록')
    expect(memoTitleFromContent([])).toBe('(제목 없음)')
  })
})

describe('formatInlineMarkdown', () => {
  it('converts keycap storage chars to digits', () => {
    expect(formatInlineMarkdown('\uFF11', [{ start: 0, end: 1, keycap: true }])).toBe('1')
  })
})
