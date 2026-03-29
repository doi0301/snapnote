import type { JSX } from 'react'
import type { Memo, MemoId } from '@shared/types'
import { TrashIcon } from '@renderer/components/TrashIcon'
import { firstLinePreview } from '@renderer/utils/memoPreview'

function formatYmd(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

function preview30(lines: Memo['content']): string {
  const t = lines[0]?.text?.trim() ?? ''
  if (!t) return ''
  if (t.length <= 30) return t
  return `${t.slice(0, 30)}…`
}

export interface MemoListItemProps {
  memo: Memo
  selected: boolean
  onToggleSelect: (id: MemoId) => void
  onOpen: (memo: Memo) => void
  onDelete: (memo: Memo) => void
  onToggleDone: (memo: Memo) => void
}

export function MemoListItem({
  memo,
  selected,
  onToggleSelect,
  onOpen,
  onDelete,
  onToggleDone
}: MemoListItemProps): JSX.Element {
  const titlePreview = firstLinePreview(memo.content, 80)
  const preview = preview30(memo.content)

  return (
    <li className={`history-memo-item${memo.isDone ? ' history-memo-item--done' : ''}`}>
      <label className="history-memo-check" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(memo.id)}
          aria-label={`${preview || '메모'} 선택`}
        />
      </label>
      <button
        type="button"
        className="history-memo-done"
        title={memo.isDone ? '진행 중으로 표시' : '완료로 표시'}
        onClick={(e) => {
          e.stopPropagation()
          onToggleDone(memo)
        }}
      >
        {memo.isDone ? '진행' : '완료'}
      </button>
      <button
        type="button"
        className="history-memo-item-main"
        title={titlePreview || undefined}
        onClick={() => onOpen(memo)}
      >
        <div className="history-memo-item-body">
          <div className="history-memo-preview">{preview}</div>
          {memo.tags.length > 0 ? (
            <div className="history-memo-tags">
              {memo.tags.map((t) => (
                <span key={t} className="history-memo-tag">
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
          <div className="history-memo-meta">{formatYmd(memo.updatedAt)}</div>
        </div>
      </button>
      <button
        type="button"
        className="history-memo-trash"
        title="삭제"
        aria-label="삭제"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(memo)
        }}
      >
        <TrashIcon size={17} />
      </button>
    </li>
  )
}
