import type { JSX } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger,
  onConfirm,
  onCancel
}: ConfirmDialogProps): JSX.Element | null {
  if (!open) return null

  return (
    <div className="history-confirm-backdrop" role="presentation" onMouseDown={() => onCancel()}>
      <div
        className="history-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="history-confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="history-confirm-title" className="history-confirm-title">
          {title}
        </h2>
        <p className="history-confirm-message">{message}</p>
        <div className="history-confirm-actions">
          <button type="button" className="history-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`history-btn ${danger ? 'history-btn--danger' : 'history-btn--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
