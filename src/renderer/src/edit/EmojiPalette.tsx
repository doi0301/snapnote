import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EMOJI_PALETTE_ITEMS } from './emojiPaletteItems'
import { getEditPopoverRoot } from './editPopoverRoot'
import './emoji-palette.css'

const VIEW_MARGIN = 8
const GAP_PX = 6
const PANEL_MAX_W = 320
const PANEL_MAX_H = 280

export interface EmojiPaletteProps {
  open: boolean
  /** 심볼 버튼 등 앵커 — fixed 좌표 계산용 */
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  /** 심볼 삽입 후 호출부에서 닫기 처리 */
  onSelectSymbol: (char: string) => void
}

function usePaletteFixedStyle(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>
): React.CSSProperties | null {
  const [style, setStyle] = useState<React.CSSProperties | null>(null)

  const recalc = useCallback(() => {
    const el = anchorRef.current
    if (!el || !open) return
    const r = el.getBoundingClientRect()
    const w = Math.min(PANEL_MAX_W, window.innerWidth - 2 * VIEW_MARGIN)
    const maxH = Math.min(PANEL_MAX_H, Math.max(100, r.top - GAP_PX - VIEW_MARGIN))
    let left = r.left
    if (left + w > window.innerWidth - VIEW_MARGIN) {
      left = window.innerWidth - VIEW_MARGIN - w
    }
    if (left < VIEW_MARGIN) left = VIEW_MARGIN
    const bottom = window.innerHeight - r.top + GAP_PX
    setStyle({
      position: 'fixed',
      left,
      bottom,
      width: w,
      maxHeight: maxH,
      zIndex: 100000
    })
  }, [open, anchorRef])

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null)
      return
    }
    recalc()
    const ae = anchorRef.current
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recalc) : null
    if (ae && ro) ro.observe(ae)
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [open, recalc, anchorRef])

  return open ? style : null
}

export function EmojiPalette({
  open,
  anchorRef,
  onClose,
  onSelectSymbol
}: EmojiPaletteProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const fixedStyle = usePaletteFixedStyle(open, anchorRef)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (ev: MouseEvent): void => {
      const panel = panelRef.current
      const anchor = anchorRef.current
      const t = ev.target as Node
      if (panel?.contains(t)) return
      if (anchor?.contains(t)) return
      onClose()
    }
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocMouseDown)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [open, onClose, anchorRef])

  if (!open || !fixedStyle) return null

  const panel = (
    <div
      ref={panelRef}
      className="emoji-palette-panel"
      style={fixedStyle}
      role="dialog"
      aria-label="이모지·특수문자 팔레트"
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="emoji-palette-title">이모지·특수문자</p>
      <div className="emoji-palette-grid">
        {EMOJI_PALETTE_ITEMS.map((entry, i) =>
          entry.kind === 'sep' ? (
            <div key={`sep-${i}`} className="emoji-palette-sep" role="separator" />
          ) : (
            <button
              key={`${entry.char}-${i}`}
              type="button"
              className="emoji-palette-cell"
              title={entry.label}
              aria-label={entry.label}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={() => onSelectSymbol(entry.char)}
            >
              {entry.char}
            </button>
          )
        )}
      </div>
    </div>
  )

  return createPortal(panel, getEditPopoverRoot())
}
