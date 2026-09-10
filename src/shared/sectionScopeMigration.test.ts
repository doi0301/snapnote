import { describe, expect, it } from 'vitest'
import type { EditorLine } from './types'
import { migrateSectionScopeToIndent } from './sectionScopeMigration'

function line(
  id: string,
  text: string,
  formatting: EditorLine['formatting'] = {},
  indentLevel = 0
): EditorLine {
  return { id, text, indentLevel, formatting }
}

describe('migrateSectionScopeToIndent (구버전 섹션 → 들여쓰기 규칙, 1회성)', () => {
  it('섹션 본문(들여쓰기 0)을 다음 타이틀 전까지 1단 들여쓴다', () => {
    const out = migrateSectionScopeToIndent([
      line('a', 'Sec A', { sectionTitle: true }, 0),
      line('b', 'body 1', {}, 0),
      line('c', 'body 2', {}, 0),
      line('d', 'Sec B', { sectionTitle: true }, 0)
    ])
    expect(out.map((l) => l.indentLevel)).toEqual([0, 1, 1, 0])
  })

  it('self-only 섹션은 아래 줄을 거느리지 않는다', () => {
    const out = migrateSectionScopeToIndent([
      line('a', 'Sec A', { sectionTitle: true, sectionScope: 'self-only' } as never, 0),
      line('b', 'body 1', {}, 0)
    ])
    expect(out.map((l) => l.indentLevel)).toEqual([0, 0])
  })

  it('이미 들여쓰인 본문은 건드리지 않는다', () => {
    const out = migrateSectionScopeToIndent([
      line('a', 'Sec A', { sectionTitle: true }, 0),
      line('b', 'body 1', {}, 2)
    ])
    expect(out.map((l) => l.indentLevel)).toEqual([0, 2])
  })

  it('들여쓰기 상한(6)을 넘기지 않는다', () => {
    const out = migrateSectionScopeToIndent([
      line('a', 'Sec A', { sectionTitle: true }, 6),
      line('b', 'body 1', {}, 0)
    ])
    expect(out[1]!.indentLevel).toBe(6)
  })

  it('원본 배열을 변형하지 않는다', () => {
    const input = [line('a', 'Sec A', { sectionTitle: true }, 0), line('b', 'body 1', {}, 0)]
    migrateSectionScopeToIndent(input)
    expect(input[1]!.indentLevel).toBe(0)
  })
})
