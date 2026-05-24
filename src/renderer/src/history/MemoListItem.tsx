import { useCallback } from 'react'
import type { JSX } from 'react'
import type { Memo, MemoId } from '@shared/types'
import { TrashIcon } from '@renderer/components/TrashIcon'
import { SpannedLineMirror } from '@renderer/edit/InlineSpan'
import { firstLinePreviewSpanned, plainLinePreview } from '@renderer/utils/memoPreview'
import '@renderer/edit/keycap-badge.css'

function formatYmd(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

export interface MemoListItemProps {
  memo: Memo
  selected: boolean
  onToggleSelect: (id: MemoId) => void
  onOpen: (memo: Memo) => void
  onDelete: (memo: Memo) => void
  onToggleDone: (memo: Memo) => void
  onToggleFavorite?: (memo: Memo) => void
  menuOpen?: boolean
  onMenuToggle?: (id: MemoId, open: boolean) => void
}

export function MemoListItem({
  memo,
  selected,
  onToggleSelect,
  onOpen,
  onDelete,
  onToggleDone,
  onToggleFavorite,
  menuOpen,
  onMenuToggle
}: MemoListItemProps): JSX.Element {
  const titlePreview = plainLinePreview(memo.content, 80)
  const previewSpanned = firstLinePreviewSpanned(memo.content, 30)
  const previewPlain = plainLinePreview(memo.content, 30)

  const exportMemo = useCallback(
    async () => {
      await window.snapnote.app.exportMemosAsFile({ ids: [memo.id] })
    },
    [memo.id]
  )

  return (
    <li className={`history-memo-item${memo.isDone ? ' history-memo-item--done' : ''}`}>
      <label className="history-memo-check" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(memo.id)}
          aria-label={`${previewPlain || '메모'} 선택`}
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
          <div className="history-memo-preview">
            {previewSpanned.text === '…' ? (
              previewPlain
            ) : (
              <SpannedLineMirror
                text={previewSpanned.text}
                spans={previewSpanned.spans}
                variant="inline"
              />
            )}
          </div>
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
      {onToggleFavorite && (
        <button
          type="button"
          className={`history-memo-fav${memo.isFavorite ? ' history-memo-fav--active' : ''}`}
          title={memo.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
          aria-label={memo.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(memo) }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={memo.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3c.4 0 .8.3 1 .7l2.5 5 5.5.8c.5.1.7.7.4 1.1l-4 3.9 1 5.4c.1.5-.4.9-.9.6L12 17.8l-4.5 2.7c-.5.3-1-.1-.9-.6l1-5.4-4-3.9c-.3-.4-.1-1 .4-1.1l5.5-.8 2.5-5c.2-.4.6-.7 1-.7z" />
          </svg>
        </button>
      )}
      <div
        className="history-memo-more"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="history-memo-more-btn"
          title="메뉴"
          aria-label="메뉴"
          aria-expanded={menuOpen}
          onClick={() => onMenuToggle?.(memo.id, !menuOpen)}
        >
          ···
        </button>
        {menuOpen && (
          <div className="history-memo-more-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="history-memo-more-item"
              onClick={() => {
                onMenuToggle?.(memo.id, false)
                void exportMemo()
              }}
            >
              md다운로드
            </button>
          </div>
        )}
      </div>
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
