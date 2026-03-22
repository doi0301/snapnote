import { useCallback, useEffect, useRef, useState } from 'react'
import type { Memo, MemoId } from '@shared/types'
import { EmptyState } from './EmptyState'
import { MemoSlot, type SlotColorMap } from './MemoSlot'
import { useFoldedPanelContentHeight } from './useFoldedPanelContentHeight'
import './folded.css'

function settingsToSlotColors(s: {
  colorSlot1: string
  colorSlot2: string
  colorSlot3: string
}): SlotColorMap {
  return { coral: s.colorSlot1, green: s.colorSlot2, blue: s.colorSlot3 }
}

export function FoldedPanel(): React.JSX.Element {
  const [stack, setStack] = useState<MemoId[]>([])
  const [memos, setMemos] = useState<Memo[]>([])
  const [slotColors, setSlotColors] = useState<SlotColorMap | undefined>(undefined)
  const previewEnterTimer = useRef<number | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useFoldedPanelContentHeight(rootRef, [stack.length, memos.length])

  useEffect(() => {
    void window.snapnote.app.getState().then((s) => setStack(s.foldedStack))
    return window.snapnote.on.stackChanged(setStack)
  }, [])

  useEffect(() => {
    void window.snapnote.settings.get().then((s) => setSlotColors(settingsToSlotColors(s)))
    return window.snapnote.on.settingsChanged((s) => setSlotColors(settingsToSlotColors(s)))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Memo[] = []
      for (const id of stack) {
        try {
          next.push(await window.snapnote.memo.get(id))
        } catch {
          /* 삭제됐지만 스택에 남은 id */
        }
      }
      if (!cancelled) setMemos(next)
    })()
    return () => {
      cancelled = true
    }
  }, [stack])

  /** 슬롯 쪽 호버 진입 시: 열기 대기 취소 + 닫기 예약 취소 */
  const clearPendingPreviewOpen = useCallback(() => {
    window.clearTimeout(previewEnterTimer.current)
    void window.snapnote.memo.cancelScheduledPreviewHide()
  }, [])

  const onPreviewEnter = useCallback(
    (id: MemoId, slotEl: HTMLElement) => {
      clearPendingPreviewOpen()
      previewEnterTimer.current = window.setTimeout(() => {
        const r = slotEl.getBoundingClientRect()
        void window.snapnote.memo.openPreview({
          id,
          anchor: { left: r.left, top: r.top, width: r.width, height: r.height }
        })
      }, 150)
    },
    [clearPendingPreviewOpen]
  )

  /**
   * 슬롯 이탈: 짧은 지연 후 닫기 → 패널 옆 프리뷰로 포인터를 옮겨 클릭할 틈 제공.
   * 프리뷰 `mouseenter`에서 `cancelScheduledPreviewHide` 호출.
   */
  const onPreviewLeave = useCallback(() => {
    window.clearTimeout(previewEnterTimer.current)
    void window.snapnote.memo.schedulePreviewHide(120)
  }, [])

  useEffect(() => () => clearPendingPreviewOpen(), [clearPendingPreviewOpen])

  const onNewMemo = useCallback(async () => {
    const m = await window.snapnote.memo.create()
    await window.snapnote.memo.openEdit(m.id)
  }, [])

  const onOpenHistory = useCallback(() => {
    void window.snapnote.app.openHistory()
  }, [])

  return (
    <div className="folded-root" ref={rootRef} data-testid="folded-panel">
      <header className="folded-drag">
        <span>SnapNote</span>
        <div className="folded-header-right folded-no-drag">
          <button
            type="button"
            className="folded-close-btn"
            title="닫기 (트레이에서 다시 열기)"
            aria-label="폴디드 패널 닫기"
            onClick={() => void window.snapnote.app.hideFoldedPanel()}
          >
            <span className="folded-close-icon" aria-hidden>
              {'\u2715'}
            </span>
          </button>
        </div>
      </header>
      <div className="folded-body">
        {memos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="folded-slot-list" role="list">
            {memos.map((memo) => (
              <MemoSlot
                key={memo.id}
                memo={memo}
                slotColors={slotColors}
                onMouseEnter={(el) => onPreviewEnter(memo.id, el)}
                onMouseLeave={onPreviewLeave}
                onOpenEdit={() => void window.snapnote.memo.openEdit(memo.id)}
                onCloseFromStack={() => void window.snapnote.memo.closeFromStack(memo.id)}
              />
            ))}
          </div>
        )}
      </div>
      <footer className="folded-footer folded-no-drag">
        <button
          type="button"
          className="folded-footer-btn folded-footer-btn--ghost"
          data-testid="folded-history"
          onClick={onOpenHistory}
        >
          전체보기
        </button>
        <button
          type="button"
          className="folded-footer-btn folded-footer-btn--primary"
          data-testid="folded-new-memo"
          onClick={() => void onNewMemo()}
        >
          + 새 메모
        </button>
      </footer>
    </div>
  )
}
