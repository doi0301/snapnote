import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { Memo } from './types'
import { filterHistoryMemos, matchesSearch } from './historyFilter'

function stubMemo(partial: Partial<Memo> & Pick<Memo, 'id'>): Memo {
  const now = new Date().toISOString()
  return {
    id: partial.id,
    content: partial.content ?? [
      { id: randomUUID(), text: 'empty', indentLevel: 0, formatting: {} }
    ],
    tags: partial.tags ?? [],
    color: partial.color ?? 'coral',
    isPinned: partial.isPinned ?? false,
    pinnedAt: partial.pinnedAt ?? null,
    windowX: partial.windowX ?? null,
    windowY: partial.windowY ?? null,
    windowWidth: partial.windowWidth ?? 400,
    windowHeight: partial.windowHeight ?? 500,
    isDone: partial.isDone ?? false,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now
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
