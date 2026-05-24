import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Memo } from '@shared/types'
import { SpannedLineMirror } from '@renderer/edit/InlineSpan'
import { fullContentPreviewLines } from '@renderer/utils/memoPreview'
import { memoHue } from '@renderer/utils/memoHue'
import './preview.css'

function getMemoIdFromHash(): string {
  return window.location.hash.replace(/^#/, '')
}

function PreviewBody({ content }: { content: Memo['content'] }): React.JSX.Element {
  const lines = useMemo(() => fullContentPreviewLines(content, 700), [content])
  if (lines.length === 1 && lines[0]?.text === '…') {
    return <>…</>
  }
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="preview-line">
          <SpannedLineMirror text={line.text} spans={line.spans} variant="inline" />
        </div>
      ))}
    </>
  )
}

function PreviewApp(): React.JSX.Element {
  const [memoId] = useState(() => getMemoIdFromHash())
  const [memo, setMemo] = useState<Memo | null>(null)

  useEffect(() => {
    if (!memoId) return
    void window.snapnote.memo.get(memoId).then(setMemo).catch(() => setMemo(null))
  }, [memoId])

  useEffect(() => {
    if (!memoId) return
    return window.snapnote.on.memoUpdated((m) => {
      if (m.id === memoId) setMemo(m)
    })
  }, [memoId])

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

  const openEdit = useCallback(() => {
    if (!memoId) return
    void window.snapnote.memo.closePreview()
    void window.snapnote.memo.openEdit(memoId)
  }, [memoId])

  const hue = memo ? memoHue(memo.color) : 'default'

  const onPreviewPointerEnter = useCallback(() => {
    // 즉시 close 정책: enter 시 별도 동작 없음
  }, [])

  const onPreviewPointerLeave = useCallback(() => {
    void window.snapnote.memo.closePreview()
  }, [])

  return (
    <div
      className={`preview-root preview-root--memo-${hue}`}
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
        <div className="preview-body">
          {memo ? <PreviewBody content={memo.content} /> : '메모를 불러올 수 없습니다.'}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>
)
