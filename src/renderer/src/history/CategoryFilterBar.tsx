import type { Category } from '@shared/types'

export interface CategoryFilterBarProps {
  categories: Category[]
  /** 비어 있으면 "전체" (필터 없음) */
  selectedCategoryIds: Set<string>
  onChange: (next: Set<string>) => void
}

/**
 * 수평 스크롤 카테고리 칩. 전체 = 필터 해제. 다중 선택 시 OR(하나라도 일치).
 * 태그 칩과 동일한 스타일(history-tag-*)을 재사용한다.
 */
export function CategoryFilterBar({
  categories,
  selectedCategoryIds,
  onChange
}: CategoryFilterBarProps): React.JSX.Element | null {
  if (categories.length === 0) return null
  const isAll = selectedCategoryIds.size === 0

  const toggle = (id: string): void => {
    const next = new Set(selectedCategoryIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div className="history-tag-filter" role="group" aria-label="카테고리 선택">
      <div className="history-tag-filter-scroll">
        <button
          type="button"
          className={`history-tag-chip${isAll ? ' history-tag-chip--active' : ''}`}
          aria-pressed={isAll}
          onClick={() => onChange(new Set())}
        >
          전체
        </button>
        {categories.map((c) => {
          const active = selectedCategoryIds.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              className={`history-tag-chip${active ? ' history-tag-chip--active' : ''}`}
              aria-pressed={active}
              onClick={() => toggle(c.id)}
            >
              {c.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
