import { useCallback, useState } from 'react'
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
  onToggleFavorite?: (memo: Memo) => void
}

export function MemoList({
  memos,
  selectedIds,
  onToggleSelect,
  onOpen,
  onDelete,
  onToggleDone,
  onToggleFavorite
}: MemoListProps): JSX.Element {
  const [openMenuId, setOpenMenuId] = useState<MemoId | null>(null)

  const handleMenuToggle = useCallback((id: MemoId, open: boolean) => {
    setOpenMenuId(open ? id : null)
  }, [])

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
          onToggleFavorite={onToggleFavorite}
          menuOpen={openMenuId === m.id}
          onMenuToggle={handleMenuToggle}
        />
      ))}
    </ul>
  )
}
