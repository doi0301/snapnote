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

/** 노랑·초록·분홍 — 대비·구분이 가장 잘 나는 고전 3색 */
const HL_SWATCHES: HighlightColor[] = ['yellow', 'green', 'pink']

const HL_LABEL: Record<HighlightColor, string> = {
  yellow: '노랑',
  green: '초록',
  pink: '분홍'
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
    const onDocDown = (ev: MouseEvent): void => {
      const el = ev.target as Element | null
      if (!el) return
      if (el.closest('.format-highlight-popover') || el.closest('.format-toolbar-btn--highlight')) {
        return
      }
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
    if (compactActions) return
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      suppressHlPrimaryClickRef.current = true
      openPalette()
    }, LONG_PRESS_MS)
  }, [clearLongPress, openPalette, compactActions])

  const onHlPointerUp = useCallback(() => {
    clearLongPress()
  }, [clearLongPress])

  const onHlContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (compactActions) return
      e.preventDefault()
      clearLongPress()
      openPalette()
    },
    [clearLongPress, openPalette, compactActions]
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
        title={
          compactActions
            ? '하이라이트 (아래 색상 또는 마지막 색 적용)'
            : '하이라이트 (클릭: 색 팔레트 · Ctrl+클릭: 마지막 색 적용)'
        }
        onPointerDown={(e) => {
          e.preventDefault()
          onHlPointerDown()
        }}
        onPointerUp={onHlPointerUp}
        onPointerCancel={onHlPointerUp}
        onPointerLeave={onHlPointerUp}
        onClick={(e) => {
          if (suppressHlPrimaryClickRef.current) {
            suppressHlPrimaryClickRef.current = false
            return
          }
          if (compactActions) {
            onHighlightPrimaryClick()
            return
          }
          if (e.ctrlKey || e.metaKey) {
            onHighlightPrimaryClick()
            return
          }
          setPaletteOpen((o) => !o)
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
            onClick={() => {
              setPaletteOpen(false)
              setActionModalOpen(true)
            }}
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
            <div className="format-toolbar-modal-hl" role="group" aria-label="형광펜 색상">
              <p className="format-toolbar-modal-hl-label">형광펜 색</p>
              <div className="format-toolbar-modal-hl-swatches">
                {HL_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`format-hl-swatch format-hl-swatch--${c}${c === lastHighlightColor ? ' format-hl-swatch--current' : ''}`}
                    title={HL_LABEL[c]}
                    aria-label={HL_LABEL[c]}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPickHighlightColor(c)
                      setPaletteOpen(false)
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {paletteOpen && !compactActions ? (
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
