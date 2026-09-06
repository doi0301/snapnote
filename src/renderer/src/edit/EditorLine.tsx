import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject
} from 'react'
import type { EditorLine as EditorLineModel, HighlightColor } from '@shared/types'
import { Checkbox } from './Checkbox'
import type { SearchHighlight } from './InlineSpan'
import { SpannedLineMirror } from './InlineSpan'
import { IconChevronDown, IconChevronUp, IconDragHandle } from './toolbarIcons'
import './editor-line.css'
import './keycap-badge.css'
import './format-toolbar.css'

export const INDENT_PX = 20

const INDENT_ALPHA = [0.02, 0.06, 0.09, 0.11, 0.13, 0.14, 0.15]

/** 노랑·초록·분홍·회색·파랑·주황·보라 (FormatToolbar 의 하이라이트 팔레트와 동일) */
const SECTION_COLOR_SWATCHES: HighlightColor[] = ['yellow', 'green', 'pink', 'gray', 'blue', 'orange', 'purple']
const SECTION_COLOR_LABEL: Record<HighlightColor, string> = {
  yellow: '노랑',
  green: '초록',
  pink: '분홍',
  gray: '회색',
  blue: '파랑',
  orange: '주황',
  purple: '보라'
}

/** 섹션 타이틀 색상 아이콘 + 드롭다운 — 공간을 차지하지 않는 작은 원형 버튼 */
function SectionColorPicker(props: {
  color?: HighlightColor
  onPick: (color: HighlightColor) => void
}): React.JSX.Element {
  const { color, onPick } = props
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onDocDown = (ev: MouseEvent): void => {
      const el = ev.target as Element | null
      if (el?.closest('.editor-section-color-popover') || el?.closest('.editor-section-color-btn')) {
        return
      }
      setOpen(false)
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDocDown), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDocDown)
    }
  }, [open])

  return (
    <div className="editor-section-color-wrap">
      <button
        type="button"
        className={`editor-section-color-btn${color ? ` editor-section-color-btn--${color}` : ' editor-section-color-btn--default'}`}
        title="섹션 색상 선택"
        aria-label="섹션 색상 선택"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <div className="editor-section-color-popover" role="menu" aria-label="섹션 색상">
          {SECTION_COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              role="menuitem"
              className={`format-hl-swatch format-hl-swatch--${c}${color === c ? ' format-hl-swatch--current' : ''}`}
              title={SECTION_COLOR_LABEL[c]}
              aria-label={SECTION_COLOR_LABEL[c]}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(c)
                setOpen(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** stuck 바에 표시할 제목 (첫 줄만, 줄바꿈은 공백) */
function stickyTitlePreviewText(text: string): string {
  const first = text.split(/\n/)[0] ?? ''
  return first.replace(/\r/g, '')
}

export interface EditorLineViewProps {
  line: EditorLineModel
  mirrorSelectionRange?: { start: number; end: number }
  placeholder?: string
  isStickyTitle?: boolean
  searchHighlights?: SearchHighlight[]
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBeforeInput?: (e: React.FormEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPointerDown?: (e: React.PointerEvent<HTMLTextAreaElement>) => void
  onPointerMove?: (e: React.PointerEvent<HTMLTextAreaElement>) => void
  onPointerLeave?: (e: React.PointerEvent<HTMLTextAreaElement>) => void
  onDoubleClick?: (e: React.MouseEvent<HTMLTextAreaElement>) => void
  onCompositionStart?: (e: React.CompositionEvent<HTMLTextAreaElement>) => void
  onCompositionEnd?: (e: React.CompositionEvent<HTMLTextAreaElement>) => void
  onSelect?: () => void
  onFocus?: () => void
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onCopy?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onCut?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onCheckboxToggle?: () => void
  onToggleLineCollapsed?: () => void
  /** 섹션 타이틀 아래 줄 접기/펼치기 — 거느린 본문이 있을 때만 전달됨 */
  onToggleSectionCollapsed?: () => void
  /** 섹션 블록 드래그 재정렬 시작 (hover 손잡이) */
  onSectionDragStart?: (e: React.PointerEvent<HTMLButtonElement>) => void
  /** 섹션 타이틀 배경색 선택 */
  onPickSectionColor?: (color: HighlightColor) => void
  /** sticky 제목이 상단에 고정됐을 때(true) — 한 줄 말줄임용 */
  onStickyStuckChange?: (stuck: boolean) => void
  /** 제목 sticky 감지용 스크롤 컨테이너 */
  stickyScrollRootRef?: RefObject<HTMLElement | null>
}

export const EditorLineView = memo(
  forwardRef<HTMLTextAreaElement, EditorLineViewProps>(function EditorLineView(props, ref) {
    const {
      line,
      mirrorSelectionRange,
      placeholder,
      onChange,
      onBeforeInput,
      onKeyDown,
      onPointerDown,
      onPointerMove,
      onPointerLeave,
      onDoubleClick,
      onCompositionStart,
      onCompositionEnd,
      onSelect,
      onFocus,
      onPaste,
      onCopy,
      onCut,
      onCheckboxToggle,
      onToggleLineCollapsed,
      onToggleSectionCollapsed,
      onSectionDragStart,
      onPickSectionColor,
      isStickyTitle,
      searchHighlights,
      onStickyStuckChange,
      stickyScrollRootRef
    } = props
    const level = Math.min(6, Math.max(0, line.indentLevel))
    const marginW = level * INDENT_PX
    const headingLevel = line.formatting?.headingLevel
    const headingClass = headingLevel ? ` editor-line--heading-${headingLevel}` : ''
    const isSectionTitle = Boolean(line.formatting?.sectionTitle)
    const sectionColorClass =
      isSectionTitle && line.formatting?.sectionColor ? ` editor-line--section-${line.formatting.sectionColor}` : ''
    const sectionClass = isSectionTitle ? ` editor-line--section-title${sectionColorClass}` : ''
    const isSectionCollapsed = isSectionTitle && Boolean(line.formatting?.sectionCollapsed)

    const accent = line.formatting?.accentBar
    const accentClass =
      accent === 'blue' || accent === 'teal' || accent === 'orange'
        ? ` editor-line-gutter--accent-${accent}`
        : ''

    const sentinelRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const [isStuck, setIsStuck] = useState(false)

    const bindTextareaRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        textareaRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      },
      [ref]
    )

    useEffect(() => {
      if (!isStickyTitle) return
      const sentinel = sentinelRef.current
      const root = stickyScrollRootRef?.current ?? null
      if (!sentinel) return

      const syncStuck = (entry?: IntersectionObserverEntry) => {
        if (root && root.scrollTop <= 1) {
          setIsStuck(false)
          return
        }
        if (entry) setIsStuck(!entry.isIntersecting)
      }

      const observer = new IntersectionObserver(
        ([entry]) => syncStuck(entry),
        { root, threshold: 0 }
      )
      observer.observe(sentinel)

      const onScroll = () => syncStuck()
      root?.addEventListener('scroll', onScroll, { passive: true })
      syncStuck()

      return () => {
        observer.disconnect()
        root?.removeEventListener('scroll', onScroll)
      }
    }, [isStickyTitle, stickyScrollRootRef])

    useEffect(() => {
      if (!isStickyTitle) return
      onStickyStuckChange?.(isStuck)
    }, [isStickyTitle, isStuck, onStickyStuckChange])

    useLayoutEffect(() => {
      if (!isStuck || !textareaRef.current) return
      textareaRef.current.scrollTop = 0
    }, [isStuck, line.text])

    const stickyClass = isStickyTitle ? ' editor-line--sticky-title' : ''
    const stuckClass = isStuck ? ' editor-line--stuck' : ''
    const isMultiLine = line.text.includes('\n')
    /** 섹션 접기 버튼과 accent 줄내 접기가 겹치지 않도록 섹션이면 줄내 접기 UI 숨김 */
    const canCollapse = !isSectionTitle && Boolean(accent) && isMultiLine
    const isLineCollapsed = canCollapse && Boolean(line.formatting?.lineCollapsed)
    const collapsedClass = isLineCollapsed ? ' editor-line--collapsed' : ''
    const firstLinePreview = stickyTitlePreviewText(line.text)

    return (
      <>
        {isStickyTitle && <div ref={sentinelRef} className="editor-sticky-sentinel" />}
        <div
          className={`editor-line editor-line--level-${level}${headingClass}${sectionClass}${stickyClass}${stuckClass}${collapsedClass}`}
          style={{ '--indent-level': level } as React.CSSProperties}
        >
          <div
            className={`editor-line-gutter${accentClass}`}
            style={
              {
                width: marginW,
                minWidth: marginW,
                '--indent-alpha': INDENT_ALPHA[level] ?? 0.02
              } as React.CSSProperties
            }
            aria-hidden
          >
            {accent ? <span className="editor-line-accent-bar" /> : null}
          </div>
          {line.formatting?.hasCheckbox && onCheckboxToggle ? (
            <Checkbox
              checked={Boolean(line.formatting.checkboxChecked)}
              onToggle={onCheckboxToggle}
            />
          ) : null}
          <div
            className={`editor-line-editor${canCollapse ? ' editor-line-editor--collapsible' : ''}`}
            title={isStuck && line.text.trim() ? line.text.replace(/\n/g, ' ') : undefined}
          >
            {canCollapse && onToggleLineCollapsed ? (
              <button
                type="button"
                className="editor-line-collapse-btn"
                title={isLineCollapsed ? '펼치기' : '접기'}
                aria-label={isLineCollapsed ? '펼치기' : '접기'}
                aria-expanded={!isLineCollapsed}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onToggleLineCollapsed}
              >
                {isLineCollapsed ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              </button>
            ) : null}
            {isSectionTitle && onSectionDragStart ? (
              <button
                type="button"
                className="editor-section-drag-handle"
                title="드래그해서 섹션 순서 바꾸기"
                aria-label="드래그해서 섹션 순서 바꾸기"
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={onSectionDragStart}
              >
                <IconDragHandle size={13} />
              </button>
            ) : null}
            {isSectionTitle && onPickSectionColor ? (
              <SectionColorPicker color={line.formatting?.sectionColor} onPick={onPickSectionColor} />
            ) : null}
            {isStuck ? (
              <div className="editor-sticky-title-preview" aria-hidden>
                {firstLinePreview || placeholder || ''}
              </div>
            ) : null}
            {isLineCollapsed ? (
              <div className="editor-line-collapsed-preview" aria-hidden>
                {firstLinePreview || placeholder || ''}
                {isMultiLine && firstLinePreview.length < line.text.length ? '…' : ''}
              </div>
            ) : null}
            <div className="editor-line-mirror" aria-hidden>
              {!isStuck && !isLineCollapsed ? (
                <SpannedLineMirror
                  text={line.text}
                  spans={line.spans}
                  lineFormatting={line.formatting}
                  selectionStart={mirrorSelectionRange?.start}
                  selectionEnd={mirrorSelectionRange?.end}
                  searchHighlights={searchHighlights}
                />
              ) : null}
            </div>
            <textarea
              ref={bindTextareaRef}
              className={`editor-line-textarea editor-line-textarea--mirror${isLineCollapsed ? ' editor-line-textarea--collapsed' : ''}`}
              value={line.text}
              placeholder={placeholder}
              onChange={onChange}
              onBeforeInput={onBeforeInput}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onDoubleClick={onDoubleClick}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              onSelect={onSelect}
              onFocus={onFocus}
              onPaste={onPaste}
              onCopy={onCopy}
              onCut={onCut}
              rows={1}
              spellCheck={false}
              tabIndex={isLineCollapsed ? -1 : undefined}
            />
            {isSectionTitle && onToggleSectionCollapsed ? (
              <button
                type="button"
                className="editor-section-fold-btn"
                title={isSectionCollapsed ? '섹션 펼치기' : '섹션 접기'}
                aria-label={isSectionCollapsed ? '섹션 펼치기' : '섹션 접기'}
                aria-expanded={!isSectionCollapsed}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onToggleSectionCollapsed}
              >
                {isSectionCollapsed ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              </button>
            ) : null}
          </div>
          {line.formatting?.hasDivider ? <div className="editor-line-divider" aria-hidden /> : null}
        </div>
      </>
    )
  })
)
