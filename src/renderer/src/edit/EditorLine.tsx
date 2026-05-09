import { forwardRef } from 'react'
import type { EditorLine as EditorLineModel } from '@shared/types'
import { Checkbox } from './Checkbox'
import type { SearchHighlight } from './InlineSpan'
import { SpannedLineMirror } from './InlineSpan'
import './editor-line.css'

export const INDENT_PX = 20

const INDENT_ALPHA = [0.02, 0.06, 0.09, 0.11, 0.13, 0.14, 0.15]

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
}

export const EditorLineView = forwardRef<HTMLTextAreaElement, EditorLineViewProps>(
  function EditorLineView(props, ref) {
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
      searchHighlights
    } = props
    const level = Math.min(6, Math.max(0, line.indentLevel))
    const marginW = level * INDENT_PX
    const headingLevel = line.formatting?.headingLevel
    const headingClass = headingLevel ? ` editor-line--heading-${headingLevel}` : ''
    const stickyClass = isStickyTitle ? ' editor-line--sticky-title' : ''

    return (
      <div
        className={`editor-line editor-line--level-${level}${headingClass}${stickyClass}`}
        style={{ '--indent-level': level } as React.CSSProperties}
      >
        <div
          className="editor-line-gutter"
          style={{ width: marginW, minWidth: marginW, '--indent-alpha': INDENT_ALPHA[level] ?? 0.02 } as React.CSSProperties}
          aria-hidden
        />
        {line.formatting?.hasCheckbox && onCheckboxToggle ? (
          <Checkbox
            checked={Boolean(line.formatting.checkboxChecked)}
            onToggle={onCheckboxToggle}
          />
        ) : null}
        <div className="editor-line-editor">
          <div className="editor-line-mirror" aria-hidden>
            <SpannedLineMirror
              text={line.text}
              spans={line.spans}
              lineFormatting={line.formatting}
              selectionStart={mirrorSelectionRange?.start}
              selectionEnd={mirrorSelectionRange?.end}
              searchHighlights={searchHighlights}
            />
          </div>
          <textarea
            ref={ref}
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
    )
  }
)
