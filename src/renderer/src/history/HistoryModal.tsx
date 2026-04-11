import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Memo, MemoId } from '@shared/types'
import { memoHasTextContent } from '@shared/memoContent'
import { filterHistoryMemos } from '@shared/historyFilter'
import { collectAllTags } from '@renderer/edit/tagUtils'
import { firstLinePreview } from '@renderer/utils/memoPreview'
import { ConfirmDialog } from './ConfirmDialog'
import { MemoList } from './MemoList'
import { SearchBar } from './SearchBar'
import { TagFilterBar } from './TagFilterBar'
import './history-modal.css'

const LIST_CAP = 50

type SortKey = 'created' | 'updated'

function closeWindow(): void {
  window.close()
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function HistoryModal(): React.JSX.Element {
  const [memos, setMemos] = useState<Memo[]>([])
  const [trashMemos, setTrashMemos] = useState<Memo[]>([])
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => new Set())
  const [selectedIds, setSelectedIds] = useState<Set<MemoId>>(() => new Set())
  const [sortBy, setSortBy] = useState<SortKey>('created')
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'one'; memo: Memo }
    | { kind: 'bulk'; ids: MemoId[] }
    | { kind: 'permanent'; memo: Memo }
    | null
  >(null)

  const loadActive = useCallback((): void => {
    void window.snapnote.memo.getAll().then(setMemos)
  }, [])

  const loadTrash = useCallback((): void => {
    void window.snapnote.memo.getTrash().then(setTrashMemos)
  }, [])

  const load = useCallback((): void => {
    loadActive()
    loadTrash()
  }, [loadActive, loadTrash])

  useEffect(() => {
    load()
    const offMemo = window.snapnote.on.memoUpdated(load)
    const offReset = window.snapnote.on.memosDataReset(load)
    const offDel = window.snapnote.on.memoDeleted(load)
    return () => {
      offMemo()
      offReset()
      offDel()
    }
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeWindow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const substantiveMemos = useMemo(() => memos.filter((m) => memoHasTextContent(m)), [memos])

  const allTags = useMemo(() => collectAllTags(substantiveMemos), [substantiveMemos])

  const filtered = useMemo(
    () => filterHistoryMemos(substantiveMemos, debouncedQuery, selectedTags),
    [substantiveMemos, selectedTags, debouncedQuery]
  )

  const sorted = useMemo(() => {
    const key = sortBy === 'created' ? 'createdAt' : 'updatedAt'
    return [...filtered].sort((a, b) => b[key].localeCompare(a[key]))
  }, [filtered, sortBy])

  const displayList = useMemo(() => sorted.slice(0, LIST_CAP), [sorted])

  const toggleSelect = useCallback((id: MemoId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(substantiveMemos.map((m) => m.id))
      const next = new Set<MemoId>()
      for (const id of prev) {
        if (allowed.has(id)) next.add(id)
      }
      return next.size === prev.size && [...prev].every((id) => next.has(id)) ? prev : next
    })
  }, [substantiveMemos])

  const onNewMemo = useCallback(async (): Promise<void> => {
    const m = await window.snapnote.memo.create()
    await window.snapnote.memo.openEdit(m.id)
    closeWindow()
  }, [])

  const onOpenMemo = useCallback(async (m: Memo): Promise<void> => {
    await window.snapnote.memo.openEdit(m.id)
  }, [])

  const onDeleteMemo = useCallback((m: Memo): void => {
    setConfirmDelete({ kind: 'one', memo: m })
  }, [])

  const confirmDeleteAction = useCallback(async (): Promise<void> => {
    const c = confirmDelete
    if (!c) return
    if (c.kind === 'one') {
      await window.snapnote.memo.moveToTrash(c.memo.id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(c.memo.id)
        return next
      })
    } else if (c.kind === 'bulk') {
      for (const id of c.ids) {
        await window.snapnote.memo.moveToTrash(id)
      }
      setSelectedIds(new Set())
    } else if (c.kind === 'permanent') {
      await window.snapnote.memo.deletePermanent(c.memo.id)
    }
    setConfirmDelete(null)
  }, [confirmDelete])

  const onDeleteSelected = useCallback((): void => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setConfirmDelete({ kind: 'bulk', ids })
  }, [selectedIds])

  const onToggleDone = useCallback(async (m: Memo): Promise<void> => {
    await window.snapnote.memo.update({ id: m.id, patch: { isDone: !m.isDone } })
  }, [])

  const exportSelected = useCallback(async (): Promise<void> => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    await window.snapnote.app.exportMemosAsFile({ ids })
  }, [selectedIds])

  const onDebouncedQuery = useCallback((q: string) => setDebouncedQuery(q), [])

  const hasQuery = debouncedQuery.trim().length > 0
  const emptyAll = substantiveMemos.length === 0
  const emptyFiltered = !emptyAll && filtered.length === 0
  const selectionCount = selectedIds.size

  const confirmMessage =
    confirmDelete?.kind === 'one'
      ? `"${(confirmDelete.memo.content[0]?.text ?? '').trim().slice(0, 80) || '(제목 없음)'}"\n\n휴지통으로 이동할까요? 7일 후 자동으로 영구 삭제됩니다.`
      : confirmDelete?.kind === 'bulk'
        ? `선택한 ${confirmDelete.ids.length}개 메모를 휴지통으로 이동할까요? 7일 후 자동으로 영구 삭제됩니다.`
        : confirmDelete?.kind === 'permanent'
          ? `"${(confirmDelete.memo.content[0]?.text ?? '').trim().slice(0, 80) || '(제목 없음)'}"\n\n영구 삭제할까요? 복원할 수 없습니다.`
          : ''

  const confirmLabel =
    confirmDelete?.kind === 'permanent' ? '영구 삭제' : '휴지통으로 이동'

  return (
    <div
      className="history-window"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete?.kind === 'permanent' ? '영구 삭제' : '메모 삭제'}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        cancelLabel="취소"
        danger
        onConfirm={() => void confirmDeleteAction()}
        onCancel={() => setConfirmDelete(null)}
      />
      <header className="history-modal-header">
        <h1 id="history-modal-title" className="history-modal-title">
          메모 히스토리
        </h1>
        <div className="history-modal-header-actions">
          {selectionCount > 0 ? (
            <>
              <button
                type="button"
                className="history-btn"
                title="선택한 메모를 Markdown(.md) 파일로 저장"
                onClick={() => void exportSelected()}
              >
                md다운로드
              </button>
              <button
                type="button"
                className="history-btn history-btn--danger"
                onClick={() => void onDeleteSelected()}
              >
                선택 삭제 ({selectionCount})
              </button>
            </>
          ) : null}
          <button type="button" className="history-btn history-btn--primary" onClick={() => void onNewMemo()}>
            + 새 메모
          </button>
          <button
            type="button"
            className="history-modal-close-btn"
            onClick={closeWindow}
            aria-label="닫기"
            title="닫기"
          >
            <span aria-hidden>{'\u2715'}</span>
          </button>
        </div>
      </header>

      <SearchBar onDebouncedQuery={onDebouncedQuery} />

      <TagFilterBar allTags={allTags} selectedTags={selectedTags} onChange={setSelectedTags} />

      {/* 정렬 바 */}
      <div className="history-sort-bar">
        <span className="history-sort-label">정렬:</span>
        <button
          type="button"
          className={`history-sort-btn${sortBy === 'created' ? ' history-sort-btn--active' : ''}`}
          onClick={() => setSortBy('created')}
        >
          등록일순
        </button>
        <button
          type="button"
          className={`history-sort-btn${sortBy === 'updated' ? ' history-sort-btn--active' : ''}`}
          onClick={() => setSortBy('updated')}
        >
          수정일순
        </button>
      </div>

      <p className="history-modal-count" role="status">
        {emptyAll ? '전체 0개' : `전체 ${substantiveMemos.length}개`}
      </p>

      <div className="history-modal-body">
        {emptyAll ? (
          <div className="history-empty">
            <p>저장된 메모가 없습니다.</p>
            <button type="button" className="history-btn history-btn--primary" onClick={() => void onNewMemo()}>
              + 새 메모
            </button>
          </div>
        ) : emptyFiltered ? (
          <div className="history-empty">
            <p>{hasQuery || selectedTags.size > 0 ? '검색 결과가 없습니다.' : '표시할 메모가 없습니다.'}</p>
          </div>
        ) : (
          <MemoList
            memos={displayList}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onOpen={(m) => void onOpenMemo(m)}
            onDelete={onDeleteMemo}
            onToggleDone={(m) => void onToggleDone(m)}
          />
        )}
      </div>

      {/* 휴지통 섹션 */}
      <details className="history-trash-section">
        <summary className="history-trash-summary">
          <span>{'🗑'}</span>
          <span>휴지통 {trashMemos.length > 0 ? `(${trashMemos.length})` : ''}</span>
          <span className="history-trash-chevron">{'▼'}</span>
        </summary>
        <p className="history-trash-notice">
          삭제된 메모는 <strong>7일간</strong> 보관된 뒤 자동으로 영구 삭제됩니다.
        </p>
        {trashMemos.length === 0 ? (
          <p className="history-trash-empty">휴지통이 비어 있습니다.</p>
        ) : (
          <ul className="history-trash-list">
            {trashMemos.map((m) => (
              <li key={m.id} className="history-trash-item">
                <span className="history-trash-preview" title={firstLinePreview(m.content, 80)}>
                  {firstLinePreview(m.content, 40) || '(내용 없음)'}
                </span>
                {m.deletedAt ? (
                  <span className="history-trash-date">{formatDate(m.deletedAt)}</span>
                ) : null}
                <button
                  type="button"
                  className="history-trash-restore"
                  onClick={() => void window.snapnote.memo.restore(m.id).then(load)}
                >
                  복원
                </button>
                <button
                  type="button"
                  className="history-trash-delete"
                  onClick={() => setConfirmDelete({ kind: 'permanent', memo: m })}
                >
                  영구 삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  )
}
