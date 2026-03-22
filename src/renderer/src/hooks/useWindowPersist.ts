import { useEffect } from 'react'
import type { Memo } from '@shared/types'

/**
 * Bounds are saved in main WindowManager (moved/resized).
 * Subscribes to memo:updated for this id so UI stays in sync.
 */
export function useWindowPersist(memoId: string, onSync: (memo: Memo) => void): void {
  useEffect(() => {
    return window.snapnote.on.memoUpdated((m) => {
      if (m.id === memoId) onSync(m)
    })
  }, [memoId, onSync])
}
