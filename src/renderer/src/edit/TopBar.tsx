import { useCallback, useRef, useState, type JSX } from 'react'
import { TrashIcon } from '@renderer/components/TrashIcon'
import { IconTopBarMinimize, IconTopBarPin } from './toolbarIcons'

interface TopBarProps {
  isPinned: boolean
  onPinToggle: () => void
  onFold: () => void
  onCloseFromStack: () => void
}

export function TopBar(props: TopBarProps): JSX.Element {
  const { isPinned, onPinToggle, onFold, onCloseFromStack } = props
  const lastScreenRef = useRef<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

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
          title="접기"
          data-testid="edit-fold-btn"
          onClick={() => void onFold()}
        >
          <IconTopBarMinimize size={17} />
        </button>
        <button
          type="button"
          className="edit-icon-btn edit-icon-btn--trash edit-icon-btn--line"
          title="스택에서 제거"
          aria-label="스택에서 제거"
          onClick={() => void onCloseFromStack()}
        >
          <TrashIcon size={17} />
        </button>
      </div>
    </header>
  )
}
