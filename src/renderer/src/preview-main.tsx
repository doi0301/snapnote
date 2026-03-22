import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Memo } from '@shared/types'
import { firstLinePreview } from '@renderer/utils/memoPreview'
import { memoHue } from '@renderer/utils/memoHue'
import './preview.css'

function getMemoIdFromHash(): string {
  return window.location.hash.replace(/^#/, '')
}

function PreviewApp(): React.JSX.Element {
  const [memoId] = useState(() => getMemoIdFromHash())
  const [memo, setMemo] = useState<Memo | null>(null)

  useEffect(() => {
    if (!memoId) return
    void window.snapnote.memo.get(memoId).then(setMemo).catch(() => setMemo(null))
  }, [memoId])

  const body = memo
    ? firstLinePreview(memo.content, 200)
    : '메모를 불러올 수 없습니다.'

  const openEdit = useCallback(() => {
    if (!memoId) return
    void window.snapnote.memo.openEdit(memoId)
  }, [memoId])

  const hue = memo ? memoHue(memo.color) : 'default'

  return (
    <div
      className={`preview-root preview-root--memo-${hue}`}
      data-testid="preview-root"
      role="button"
      tabIndex={0}
      title="클릭하여 편집"
      onMouseEnter={() => void window.snapnote.memo.cancelScheduledPreviewHide()}
      onMouseLeave={() => void window.snapnote.memo.schedulePreviewHide(120)}
      onClick={openEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openEdit()
        }
      }}
    >
      <div className="preview-inner">
        <div className="preview-label">
          <span>미리보기</span>
          <span className="preview-hint">클릭하여 편집</span>
        </div>
        <div className="preview-body">{body}</div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>
)
