import { TrashIcon } from '@renderer/components/TrashIcon'

interface TopBarProps {
  isPinned: boolean
  onPinToggle: () => void
  onFold: () => void
  onCloseFromStack: () => void
}

export function TopBar(props: TopBarProps): React.JSX.Element {
  const { isPinned, onPinToggle, onFold, onCloseFromStack } = props
  return (
    <header className="edit-topbar edit-topbar--compact" aria-label="편집 창">
      <div className="edit-topbar-actions">
        <button
          type="button"
          className="edit-icon-btn"
          title={isPinned ? '항상 위 고정 해제' : '항상 위에 고정'}
          data-active={isPinned ? 'true' : 'false'}
          aria-pressed={isPinned}
          onClick={() => void onPinToggle()}
        >
          {'\uD83D\uDCCC'}
        </button>
        <button
          type="button"
          className="edit-icon-btn"
          title="접기 (폴디드 유지)"
          data-testid="edit-fold-btn"
          onClick={() => void onFold()}
        >
          {'\u2501'}
        </button>
        <button
          type="button"
          className="edit-icon-btn edit-icon-btn--trash"
          title="스택에서 제거 (휴지통)"
          aria-label="스택에서 제거"
          onClick={() => void onCloseFromStack()}
        >
          <TrashIcon size={17} />
        </button>
      </div>
    </header>
  )
}
