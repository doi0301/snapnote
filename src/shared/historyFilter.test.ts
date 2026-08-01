import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { Memo } from './types'
import { filterHistoryMemos, matchesCategory, matchesSearch } from './historyFilter'

function stubMemo(partial: Partial<Memo> & Pick<Memo, 'id'>): Memo {
  const now = new Date().toISOString()
  return {
    id: partial.id,
    content: partial.content ?? [
      { id: randomUUID(), text: 'empty', indentLevel: 0, formatting: {} }
    ],
    tags: partial.tags ?? [],
    categoryId: partial.categoryId ?? null,
    color: partial.color ?? 'coral',
    isPinned: partial.isPinned ?? false,
    pinnedAt: partial.pinnedAt ?? null,
    windowX: partial.windowX ?? null,
    windowY: partial.windowY ?? null,
    windowWidth: partial.windowWidth ?? 400,
    windowHeight: partial.windowHeight ?? 500,
    isDone: partial.isDone ?? false,
    isFavorite: partial.isFavorite ?? false,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    deletedAt: partial.deletedAt ?? null
  }
}

describe('historyFilter', () => {
  it('matchesSearch 가 태그·본문을 포함한다', () => {
    const m = stubMemo({
      id: 'a',
      content: [{ id: 'l1', text: 'Hello World', indentLevel: 0, formatting: {} }],
      tags: ['Alpha']
    })
    expect(matchesSearch(m, 'hello')).toBe(true)
    expect(matchesSearch(m, 'alpha')).toBe(true)
    expect(matchesSearch(m, 'zzz')).toBe(false)
  })

  it('matchesCategory 는 메모당 하나뿐인 categoryId를 선택 집합과 OR 매칭한다', () => {
    const withCat = stubMemo({ id: 'a', categoryId: 'cat-1' })
    const noCat = stubMemo({ id: 'b', categoryId: null })
    expect(matchesCategory(withCat, new Set())).toBe(true)
    expect(matchesCategory(withCat, new Set(['cat-1']))).toBe(true)
    expect(matchesCategory(withCat, new Set(['cat-2']))).toBe(false)
    expect(matchesCategory(noCat, new Set(['cat-1']))).toBe(false)
  })

  it('filterHistoryMemos 는 카테고리 필터도 함께 적용한다', () => {
    const memos = [
      stubMemo({ id: 'a', categoryId: 'cat-1' }),
      stubMemo({ id: 'b', categoryId: 'cat-2' }),
      stubMemo({ id: 'c', categoryId: null })
    ]
    const result = filterHistoryMemos(memos, '', new Set(), new Set(['cat-1']))
    expect(result.map((m) => m.id)).toEqual(['a'])
  })

  it('TASK-S5-07: 50개 메모 단일 필터 패스가 100ms 미만', () => {
    const memos: Memo[] = []
    for (let i = 0; i < 50; i++) {
      memos.push(
        stubMemo({
          id: `id-${i}`,
          content: [
            {
              id: randomUUID(),
              text: `perf-line-${i}-needle-token`,
              indentLevel: 0,
              formatting: {}
            }
          ],
          tags: i % 7 === 0 ? ['benchtag'] : []
        })
      )
    }
    const t0 = performance.now()
    const filtered = filterHistoryMemos(memos, 'needle', new Set(['benchtag']))
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(100)
    expect(filtered.length).toBeGreaterThan(0)
  })
})
