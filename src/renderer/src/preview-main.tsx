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

  useEffect(() => {
    const onWinBlur = (): void => {
      void window.snapnote.memo.closePreview()
    }
    const onVisibility = (): void => {
      if (document.hidden) void window.snapnote.memo.closePreview()
    }
    window.addEventListener('blur', onWinBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', onWinBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const body = memo ? fullContentPreview(memo.content, 700) : '메모를 불러올 수 없습니다.'

  const openEdit = useCallback(() => {
    if (!memoId) return
    void window.snapnote.memo.closePreview()
    void window.snapnote.memo.openEdit(memoId)
  }, [memoId])

  const hue = memo ? memoHue(memo.color) : 'default'
  const bgAlpha = Math.min(1, Math.max(0.6, Number(settings?.windowOpacity) || 1))
  const textAlpha = Math.max(0.92, bgAlpha)

  const onPreviewPointerEnter = useCallback(() => {
    // 즉시 close 정책: enter 시 별도 동작 없음
  }, [])

  const onPreviewPointerLeave = useCallback(() => {
    void window.snapnote.memo.closePreview()
  }, [])

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
      title="편집 열기"
      onPointerEnter={onPreviewPointerEnter}
      onPointerLeave={onPreviewPointerLeave}
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
