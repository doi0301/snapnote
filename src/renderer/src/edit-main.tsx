import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { EditWindow } from './edit/EditWindow'

function getMemoIdFromHash(): string {
  return window.location.hash.replace(/^#/, '')
}

function EditApp(): React.JSX.Element {
  const [memoId] = useState(() => getMemoIdFromHash())
  if (!memoId) {
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
        메모 id가 없습니다. (URL hash)
      </div>
    )
  }
  return <EditWindow memoId={memoId} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EditApp />
  </StrictMode>
)
