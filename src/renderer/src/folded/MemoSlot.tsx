import type { Memo } from '@shared/types'
import { TrashIcon } from '@renderer/components/TrashIcon'
import { firstLinePreview } from '@renderer/utils/memoPreview'
import { memoHue, type MemoHue } from '@renderer/utils/memoHue'
import './memoSlotColors.css'

export interface SlotColorMap {
  coral: string
  green: string
  blue: string
}

function accentForHue(hue: MemoHue, map?: SlotColorMap): string | undefined {
  if (!map) return undefined
  if (hue === 'coral') return map.coral
  if (hue === 'green') return map.green
  if (hue === 'blue') return map.blue
  return undefined
}

function hexToRgba(hex: string, alpha: number): string {
  const x = hex.replace('#', '').trim()
  if (x.length !== 6 || !/^[0-9a-fA-F]+$/.test(x)) return `rgba(0,0,0,${alpha})`
  const r = parseInt(x.slice(0, 2), 16)
  const g = parseInt(x.slice(2, 4), 16)
  const b = parseInt(x.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

interface MemoSlotProps {
  memo: Memo
  /** 설정의 colorSlot1~3 — 폴디드 슬롯 강조색 */
  slotColors?: SlotColorMap
  onMouseEnter: (el: HTMLElement) => void
  onMouseLeave: () => void
  onOpenEdit: () => void
  onCloseFromStack: () => void
}

export function MemoSlot(props: MemoSlotProps): React.JSX.Element {
  const { memo, slotColors, onMouseEnter, onMouseLeave, onOpenEdit, onCloseFromStack } = props
  const hue = memoHue(memo.color)
  const preview = firstLinePreview(memo.content, 10)
  const accent = accentForHue(hue, slotColors)
  const customStyle =
    accent != null
      ? ({
          borderLeftColor: accent,
          borderLeftWidth: 5,
          backgroundColor: hexToRgba(accent, 0.1)
        } as React.CSSProperties)
      : undefined

  return (
    <div
      className={accent ? 'memo-slot memo-slot--custom' : `memo-slot memo-slot--${hue}`}
      style={customStyle}
      data-testid="folded-memo-slot"
      data-memo-id={memo.id}
      onMouseEnter={(e) => onMouseEnter(e.currentTarget)}
      onMouseLeave={onMouseLeave}
      role="listitem"
    >
      <span className="memo-preview-text" title={preview}>
        {preview || '…'}
      </span>
      <div className="memo-actions">
        <button type="button" title="편집 열기" onClick={() => void onOpenEdit()}>
          {'\u270F\uFE0F'}
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
