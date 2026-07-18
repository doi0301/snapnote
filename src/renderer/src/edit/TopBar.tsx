import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { MemoId } from '@shared/types'
import { IconTopBarMinimize, IconTopBarPin, IconTopBarWindowList } from './toolbarIcons'

interface TopBarProps {
  currentMemoId: MemoId
  isPinned: boolean
  onPinToggle: () => void
  onFold: () => void
  onCloseWindow: () => void
}

type OpenWinItem = { memoId: MemoId; title: string }

export function TopBar(props: TopBarProps): JSX.Element {
  const { currentMemoId, isPinned, onPinToggle, onFold, onCloseWindow } = props
  const lastScreenRef = useRef<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [openWindows, setOpenWindows] = useState<OpenWinItem[]>([])
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listWrapRef = useRef<HTMLDivElement>(null)

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const loadOpenWindows = useCallback(async () => {
    try {
      const list = await window.snapnote.app.listOpenEditWindows()
      setOpenWindows(list)
    } catch {
      setOpenWindows([])
    }
  }, [])

  const openList = useCallback(() => {
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => {
      void loadOpenWindows().then(() => setListOpen(true))
    }, 150)
  }, [clearHoverTimer, loadOpenWindows])

  const scheduleCloseList = useCallback(() => {
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => setListOpen(false), 180)
  }, [clearHoverTimer])

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer])

  const onDragStripPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    lastScreenRef.current = { x: e.screenX, y: e.screenY }
    setDragging(true)
  }, [])

  const onDragStripPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.buttons & 1) !== 1) return
    const prev = lastScreenRef.current
    if (!prev) return
    let dx = e.movementX
    let dy = e.movementY
    if (dx === 0 && dy === 0) {
      dx = e.screenX - prev.x
      dy = e.screenY - prev.y
    }
    lastScreenRef.current = { x: e.screenX, y: e.screenY }
    if (dx === 0 && dy === 0) return
    window.snapnote.app.moveEditWindowByDelta(dx, dy)
  }, [])

  const endDragStrip = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    lastScreenRef.current = null
    setDragging(false)
    window.snapnote.app.notifyEditWindowDragEnd()
  }, [])

  return (
    <header className="edit-topbar edit-topbar--compact" aria-label="편집 창">
      <div
        className={`edit-topbar-drag-strip${dragging ? ' edit-topbar-drag-strip--dragging' : ''}`}
        aria-hidden
        onPointerDown={onDragStripPointerDown}
        onPointerMove={onDragStripPointerMove}
        onPointerUp={endDragStrip}
        onPointerCancel={endDragStrip}
      />
      <div className="edit-topbar-actions">
        <div
          ref={listWrapRef}
          className="edit-window-list-wrap"
          onMouseEnter={openList}
          onMouseLeave={scheduleCloseList}
        >
          <button
            type="button"
            className="edit-icon-btn edit-icon-btn--line"
            title="열린 편집창 목록"
            aria-label="열린 편집창 목록"
            aria-expanded={listOpen}
            onClick={() => {
              clearHoverTimer()
              if (listOpen) setListOpen(false)
              else void loadOpenWindows().then(() => setListOpen(true))
            }}
          >
            <IconTopBarWindowList size={17} />
          </button>
          {listOpen ? (
            <div className="edit-window-list-popover" role="menu" aria-label="열린 편집창">
              {openWindows.length === 0 ? (
                <div className="edit-window-list-empty">열린 편집창 없음</div>
              ) : (
                openWindows.map((item) => (
                  <button
                    key={item.memoId}
                    type="button"
                    role="menuitem"
                    className={`edit-window-list-item${item.memoId === currentMemoId ? ' edit-window-list-item--current' : ''}`}
                    title={item.title}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setListOpen(false)
                      void window.snapnote.memo.openEdit(item.memoId)
                    }}
                  >
                    {item.title}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="edit-icon-btn edit-icon-btn--line"
          title={isPinned ? '고정 해제' : '항상 위 고정'}
          data-active={isPinned ? 'true' : 'false'}
          aria-pressed={isPinned}
          onClick={() => void onPinToggle()}
        >
          <IconTopBarPin size={17} />
        </button>
        <button
          type="button"
          className="edit-icon-btn edit-icon-btn--line"
          title="작업표시줄로 최소화"
          data-testid="edit-fold-btn"
          onClick={() => void onFold()}
        >
          <IconTopBarMinimize size={17} />
        </button>
        <button
          type="button"
          className="edit-icon-btn edit-icon-btn--line"
          title="창 닫기"
          aria-label="창 닫기"
          onClick={() => void onCloseWindow()}
        >
          <span aria-hidden>{'\u2715'}</span>
        </button>
      </div>
    </header>
  )
}
