import { forwardRef } from 'react'
import type { EditorLine as EditorLineModel } from '@shared/types'
import { Checkbox } from './Checkbox'
import { SpannedLineMirror } from './InlineSpan'
import './editor-line.css'

export const INDENT_PX = 20

export interface EditorLineViewProps {
  line: EditorLineModel
  mirrorSelectionRange?: { start: number; end: number }
  placeholder?: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPointerDown?: (e: React.PointerEvent<HTMLTextAreaElement>) => void
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
      onKeyDown,
      onPointerDown,
      onFocus,
      onCheckboxToggle
    } = props
    const level = Math.min(3, Math.max(0, line.indentLevel))
    const marginW = level * INDENT_PX

    /**
     * 빈 줄도 mirror+투명 textarea 한 벌만 쓴다. 예전에는 글자 유무로 plain/mirror를 갈아타며
     * `<textarea>`가 리마운트되어 Enter 직후·첫 입력 시 포커스가 풀리는 문제가 있었다.
     */
    return (
      <div className={`editor-line editor-line--level-${level}`}>
        <div
          className="editor-line-gutter"
          style={{ width: marginW, minWidth: marginW }}
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
            />
          </div>
          <textarea
            ref={ref}
            className="editor-line-textarea editor-line-textarea--mirror"
            value={line.text}
            placeholder={placeholder}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
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
