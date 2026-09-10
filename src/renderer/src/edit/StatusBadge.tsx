import { useEffect, useState } from 'react'

export interface StatusMeta {
  emoji: string
  label: string
}

/**
 * 상태 배지 + 드롭다운 (P6) — 클로드 블록과 섹션이 공유한다.
 * 값 집합만 주입받고, 팝오버 열림/바깥 클릭 닫기 동작은 여기서 관리한다.
 */
export function StatusBadge<T extends string>(props: {
  value: T | undefined
  order: readonly T[]
  meta: Record<T, StatusMeta>
  onPick: (value: T | undefined) => void
  /** 미지정으로 되돌리는 항목을 보여줄지 (섹션만 true) */
  allowClear?: boolean
  /** 미지정일 때 배지에 띄울 문구 (섹션: '상태') */
  emptyLabel?: string
  ariaLabel: string
}): React.JSX.Element {
  const { value, order, meta, onPick, allowClear, emptyLabel, ariaLabel } = props
  const [open, setOpen] = useState(false)
  const current = value ? meta[value] : undefined

  useEffect(() => {
    if (!open) return
    const onDocDown = (ev: MouseEvent): void => {
      const el = ev.target as Element | null
      if (el?.closest('.editor-status-popover') || el?.closest('.editor-status-btn')) return
      setOpen(false)
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDocDown), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDocDown)
    }
  }, [open])

  return (
    <div className="editor-status-wrap">
      <button
        type="button"
        className={`editor-status-btn${current ? '' : ' editor-status-btn--empty'}`}
        title={ariaLabel}
        aria-label={`${ariaLabel}: ${current?.label ?? '미지정'}`}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        {current ? `${current.emoji} ${current.label}` : (emptyLabel ?? '상태')}{' '}
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="editor-status-popover" role="menu" aria-label={`${ariaLabel} 선택`}>
          {order.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              className={`editor-status-option${s === value ? ' editor-status-option--current' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(s)
                setOpen(false)
              }}
            >
              {meta[s].emoji} {meta[s].label}
            </button>
          ))}
          {allowClear ? (
            <button
              type="button"
              role="menuitem"
              className="editor-status-option editor-status-option--clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(undefined)
                setOpen(false)
              }}
            >
              상태 지우기
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
