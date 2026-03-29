import { useCallback, useEffect, useRef, useState } from 'react'
import type { HighlightColor } from '@shared/types'
import { EmojiPalette } from './EmojiPalette'
import {
  IconToolbarBold,
  IconToolbarCheckbox,
  IconToolbarDivider,
  IconToolbarEmoji,
  IconToolbarFormat,
  IconToolbarHighlight,
  IconToolbarStrikethrough
} from './toolbarIcons'
import './format-toolbar.css'

const HL_SWATCHES: HighlightColor[] = ['yellow', 'green', 'pink', 'blue', 'orange']

const HL_LABEL: Record<HighlightColor, string> = {
  yellow: '노랑',
  green: '초록',
  pink: '분홍',
  blue: '파랑',
  orange: '주황'
}

const LONG_PRESS_MS = 500

export interface FormatToolbarProps {
  boldActive: boolean
  strikeActive: boolean
  highlightActive: boolean
  lineCheckboxActive: boolean
  lineDividerActive: boolean
  onBold: () => void
  onStrikethrough: () => void
  lastHighlightColor: HighlightColor
  onHighlightPrimaryClick: () => void
  onPickHighlightColor: (color: HighlightColor) => void
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

  const hlBtnClass = `format-toolbar-btn--highlight format-toolbar-btn--hl-${lastHighlightColor}${highlightActive ? ' format-toolbar-btn--active' : ''}`

  const symbolButton = (
    <button
      ref={symbolBtnRef}
      type="button"
      className={`format-toolbar-btn format-toolbar-btn--icon format-toolbar-btn--symbols${symbolPaletteOpen ? ' format-toolbar-btn--active' : ''}`}
      title="기호 입력"
      aria-label="기호 입력"
      aria-expanded={symbolPaletteOpen}
      aria-pressed={symbolPaletteOpen}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggleSymbolPalette}
    >
      <IconToolbarEmoji size={18} />
    </button>
  )

  const formattingButtons = (
    <>
      <button
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--icon format-toolbar-btn--bold${boldActive ? ' format-toolbar-btn--active' : ''}`}
        aria-pressed={boldActive}
        title="굵게 (Ctrl+B)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onBold}
      >
        <IconToolbarBold size={18} />
      </button>
      <button
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--icon format-toolbar-btn--strike${strikeActive ? ' format-toolbar-btn--active' : ''}`}
        aria-pressed={strikeActive}
        title="취소선 (Ctrl+Shift+X)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onStrikethrough}
      >
        <IconToolbarStrikethrough size={18} />
      </button>
      <button
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--icon ${hlBtnClass}`}
        title="하이라이트"
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
        <IconToolbarHighlight size={18} />
      </button>
      <button
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--icon format-toolbar-btn--checkbox${lineCheckboxActive ? ' format-toolbar-btn--active' : ''}`}
        title="체크박스"
        aria-pressed={lineCheckboxActive}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleLineCheckbox}
      >
        <IconToolbarCheckbox size={18} />
      </button>
      <button
        type="button"
        className={`format-toolbar-btn format-toolbar-btn--icon format-toolbar-btn--divider${lineDividerActive ? ' format-toolbar-btn--active' : ''}`}
        title="구분선"
        aria-pressed={lineDividerActive}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleLineDivider}
      >
        <IconToolbarDivider size={18} />
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
        <div className="format-toolbar format-toolbar--compact-row" role="toolbar" aria-label="텍스트 서식 (축약)">
          {symbolButton}
          <button
            type="button"
            className="format-toolbar-btn format-toolbar-btn--icon format-toolbar-btn--text-tools"
            title="텍스트 서식"
            aria-label="텍스트 서식"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setActionModalOpen(true)}
          >
            <IconToolbarFormat size={18} />
          </button>
        </div>
      ) : (
        <div className="format-toolbar" role="toolbar" aria-label="텍스트 서식">
          {symbolButton}
          {formattingButtons}
        </div>
      )}
      {compactActions && actionModalOpen ? (
        <div
          className="format-toolbar-modal-backdrop"
          onMouseDown={() => setActionModalOpen(false)}
          role="dialog"
          aria-label="서식 도구"
        >
          <div className="format-toolbar-modal" onMouseDown={(e) => e.stopPropagation()}>
            <p className="format-toolbar-modal-title">텍스트 서식</p>
            <div className="format-toolbar format-toolbar--modal" role="toolbar" aria-label="텍스트 서식 모달">
              {formattingButtons}
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
