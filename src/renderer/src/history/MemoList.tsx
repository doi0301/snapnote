import type { JSX } from 'react'
import type { Memo, MemoId } from '@shared/types'
import { MemoListItem } from './MemoListItem'

export interface MemoListProps {
  memos: Memo[]
  selectedIds: Set<MemoId>
  onToggleSelect: (id: MemoId) => void
  onOpen: (memo: Memo) => void
  onDelete: (memo: Memo) => void
  onToggleDone: (memo: Memo) => void
}

export function MemoList({
  memos,
  selectedIds,
  onToggleSelect,
  onOpen,
  onDelete,
  onToggleDone
}: MemoListProps): JSX.Element {
  if (memos.length === 0) {
    return <></>
  }

  return (
    <ul className="history-memo-list" role="list">
      {memos.map((m) => (
        <MemoListItem
          key={m.id}
          memo={m}
          selected={selectedIds.has(m.id)}
          onToggleSelect={onToggleSelect}
          onOpen={onOpen}
          onDelete={onDelete}
          onToggleDone={onToggleDone}
        />
      ))}
    </ul>
  )
}
