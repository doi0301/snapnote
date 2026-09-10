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

  it('폐기된 sectionScope 필드는 정리하되 들여쓰기는 건드리지 않는다', () => {
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

  it('클로드 블록: 알 수 없는 status 는 draft 로 폴백한다', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: '클로드 블록',
        indentLevel: 0,
        formatting: { claudeBlock: { status: 'weird' } } as never
      }
    ])
    expect(r[0]!.formatting.claudeBlock).toEqual({ status: 'draft' })
  })

  it('클로드 블록: 구버전 templateId 는 조용히 버리고 status 만 남긴다 (P6)', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: '클로드 블록',
        indentLevel: 0,
        formatting: { claudeBlock: { templateId: 'summarize', status: 'review' } } as never
      }
    ])
    expect(r[0]!.formatting.claudeBlock).toEqual({ status: 'review' })
  })

  it('클로드 블록: 정상 값은 그대로 유지한다', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: '클로드 블록',
        indentLevel: 0,
        formatting: { claudeBlock: { status: 'sent' } }
      }
    ])
    expect(r[0]!.formatting.claudeBlock).toEqual({ status: 'sent' })
  })

  it('클로드 블록: sectionCollapsed 는 claudeBlock 헤더에서도 유지된다 (섹션과 필드 공유)', () => {
    const r = normalizeEditorLines([
      {
        id: 'a',
        text: '클로드 블록',
        indentLevel: 0,
        formatting: {
          claudeBlock: { status: 'draft' },
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

describe('로드 경로는 들여쓰기를 마이그레이션하지 않는다 (P6)', () => {
  // 구버전 섹션 본문 변환은 DB 마이그레이션(user_version 11)으로 옮겼다.
  // 로드마다 돌리면 섹션을 의도적으로 빠져나온 줄까지 섹션 안으로 끌어들인다.
  it('섹션 밖 최상위 줄의 들여쓰기를 건드리지 않는다', () => {
    const out = normalizeEditorLines([
      { id: 'a', text: '섹션 A', indentLevel: 0, formatting: { sectionTitle: true } },
      { id: 'b', text: '섹션 본문', indentLevel: 1, formatting: {} },
      { id: 'c', text: '섹션을 빠져나온 줄', indentLevel: 0, formatting: {} }
    ])
    expect(out.map((l) => l.indentLevel)).toEqual([0, 1, 0])
  })

  it('여러 번 정규화해도 결과가 같다 (멱등)', () => {
    const once = normalizeEditorLines([
      { id: 'a', text: '섹션 A', indentLevel: 0, formatting: { sectionTitle: true } },
      { id: 'b', text: '본문', indentLevel: 1, formatting: {} },
      { id: 'c', text: '밖', indentLevel: 0, formatting: {} }
    ])
    const twice = normalizeEditorLines(once)
    expect(twice.map((l) => l.indentLevel)).toEqual(once.map((l) => l.indentLevel))
  })

  it('legacy sectionScope 가 남아 있어도 들여쓰기를 바꾸지 않는다 (필드만 정리)', () => {
    const out = normalizeEditorLines([
      {
        id: 'a',
        text: '섹션 A',
        indentLevel: 0,
        formatting: { sectionTitle: true, sectionScope: 'until-next' } as never
      },
      { id: 'b', text: '옛 규칙에선 섹션 소속이던 줄', indentLevel: 0, formatting: {} }
    ])
    expect(out[1]!.indentLevel).toBe(0)
    expect((out[0]!.formatting as Record<string, unknown>).sectionScope).toBeUndefined()
  })
})
