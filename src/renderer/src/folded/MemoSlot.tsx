import type { Memo } from '@shared/types'
import { TrashIcon } from '@renderer/components/TrashIcon'
import { SpannedLineMirror } from '@renderer/edit/InlineSpan'
import { firstLinePreviewSpanned } from '@renderer/utils/memoPreview'
import { memoHue } from '@renderer/utils/memoHue'
import '@renderer/edit/keycap-badge.css'
import './memoSlotColors.css'

interface MemoSlotProps {
  memo: Memo
  onMouseEnter: (el: HTMLElement) => void
  onMouseLeave: () => void
  onOpenEdit: () => void
  onCloseFromStack: () => void
}

export function MemoSlot(props: MemoSlotProps): React.JSX.Element {
  const { memo, onMouseEnter, onMouseLeave, onOpenEdit, onCloseFromStack } = props
  const hue = memoHue(memo.color)
  const previewSpanned = firstLinePreviewSpanned(memo.content, 10)

  return (
    <div
      className={`memo-slot memo-slot--${hue}`}
      data-testid="folded-memo-slot"
      data-memo-id={memo.id}
      onMouseEnter={(e) => onMouseEnter(e.currentTarget)}
      onMouseLeave={onMouseLeave}
      role="listitem"
    >
      <span className="memo-preview-text">
        {previewSpanned.text === '…' ? (
          '…'
        ) : (
          <SpannedLineMirror
            text={previewSpanned.text}
            spans={previewSpanned.spans}
            variant="inline"
          />
        )}
      </span>
      <div className="memo-actions">
        <button type="button" title="편집 열기" onClick={() => void onOpenEdit()}>
          {'✏️'}
        </button>
        <button
          type="button"
          className="memo-trash-btn"
          title="스택에서 제거"
          aria-label="스택에서 제거"
          onClick={() => void onCloseFromStack()}
        >
          <TrashIcon size={15} />
        </button>
      </div>
    </div>
  )
}
