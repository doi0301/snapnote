import type { Category } from '@shared/types'
import './category-picker.css'

export interface CategoryPickerProps {
  categories: Category[]
  value: string | null
  onChange: (categoryId: string | null) => void
}

/** 태그와 별개인 상위 분류 — 설정에서 미리 등록한 목록 중 하나를 드롭다운으로 선택 */
export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps): React.JSX.Element {
  return (
    <select
      className="category-picker"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="카테고리"
      title="카테고리"
    >
      <option value="">카테고리 없음</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
