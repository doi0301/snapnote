import { describe, expect, it } from 'vitest'
import { normalizeEditorLines } from './editorLines'

describe('normalizeEditorLines', () => {
  it('빈 배열이면 한 줄 빈 문서', () => {
    const r = normalizeEditorLines([])
    expect(r).toHaveLength(1)
    expect(r[0].text).toBe('')
    expect(r[0].indentLevel).toBe(0)
  })

  it('indentLevel 클램프 0~6', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: 'x',
        indentLevel: 99,
        formatting: {}
      }
    ])
    expect(r[0].indentLevel).toBe(6)
  })

  it('구버전 섹션(들여쓰기 0 본문) 을 새 규칙에 맞춰 자동으로 1단 들여쓰기한다', () => {
    const r = normalizeEditorLines([
      { id: 'a', text: 'Sec A', indentLevel: 0, formatting: { sectionTitle: true } },
      { id: 'b', text: 'body 1', indentLevel: 0, formatting: {} },
      { id: 'c', text: 'body 2', indentLevel: 0, formatting: {} },
      { id: 'd', text: 'Sec B', indentLevel: 0, formatting: { sectionTitle: true } }
    ])
    expect(r.map((l) => l.indentLevel)).toEqual([0, 1, 1, 0])
  })

  it('마이그레이션은 멱등이다 (이미 들여쓰인 본문은 다시 건드리지 않는다)', () => {
    const once = normalizeEditorLines([
      { id: 'a', text: 'Sec A', indentLevel: 0, formatting: { sectionTitle: true } },
      { id: 'b', text: 'body 1', indentLevel: 0, formatting: {} }
    ])
    const twice = normalizeEditorLines(once)
    expect(twice.map((l) => l.indentLevel)).toEqual(once.map((l) => l.indentLevel))
  })

  it('구버전 self-only 섹션은 건드리지 않고, sectionScope 필드는 제거한다', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: 'Sec A',
        indentLevel: 0,
        formatting: { sectionTitle: true, sectionScope: 'self-only' } as never
      },
      { id: 'b', text: 'body 1', indentLevel: 0, formatting: {} }
    ])
    expect(r[0]!.indentLevel).toBe(0)
    expect(r[1]!.indentLevel).toBe(0)
    expect((r[0]!.formatting as Record<string, unknown>).sectionScope).toBeUndefined()
  })

  it('이미 더 깊게 들여쓴 본문은 그대로 둔다', () => {
    const r = normalizeEditorLines([
      { id: 'a', text: 'Sec A', indentLevel: 1, formatting: { sectionTitle: true } },
      { id: 'b', text: 'body 1', indentLevel: 3, formatting: {} }
    ])
    expect(r[1]!.indentLevel).toBe(3)
  })

  it('클로드 블록: 알 수 없는 status 는 draft 로 폴백한다 (templateId는 참조값이라 그대로 둔다)', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: '클로드 블록',
        indentLevel: 0,
        formatting: { claudeBlock: { templateId: 'some-template', status: 'weird' } } as never
      }
    ])
    expect(r[0]!.formatting.claudeBlock).toEqual({ templateId: 'some-template', status: 'draft' })
  })

  it('클로드 블록: templateId 가 빈 문자열이면 blank 로 폴백한다', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: '클로드 블록',
        indentLevel: 0,
        formatting: { claudeBlock: { templateId: '', status: 'draft' } }
      }
    ])
    expect(r[0]!.formatting.claudeBlock).toEqual({ templateId: 'blank', status: 'draft' })
  })

  it('클로드 블록: 정상 값은 그대로 유지한다', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: '클로드 블록',
        indentLevel: 0,
        formatting: { claudeBlock: { templateId: 'revise-guide', status: 'sent' } }
      }
    ])
    expect(r[0]!.formatting.claudeBlock).toEqual({ templateId: 'revise-guide', status: 'sent' })
  })

  it('클로드 블록: sectionCollapsed 는 claudeBlock 헤더에서도 유지된다 (섹션과 필드 공유)', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: '클로드 블록',
        indentLevel: 0,
        formatting: {
          claudeBlock: { templateId: 'blank', status: 'draft' },
          sectionCollapsed: true
        }
      }
    ])
    expect(r[0]!.formatting.sectionCollapsed).toBe(true)
  })

  it('claudeSlot 은 문자열이 아니면 제거된다', () => {
    const r = normalizeEditorLines([
      { id: 'a', text: '{첨부}', indentLevel: 1, formatting: { claudeSlot: 42 } as never }
    ])
    expect(r[0]!.formatting.claudeSlot).toBeUndefined()
  })
})
