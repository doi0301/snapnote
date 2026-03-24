import { useCallback, useEffect, useRef, useState } from 'react'
import type { HighlightColor } from '@shared/types'
import { EmojiPalette } from './EmojiPalette'
import './format-toolbar.css'

const HL_SWATCHES: HighlightColor[] = ['yellow', 'green', 'pink']

const HL_LABEL: Record<HighlightColor, string> = {
  yellow: '노랑',
  green: '초록',
  pink: '분홍'
}

const LONG_PRESS_MS = 500

export interface FormatToolbarProps {
  /** 볼드 입력 모드 또는 캐럿/선택 위치에 볼드 적용됨 */
  boldActive: boolean
  strikeActive: boolean
  highlightActive: boolean
  /** 현재 줄에 체크박스 열이 켜져 있음 */
  lineCheckboxActive: boolean
  lineDividerActive: boolean
  onBold: () => void
  onStrikethrough: () => void
  lastHighlightColor: HighlightColor
  /** 마지막 사용 색으로 선택 구간 하이라이트 (선택 없으면 Editor에서 무시) */
  onHighlightPrimaryClick: () => void
  /** 팔레트에서 색 선택: 마지막 색 갱신 + 선택 구간에 적용 */
  onPickHighlightColor: (color: HighlightColor) => void
  /** 현재 줄에 체크박스 표시 토글 */
  onToggleLineCheckbox: () => void
  onToggleLineDivider: () => void
  compactActions?: boolean
  symbolPaletteOpen: boolean
  onToggleSymbolPalette: () => void
  onSymbolSelect: (char: string) => void
  onCloseSymbolPalette: () => void
}

export function FormatToolbar({
  boldActive,
  strikeActive,
  highlightActive,
  lineCheckboxActive,
  lineDividerActive,
  onBold,
  onStrikethrough,
  lastHighlightColor,
  onHighlightPrimaryClick,
  onPickHighlightColor,
  onToggleLineCheckbox,
  onToggleLineDivider,
  compactActions = false,
  symbolPaletteOpen,
  onToggleSymbolPalette,
  onSymbolSelect,
  onCloseSymbolPalette
}: FormatToolbarProps): React.JSX.Element {
  const symbolBtnRef = useRef<HTMLButtonElement>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 길게 눌러 팔레트 연 직후의 click으로 적용 방지 */
  const suppressHlPrimaryClickRef = useRef(false)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!paletteOpen) return
    const onDocDown = (): void => {
      setPaletteOpen(false)
    }
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocDown)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDocDown)
    }
  }, [paletteOpen])

  useEffect(() => {
    if (!actionModalOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setActionModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actionModalOpen])

  const openPalette = useCallback(() => {
    setPaletteOpen(true)
  }, [])

  const onHlPointerDown = useCallback(() => {
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      suppressHlPrimaryClickRef.current = true
      openPalette()
    }, LONG_PRESS_MS)
  }, [clearLongPress, openPalette])

  const onHlPointerUp = useCallback(() => {
    clearLongPress()
  }, [clearLongPress])

  const onHlContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      clearLongPress()
      openPalette()
    },
    [clearLongPress, openPalette]
  )

  const hlBtnClass = `format-toolbar-btn format-toolbar-btn--highlight format-toolbar-btn--hl-${lastHighlightColor}${highlightActive ? ' format-toolbar-btn--active' : ''}`

  const actionButtons = (
    <>
      <button
        ref={symbolBtnRef}
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--symbols${symbolPaletteOpen ? ' format-toolbar-btn--active' : ''}`}
        title="이모지·특수문자 팔레트"
        aria-label="이모지·특수문자 팔레트"
        aria-expanded={symbolPaletteOpen}
        aria-pressed={symbolPaletteOpen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleSymbolPalette}
      >
        <span className="format-toolbar-symbols-emoji" aria-hidden>
          😊
        </span>
      </button>
      <button
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--bold${boldActive ? ' format-toolbar-btn--active' : ''}`}
        aria-pressed={boldActive}
        title="Bold (Ctrl+B)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onBold}
      >
        B
      </button>
      <button
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--strike${strikeActive ? ' format-toolbar-btn--active' : ''}`}
        aria-pressed={strikeActive}
        title="Strikethrough (Ctrl+Shift+X)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onStrikethrough}
      >
        <span className="format-toolbar-strike-label">S</span>
      </button>
      <button
        type="button"
        className={hlBtnClass}
        title="하이라이트 (클릭: 마지막 색 / 우클릭·길게 누르기: 색 선택)"
        onPointerDown={(e) => {
          e.preventDefault()
          onHlPointerDown()
        }}
        onPointerUp={onHlPointerUp}
        onPointerCancel={onHlPointerUp}
        onPointerLeave={onHlPointerUp}
        onClick={() => {
          if (paletteOpen) return
          if (suppressHlPrimaryClickRef.current) {
            suppressHlPrimaryClickRef.current = false
            return
          }
          onHighlightPrimaryClick()
        }}
        onContextMenu={onHlContextMenu}
        aria-pressed={highlightActive}
      >
        H
      </button>
      <button
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--checkbox${lineCheckboxActive ? ' format-toolbar-btn--active' : ''}`}
        title="줄 체크박스"
        aria-pressed={lineCheckboxActive}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleLineCheckbox}
      >
        ☐
      </button>
      <button
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--divider${lineDividerActive ? ' format-toolbar-btn--active' : ''}`}
        title="중간 구분선"
        aria-pressed={lineDividerActive}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleLineDivider}
      >
        ─
      </button>
    </>
  )

  return (
    <div className="format-toolbar-wrap">
      <EmojiPalette
        open={symbolPaletteOpen}
        anchorRef={symbolBtnRef}
        onClose={onCloseSymbolPalette}
        onSelectSymbol={onSymbolSelect}
      />
      {compactActions ? (
        <div className="format-toolbar" role="toolbar" aria-label="텍스트 서식">
          <button
            type="button"
            className="format-toolbar-btn format-toolbar-btn--text-actions"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setActionModalOpen(true)}
          >
            텍스트편집
          </button>
        </div>
      ) : (
        <div className="format-toolbar" role="toolbar" aria-label="텍스트 서식">
          {actionButtons}
        </div>
      )}
      {compactActions && actionModalOpen ? (
        <div
          className="format-toolbar-modal-backdrop"
          onMouseDown={() => setActionModalOpen(false)}
          role="dialog"
          aria-label="텍스트 편집 도구"
        >
          <div
            className="format-toolbar-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="format-toolbar-modal-title">텍스트 편집</p>
            <div className="format-toolbar format-toolbar--modal" role="toolbar" aria-label="텍스트 서식 모달">
              {actionButtons}
            </div>
          </div>
        </div>
      ) : null}
      {paletteOpen ? (
        <div
          className="format-highlight-popover"
          role="menu"
          aria-label="하이라이트 색"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {HL_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              role="menuitem"
              className={`format-hl-swatch format-hl-swatch--${c}${c === lastHighlightColor ? ' format-hl-swatch--current' : ''}`}
              title={HL_LABEL[c]}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={() => {
                onPickHighlightColor(c)
                setPaletteOpen(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
