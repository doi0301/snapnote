import './checkbox.css'

export interface CheckboxProps {
  checked: boolean
  /** 체크 상태 토글 (버튼 클릭) */
  onToggle: () => void
}

/** 인덴트 gutter 오른쪽에 표시되는 줄 단위 체크박스 */
export function Checkbox({ checked, onToggle }: CheckboxProps): React.JSX.Element {
  return (
    <button
      type="button"
      className="editor-line-checkbox"
      role="checkbox"
      aria-checked={checked}
      title={checked ? '완료 취소' : '완료'}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
    >
      <span className="editor-line-checkbox-icon" aria-hidden>
        {checked ? '☑' : '☐'}
      </span>
    </button>
  )
}
