import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Memo, MemoId } from '@shared/types'
import { memoHasTextContent } from '@shared/memoContent'
import { filterHistoryMemos } from '@shared/historyFilter'
import { collectAllTags } from '@renderer/edit/tagUtils'
import { ConfirmDialog } from './ConfirmDialog'
import { MemoList } from './MemoList'
import { SearchBar } from './SearchBar'
import { TagFilterBar } from './TagFilterBar'
import './history-modal.css'

const LIST_CAP = 50

function closeWindow(): void {
  window.close()
}

export function HistoryModal(): React.JSX.Element {
  const [memos, setMemos] = useState<Memo[]>([])
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => new Set())
  const [selectedIds, setSelectedIds] = useState<Set<MemoId>>(() => new Set())
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'one'; memo: Memo }
    | { kind: 'bulk'; ids: MemoId[] }
    | null
  >(null)

  const load = useCallback((): void => {
    void window.snapnote.memo.getAll().then(setMemos)
  }, [])

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

  /** 본문에 글자가 있는 메모만 히스토리에 노출 */
  const substantiveMemos = useMemo(() => memos.filter((m) => memoHasTextContent(m)), [memos])

  const allTags = useMemo(() => collectAllTags(substantiveMemos), [substantiveMemos])

  const filtered = useMemo(() => {
    return filterHistoryMemos(substantiveMemos, debouncedQuery, selectedTags)
  }, [substantiveMemos, selectedTags, debouncedQuery])

  const displayList = useMemo(() => filtered.slice(0, LIST_CAP), [filtered])

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
      await window.snapnote.memo.delete(c.memo.id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(c.memo.id)
        return next
      })
    } else {
      for (const id of c.ids) {
        await window.snapnote.memo.delete(id)
      }
      setSelectedIds(new Set())
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
      ? `"${(confirmDelete.memo.content[0]?.text ?? '').trim().slice(0, 80) || '(제목 없음)'}"\n\n이 메모를 영구 삭제할까요?`
      : confirmDelete?.kind === 'bulk'
        ? `선택한 ${confirmDelete.ids.length}개 메모를 영구 삭제할까요?`
        : ''

  return (
    <div
      className="history-window"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <ConfirmDialog
        open={confirmDelete !== null}
        title="메모 삭제"
        message={confirmMessage}
        confirmLabel="삭제"
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
    </div>
  )
}
