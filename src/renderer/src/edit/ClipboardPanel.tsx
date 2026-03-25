import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ClipboardItem } from '@shared/types'
import { getEditPopoverRoot } from './editPopoverRoot'
import { IconClipboard } from './toolbarIcons'
import './clipboard-panel.css'

/** 말줄임만 쓸 때와 비교용 — 실제 표시는 CSS line-clamp */
const LONG_PREVIEW_THRESHOLD = 72
const VIEW_MARGIN = 8
const GAP_PX = 6
const PANEL_MAX_W = 320
const PANEL_MAX_H = 360

function useClipboardPanelFixedStyle(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>
): React.CSSProperties | null {
  const [style, setStyle] = useState<React.CSSProperties | null>(null)

  const recalc = useCallback(() => {
    const el = anchorRef.current
    if (!el || !open) return
    const r = el.getBoundingClientRect()
    const w = Math.min(PANEL_MAX_W, window.innerWidth - 2 * VIEW_MARGIN)
    const maxH = Math.min(PANEL_MAX_H, Math.max(120, r.top - GAP_PX - VIEW_MARGIN))
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

export interface ClipboardPanelProps {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}

const IMAGE_TOOLTIP_MAX = 280

export function ClipboardPanel({ open, anchorRef, onClose }: ClipboardPanelProps): React.JSX.Element | null {
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [canInsert, setCanInsert] = useState(false)
  /** 펼친 미리보기 (한 번에 하나) */
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null)
  /** 이미지 항목 호버 미리보기 */
  const [imageTooltip, setImageTooltip] = useState<{
    id: number
    dataUrl: string
    left: number
    top: number
  } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const imagePreviewCacheRef = useRef<Map<number, string>>(new Map())
  const imageHoverShowTimerRef = useRef<number | null>(null)
  const imageHoverHideTimerRef = useRef<number | null>(null)
  const fixedStyle = useClipboardPanelFixedStyle(open, anchorRef)

  useEffect(() => {
    if (!open) return
    const load = async (): Promise<void> => {
      const list = await window.snapnote.clipboard.getHistory()
      setItems(list)
    }
    void load()
    return window.snapnote.on.clipboardItemAdded(() => void load())
  }, [open])

  useEffect(() => {
    if (!open) return
    const tick = async (): Promise<void> => {
      const ok = await window.snapnote.clipboard.hasEditInsertTarget()
      setCanInsert(ok)
    }
    void tick()
    const id = window.setInterval(tick, 400)
    const onWinFocus = (): void => void tick()
    window.addEventListener('focus', onWinFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onWinFocus)
    }
  }, [open])

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

  useEffect(() => {
    if (!open) setExpandedItemId(null)
  }, [open])

  const clearImageHoverTimers = useCallback((): void => {
    if (imageHoverShowTimerRef.current != null) {
      clearTimeout(imageHoverShowTimerRef.current)
      imageHoverShowTimerRef.current = null
    }
    if (imageHoverHideTimerRef.current != null) {
      clearTimeout(imageHoverHideTimerRef.current)
      imageHoverHideTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!open) {
      clearImageHoverTimers()
      setImageTooltip(null)
    }
  }, [open, clearImageHoverTimers])

  const positionImageTooltip = useCallback((anchor: DOMRect): { left: number; top: number } => {
    const pad = 8
    let left = anchor.right + pad
    if (left + IMAGE_TOOLTIP_MAX > window.innerWidth - pad) {
      left = Math.max(pad, anchor.left - IMAGE_TOOLTIP_MAX - pad)
    }
    let top = anchor.top
    const estH = IMAGE_TOOLTIP_MAX
    if (top + estH > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - estH - pad)
    }
    return { left, top }
  }, [])

  const showImagePreviewForRow = useCallback(
    (itemId: number, anchor: DOMRect): void => {
      clearImageHoverTimers()
      imageHoverShowTimerRef.current = window.setTimeout(() => {
        void (async (): Promise<void> => {
          let dataUrl = imagePreviewCacheRef.current.get(itemId)
          if (!dataUrl) {
            const res = await window.snapnote.clipboard.getImagePreview(itemId)
            if (!res?.dataUrl) return
            dataUrl = res.dataUrl
            imagePreviewCacheRef.current.set(itemId, dataUrl)
          }
          const { left, top } = positionImageTooltip(anchor)
          setImageTooltip({ id: itemId, dataUrl, left, top })
        })()
      }, 180)
    },
    [clearImageHoverTimers, positionImageTooltip]
  )

  const scheduleHideImageTooltip = useCallback((): void => {
    if (imageHoverHideTimerRef.current != null) {
      window.clearTimeout(imageHoverHideTimerRef.current)
    }
    imageHoverHideTimerRef.current = window.setTimeout(() => setImageTooltip(null), 380)
  }, [])

  const cancelHideImageTooltip = useCallback((): void => {
    if (imageHoverHideTimerRef.current != null) {
      window.clearTimeout(imageHoverHideTimerRef.current)
      imageHoverHideTimerRef.current = null
    }
  }, [])

  const onInsert = useCallback(async (text: string): Promise<void> => {
    const ok = await window.snapnote.clipboard.hasEditInsertTarget()
    if (!ok) return
    await window.snapnote.clipboard.insert({ text })
  }, [])

  const onCopyText = useCallback(async (text: string): Promise<void> => {
    await window.snapnote.clipboard.writeSystem(text)
  }, [])

  const onCopyImage = useCallback(async (id: number): Promise<void> => {
    await window.snapnote.clipboard.writeSystemImage(id)
  }, [])

  if (!open || !fixedStyle) return null

  const panel = (
    <div
      ref={panelRef}
      className="clipboard-panel"
      style={fixedStyle}
      role="dialog"
      aria-label="클립보드 히스토리"
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="clipboard-panel-title">클립보드</p>
      <ul className="clipboard-panel-list">
        {items.length === 0 ? (
          <li className="clipboard-panel-empty">복사한 텍스트·이미지가 여기에 쌓입니다</li>
        ) : (
          items.map((item) => {
            const kind = item.kind ?? 'text'
            const isImage = kind === 'image'
            const isLong = !isImage && item.text.length > LONG_PREVIEW_THRESHOLD
            const isExpanded = expandedItemId === item.id
            return (
              <li
                key={item.id}
                className={`clipboard-panel-row${isImage ? ' clipboard-panel-row--image' : ''}`}
                onMouseEnter={
                  isImage
                    ? (e) => {
                        cancelHideImageTooltip()
                        showImagePreviewForRow(item.id, e.currentTarget.getBoundingClientRect())
                      }
                    : undefined
                }
                onMouseLeave={
                  isImage
                    ? () => {
                        clearImageHoverTimers()
                        scheduleHideImageTooltip()
                      }
                    : undefined
                }
              >
                {isImage ? (
                  <div className="clipboard-panel-image-label" title="마우스를 올리면 이미지 미리보기">
                    <span className="clipboard-panel-image-badge" aria-hidden>
                      🖼
                    </span>
                    <span className="clipboard-panel-image-name">{item.text}</span>
                    <span className="clipboard-panel-preview-hint clipboard-panel-preview-hint--inline">
                      호버 시 미리보기
                    </span>
                  </div>
                ) : isLong ? (
                  <button
                    type="button"
                    className="clipboard-panel-preview clipboard-panel-preview--expandable"
                    title={
                      isExpanded
                        ? '클릭하여 접기'
                        : `${item.text.slice(0, 220)}${item.text.length > 220 ? '…' : ''}`
                    }
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded
                        ? '미리보기 접기'
                        : '긴 복사 내용 — 클릭하면 전체를 스크롤하여 볼 수 있습니다'
                    }
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setExpandedItemId((id) => (id === item.id ? null : item.id))}
                  >
                    <span
                      className={
                        isExpanded
                          ? 'clipboard-panel-preview-text clipboard-panel-preview-text--expanded'
                          : 'clipboard-panel-preview-text clipboard-panel-preview-text--clamped'
                      }
                    >
                      {item.text}
                    </span>
                    <span
                      className={
                        isExpanded
                          ? 'clipboard-panel-preview-hint clipboard-panel-preview-hint--collapse'
                          : 'clipboard-panel-preview-hint'
                      }
                    >
                      {isExpanded ? '클릭하여 접기' : '클릭하여 전체 · 스크롤'}
                    </span>
                  </button>
                ) : (
                  <span className="clipboard-panel-preview clipboard-panel-preview--short" title={item.text}>
                    {item.text}
                  </span>
                )}
                <span className="clipboard-panel-actions">
                  <button
                    type="button"
                    className="clipboard-panel-icon-btn"
                    disabled={!canInsert || isImage}
                    title={
                      isImage
                        ? '이미지는 텍스트 편집창에 삽입할 수 없습니다'
                        : canInsert
                          ? '마지막 포커스 편집 창 커서에 삽입'
                          : '편집 창을 먼저 포커스한 뒤 삽입할 수 있습니다'
                    }
                    aria-label="삽입"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={() => void onInsert(item.text)}
                  >
                    📥
                  </button>
                  <button
                    type="button"
                    className="clipboard-panel-icon-btn"
                    title={isImage ? '이미지를 시스템 클립보드에 복사' : '시스템 클립보드에 복사'}
                    aria-label="복사"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={() => void (isImage ? onCopyImage(item.id) : onCopyText(item.text))}
                  >
                    📋
                  </button>
                </span>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )

  const hoverLayer =
    imageTooltip != null
      ? createPortal(
          <div
            className="clipboard-panel-image-hover"
            style={{
              position: 'fixed',
              left: imageTooltip.left,
              top: imageTooltip.top,
              zIndex: 2147483640,
              pointerEvents: 'auto'
            }}
            onMouseEnter={cancelHideImageTooltip}
            onMouseLeave={scheduleHideImageTooltip}
          >
            <img src={imageTooltip.dataUrl} alt="" draggable={false} />
          </div>,
          getEditPopoverRoot()
        )
      : null

  return (
    <>
      {createPortal(panel, getEditPopoverRoot())}
      {hoverLayer}
    </>
  )
}

/** 툴바 옆 트리거 + `ClipboardPanel` (portal) */
export function ClipboardHistoryControl(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-testid="clipboard-panel-trigger"
        className={`format-toolbar-btn format-toolbar-btn--icon clipboard-history-trigger${open ? ' format-toolbar-btn--active' : ''}`}
        title="클립보드 히스토리"
        aria-expanded={open}
        aria-pressed={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        <IconClipboard size={18} />
      </button>
      <ClipboardPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} />
    </>
  )
}
