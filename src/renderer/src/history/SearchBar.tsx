import { useEffect, useState } from 'react'

const DEBOUNCE_MS = 150

export interface SearchBarProps {
  /** 디바운스된 검색어 (부모 필터링) */
  onDebouncedQuery: (q: string) => void
  placeholder?: string
}

/**
 * 실시간 입력 + 150ms 디바운스로 콜백 (내용·태그 검색은 부모에서 처리)
 */
export function SearchBar({
  onDebouncedQuery,
  placeholder = '제목·내용·태그 검색…'
}: SearchBarProps): React.JSX.Element {
  const [value, setValue] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => onDebouncedQuery(value), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [value, onDebouncedQuery])

  return (
    <div className="history-search-bar">
      <input
        type="search"
        className="history-search-input"
        data-testid="history-search-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="메모 검색"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}
