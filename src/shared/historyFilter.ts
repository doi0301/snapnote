/**
 * 히스토리 모달 검색·태그 필터 (HistoryModal과 동일 로직).
 * TASK-S5-07: 검색 연산 비용 측정·단위 테스트용으로 분리.
 */
import type { Memo } from './types'

export function memoSearchHaystack(m: Memo): string {
  const parts = [...m.tags, ...m.content.map((l) => l.text)]
  return parts.join('\n').toLowerCase()
}

export function matchesSearch(m: Memo, q: string): boolean {
  const t = q.trim().toLowerCase()
  if (!t) return true
  return memoSearchHaystack(m).includes(t)
}

export function matchesTagOr(m: Memo, selected: Set<string>): boolean {
  if (selected.size === 0) return true
  return m.tags.some((t) =>
    [...selected].some((s) => s.toLowerCase() === t.toLowerCase())
  )
}

/**
 * `memoHasTextContent` 로 걸러진 목록만 넣는다 (HistoryModal `substantiveMemos` 와 동일 전제).
 */
export function filterHistoryMemos(
  substantiveMemos: Memo[],
  debouncedQuery: string,
  selectedTags: Set<string>
): Memo[] {
  return substantiveMemos.filter(
    (m) => matchesTagOr(m, selectedTags) && matchesSearch(m, debouncedQuery)
  )
}
