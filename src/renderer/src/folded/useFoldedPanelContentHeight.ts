import { type RefObject, useEffect } from 'react'

/**
 * `.folded-root` 실제 높이를 메인에 전달해 BrowserWindow `setContentSize`로 맞춤 (hug).
 */
export function useFoldedPanelContentHeight(
  rootRef: RefObject<HTMLElement | null>,
  deps: unknown[]
): void {
  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    let raf = 0
    const send = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const h = Math.ceil(el.getBoundingClientRect().height)
        if (h > 0) {
          void window.snapnote.app.setFoldedPanelContentHeight(h)
        }
      })
    }

    const ro = new ResizeObserver(() => send())
    ro.observe(el)
    send()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 스택/목록 바뀔 때 재측정
  }, deps)
}
