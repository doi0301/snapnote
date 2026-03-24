import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Memo, Settings } from '@shared/types'
import { fullContentPreview } from '@renderer/utils/memoPreview'
import { memoHue } from '@renderer/utils/memoHue'
import './preview.css'

function getMemoIdFromHash(): string {
  return window.location.hash.replace(/^#/, '')
}

function PreviewApp(): React.JSX.Element {
  const [memoId] = useState(() => getMemoIdFromHash())
  const [memo, setMemo] = useState<Memo | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    if (!memoId) return
    void window.snapnote.memo.get(memoId).then(setMemo).catch(() => setMemo(null))
  }, [memoId])

  useEffect(() => {
    void window.snapnote.settings.get().then(setSettings)
    return window.snapnote.on.settingsChanged((s) => setSettings(s))
  }, [])

  const body = memo ? fullContentPreview(memo.content, 700) : '메모를 불러올 수 없습니다.'

  const openEdit = useCallback(() => {
    if (!memoId) return
    void window.snapnote.memo.openEdit(memoId)
  }, [memoId])

  const hue = memo ? memoHue(memo.color) : 'default'
  const bgAlpha = Math.min(1, Math.max(0.6, Number(settings?.windowOpacity) || 1))
  const textAlpha = Math.max(0.92, bgAlpha)

  return (
    <div
      className={`preview-root preview-root--memo-${hue}`}
      style={
        {
          '--window-bg-alpha': String(bgAlpha),
          '--window-text-alpha': String(textAlpha)
        } as React.CSSProperties
      }
      data-testid="preview-root"
      role="button"
      tabIndex={0}
      title="클릭하여 편집"
      onClick={openEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openEdit()
        }
      }}
    >
      <div className="preview-inner">
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
