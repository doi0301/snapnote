export interface TagFilterBarProps {
  allTags: string[]
  /** 비어 있으면 "전체" (필터 없음) */
  selectedTags: Set<string>
  onChange: (next: Set<string>) => void
}

/**
 * 수평 스크롤 태그 칩. #전체 = 필터 해제. 다중 선택 시 OR(하나라도 포함).
 */
export function TagFilterBar({ allTags, selectedTags, onChange }: TagFilterBarProps): React.JSX.Element {
  const isAll = selectedTags.size === 0

  const toggleTag = (tag: string): void => {
    const next = new Set(selectedTags)
    const key = tag.toLowerCase()
    const existing = [...next].find((t) => t.toLowerCase() === key)
    if (existing) next.delete(existing)
    else next.add(tag)
    onChange(next)
  }

  return (
    <div className="history-tag-filter" role="group" aria-label="태그 선택">
      <div className="history-tag-filter-scroll">
        <button
          type="button"
          className={`history-tag-chip${isAll ? ' history-tag-chip--active' : ''}`}
          aria-pressed={isAll}
          onClick={() => onChange(new Set())}
        >
          #전체
        </button>
        {allTags.map((t) => {
          const active = [...selectedTags].some((x) => x.toLowerCase() === t.toLowerCase())
          return (
            <button
              key={t}
              type="button"
              className={`history-tag-chip${active ? ' history-tag-chip--active' : ''}`}
              aria-pressed={active}
              onClick={() => toggleTag(t)}
            >
              #{t}
            </button>
          )
        })}
      </div>
    </div>
  )
}
