import { TrashIcon } from '@renderer/components/TrashIcon'
import { IconTopBarMinimize, IconTopBarPin } from './toolbarIcons'

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
          className="edit-icon-btn edit-icon-btn--line"
          title={isPinned ? '고정 해제' : '항상 위 고정'}
          data-active={isPinned ? 'true' : 'false'}
          aria-pressed={isPinned}
          onClick={() => void onPinToggle()}
        >
          <IconTopBarPin size={17} />
        </button>
        <button
          type="button"
          className="edit-icon-btn edit-icon-btn--line"
          title="접기"
          data-testid="edit-fold-btn"
          onClick={() => void onFold()}
        >
          <IconTopBarMinimize size={17} />
        </button>
        <button
          type="button"
          className="edit-icon-btn edit-icon-btn--trash edit-icon-btn--line"
          title="스택에서 제거"
          aria-label="스택에서 제거"
          onClick={() => void onCloseFromStack()}
        >
          <TrashIcon size={17} />
        </button>
      </div>
    </header>
  )
}
