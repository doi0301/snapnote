import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { HighlightColor, Memo, MemoId } from '@shared/types'
import { EmojiPalette } from './EmojiPalette'
import { getEditPopoverRoot } from './editPopoverRoot'
import {
  IconToolbarBold,
  IconToolbarCheckbox,
  IconToolbarDivider,
  IconToolbarEmoji,
  IconToolbarMemoLink,
  IconToolbarMore,
  IconToolbarStrikethrough,
  IconToolbarUnderline
} from './toolbarIcons'
import './format-toolbar.css'

/** 노랑·초록·분홍·회색 */
const HL_SWATCHES: HighlightColor[] = ['yellow', 'green', 'pink', 'gray']

const HL_LABEL: Record<HighlightColor, string> = {
  yellow: '노랑',
  green: '초록',
  pink: '분홍',
  gray: '회색'
}

/** 본문에 붙는 실제 마커 — Editor.tsx 의 HEADING_MARKERS 와 동일 */
const HEADING_MARKER_TOOLTIP: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '[ ]',
  2: '< >',
  3: '( )',
  4: '\u25B8\u00A0',
  5: '-\u00A0'
}

export interface FormatToolbarProps {
  boldActive: boolean
  strikeActive: boolean
  underlineActive: boolean
  lineCheckboxActive: boolean
  lineDividerActive: boolean
  onBold: () => void
  onStrikethrough: () => void
  onUnderline: () => void
  /** 선택 구간 전체에 해당 색 형광이 있을 때만 true — 스와치 테두리 */
  highlightFullByColor: Record<HighlightColor, boolean>
  onPickHighlightColor: (color: HighlightColor) => void
  onToggleLineCheckbox: () => void
  onToggleLineDivider: () => void
  currentMemoId: MemoId
  onApplyMemoLink: (targetMemoId: MemoId) => void
  onClearMemoLinks: () => void
  openLinkPicker?: boolean
  headingLevel?: 1 | 2 | 3 | 4 | 5
  onHeading: (level: 1 | 2 | 3 | 4 | 5) => void
  compactActions?: boolean
  symbolPaletteOpen: boolean
  onToggleSymbolPalette: () => void
  onSymbolSelect: (char: string) => void
  onCloseSymbolPalette: () => void
}

export function FormatToolbar({
  boldActive,
  strikeActive,
  underlineActive,
  lineCheckboxActive,
  lineDividerActive,
  onBold,
  onStrikethrough,
  onUnderline,
  highlightFullByColor,
  onPickHighlightColor,
  onToggleLineCheckbox,
  onToggleLineDivider,
  currentMemoId,
  onApplyMemoLink,
  onClearMemoLinks,
  openLinkPicker,
  headingLevel,
  onHeading,
  compactActions = false,
  symbolPaletteOpen,
  onToggleSymbolPalette,
  onSymbolSelect,
  onCloseSymbolPalette
}: FormatToolbarProps): React.JSX.Element {
  const symbolBtnRef = useRef<HTMLButtonElement>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [linkPickerOpen, setLinkPickerOpen] = useState(false)

  useEffect(() => {
    if (openLinkPicker && !linkPickerOpen) {
      setLinkPickerOpen(true)
    }
  }, [openLinkPicker])
  const [linkPickList, setLinkPickList] = useState<Memo[]>([])
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

  useEffect(() => {
    if (!linkPickerOpen) return
    void window.snapnote.memo.getAll().then((list) => {
      const others = list.filter((m) => m.id !== currentMemoId)
      others.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
      setLinkPickList(others)
    })
  }, [linkPickerOpen, currentMemoId])

  const openTextToolsModal = (): void => {
    setPaletteOpen(false)
    setActionModalOpen(true)
  }

  const moreToolsButton = (
    <button
      type="button"
      className={`format-toolbar-btn format-toolbar-btn--icon format-toolbar-btn--more-tools${actionModalOpen ? ' format-toolbar-btn--active' : ''}`}
      title="더보기: 형광펜, 메모 링크, 제목"
      aria-label="텍스트 서식 더보기"
      aria-expanded={actionModalOpen}
      onMouseDown={(e) => e.preventDefault()}
      onClick={openTextToolsModal}
    >
      <IconToolbarMore size={18} />
    </button>
  )

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
        className={`format-toolbar-btn format-toolbar-btn--icon${underlineActive ? ' format-toolbar-btn--active' : ''}`}
        title="밑줄 (Ctrl+U)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onUnderline}
      >
        <IconToolbarUnderline size={18} />
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

  const linkPickerModal = (
    <div
      className="format-toolbar-modal-backdrop"
      onMouseDown={() => setLinkPickerOpen(false)}
      role="dialog"
      aria-label="연결할 메모"
    >
      <div className="format-toolbar-modal" onMouseDown={(e) => e.stopPropagation()}>
        <p className="format-toolbar-modal-title">연결할 메모</p>
        <div className="format-memo-link-popover-actions">
          <button
            type="button"
            className="format-memo-link-clear-all"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClearMemoLinks()
              setLinkPickerOpen(false)
            }}
          >
            선택 영역 링크 해제
          </button>
        </div>
        <div className="format-memo-link-list" role="presentation">
          {linkPickList.length === 0 ? (
            <p className="format-memo-link-empty">연결할 다른 메모가 없습니다.</p>
          ) : (
            linkPickList.map((m) => {
              const title = (m.content[0]?.text ?? '').trim() || '(제목 없음)'
              const trimmed = title.length > 56 ? `${title.slice(0, 56)}…` : title
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  className="format-memo-link-row"
                  title={title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onApplyMemoLink(m.id)
                    setLinkPickerOpen(false)
                  }}
                >
                  <span className="format-memo-link-row-title">{trimmed}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )

  const actionToolsModal = (
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
                className={`format-hl-swatch format-hl-swatch--${c}${highlightFullByColor[c] ? ' format-hl-swatch--current' : ''}`}
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
        <div className="format-toolbar-modal-memo-link" role="group" aria-label="메모 연결">
          <button
            type="button"
            className="format-toolbar-modal-open-memo-links"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setLinkPickerOpen(true)
              setActionModalOpen(false)
            }}
          >
            <IconToolbarMemoLink size={14} /> 다른 메모로 연결
          </button>
        </div>
        <div className="format-toolbar-modal-heading" role="group" aria-label="제목 위계">
          <p className="format-toolbar-modal-hl-label">제목 위계</p>
          <div className="format-toolbar-modal-heading-row">
            {([1, 2, 3, 4, 5] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                className={`format-toolbar-btn format-toolbar-btn--heading${headingLevel === lv ? ' format-toolbar-btn--active' : ''}`}
                title={`Ctrl+${lv} / ${HEADING_MARKER_TOOLTIP[lv]}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onHeading(lv)
                  setActionModalOpen(false)
                }}
              >
                H{lv}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
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
            {moreToolsButton}
          </div>
        ) : (
          <div className="format-toolbar" role="toolbar" aria-label="텍스트 서식">
            {symbolButton}
            {formattingButtons}
            {moreToolsButton}
          </div>
        )}
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
                className={`format-hl-swatch format-hl-swatch--${c}${highlightFullByColor[c] ? ' format-hl-swatch--current' : ''}`}
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
      {actionModalOpen ? createPortal(actionToolsModal, getEditPopoverRoot()) : null}
      {linkPickerOpen ? createPortal(linkPickerModal, getEditPopoverRoot()) : null}
    </>
  )
}
