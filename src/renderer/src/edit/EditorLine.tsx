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
import type { EditorLine as EditorLineModel } from '@shared/types'
import { Checkbox } from './Checkbox'
import type { SearchHighlight } from './InlineSpan'
import { SpannedLineMirror } from './InlineSpan'
import './editor-line.css'

export const INDENT_PX = 20

const INDENT_ALPHA = [0.02, 0.06, 0.09, 0.11, 0.13, 0.14, 0.15]

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
  onFocus?: () => void
  onCheckboxToggle?: () => void
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
      onFocus,
      onCheckboxToggle,
      isStickyTitle,
      searchHighlights,
      onStickyStuckChange,
      stickyScrollRootRef
    } = props
    const level = Math.min(6, Math.max(0, line.indentLevel))
    const marginW = level * INDENT_PX
    const headingLevel = line.formatting?.headingLevel
    const headingClass = headingLevel ? ` editor-line--heading-${headingLevel}` : ''

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

    return (
      <>
        {isStickyTitle && <div ref={sentinelRef} className="editor-sticky-sentinel" />}
      <div
        className={`editor-line editor-line--level-${level}${headingClass}${stickyClass}${stuckClass}`}
        style={{ '--indent-level': level } as React.CSSProperties}
      >
        <div
          className={`editor-line-gutter${accentClass}`}
          style={{
            width: marginW,
            minWidth: marginW,
            '--indent-alpha': INDENT_ALPHA[level] ?? 0.02
          } as React.CSSProperties}
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
          className="editor-line-editor"
          title={isStuck && line.text.trim() ? line.text.replace(/\n/g, ' ') : undefined}
        >
          {isStuck ? (
            <div className="editor-sticky-title-preview" aria-hidden>
              {stickyTitlePreviewText(line.text) || placeholder || ''}
            </div>
          ) : null}
          <div className="editor-line-mirror" aria-hidden>
            {!isStuck ? (
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
            className="editor-line-textarea editor-line-textarea--mirror"
            value={line.text}
            placeholder={placeholder}
            onChange={onChange}
            onBeforeInput={onBeforeInput}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onFocus={onFocus}
            rows={1}
            spellCheck={false}
          />
        </div>
        {line.formatting?.hasDivider ? <div className="editor-line-divider" aria-hidden /> : null}
      </div>
      </>
    )
  })
)
