import { type RefObject, useEffect } from 'react'

const EDGE = 8
const TOPBAR_SKIP_PX = 52

/**
 * frameless 편집 창: 가장자리 호버 시 OS와 맞는 리사이즈 커서(어포던스).
 * 실제 리사이즈는 Electron/BrowserWindow + thickFrame이 처리.
 * 우상단 8px은 타이틀 버튼과 겹쳐 ne-resize는 넣지 않음.
 */
export function resizeCursorForClientPos(
  clientX: number,
  clientY: number,
  innerWidth: number,
  innerHeight: number
): string {
  const nearL = clientX < EDGE
  const nearR = clientX > innerWidth - EDGE
  const nearB = clientY > innerHeight - EDGE

  if (nearB && nearL) return 'sw-resize'
  if (nearB && nearR) return 'se-resize'
  if (nearB) return 's-resize'

  if (nearL && clientY < TOPBAR_SKIP_PX) return 'nw-resize'
  if (nearL) return 'w-resize'

  if (nearR && clientY < TOPBAR_SKIP_PX) return ''
  if (nearR) return 'e-resize'

  return ''
}

export function useEditResizeCursorAffordance(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const clear = (): void => {
      rootRef.current?.style.removeProperty('cursor')
    }

    const onMove = (e: MouseEvent): void => {
      const el = rootRef.current
      if (!el) return
      /** 상단바는 창 이동(drag) 영역 — 여기서 nw-resize 등을 씌우면 OS가 리사이즈로 처리하는 경우가 있음 */
      const hit = document.elementFromPoint(e.clientX, e.clientY)
      if (hit?.closest('.edit-topbar')) {
        el.style.removeProperty('cursor')
        return
      }
      const c = resizeCursorForClientPos(e.clientX, e.clientY, window.innerWidth, window.innerHeight)
      if (c) {
        el.style.cursor = c
      } else {
        el.style.removeProperty('cursor')
      }
    }

    document.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('blur', clear)

    return () => {
      document.removeEventListener('mousemove', onMove)
      window.removeEventListener('blur', clear)
      clear()
    }
  }, [rootRef])
}
