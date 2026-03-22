import { describe, expect, it } from 'vitest'
import { normalizeEditorLines } from './editorLines'

describe('normalizeEditorLines', () => {
  it('빈 배열이면 한 줄 빈 문서', () => {
    const r = normalizeEditorLines([])
    expect(r).toHaveLength(1)
    expect(r[0].text).toBe('')
    expect(r[0].indentLevel).toBe(0)
  })

  it('indentLevel 클램프 0~3', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: 'x',
        indentLevel: 99,
        formatting: {}
      }
    ])
    expect(r[0].indentLevel).toBe(3)
  })
})
