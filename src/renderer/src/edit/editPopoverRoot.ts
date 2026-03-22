/**
 * 편집 창에서 `overflow: hidden` 체인 밖에 두는 포털 타깃.
 * 클립보드/이모지 팔레트가 본문·하단 바 위에 겹쳐 그려지도록 함.
 */
const EDIT_POPOVER_ID = 'edit-popover-root'

export function getEditPopoverRoot(): HTMLElement {
  const el = document.getElementById(EDIT_POPOVER_ID)
  if (el) return el
  const fallback = document.createElement('div')
  fallback.id = EDIT_POPOVER_ID
  fallback.setAttribute('aria-hidden', 'true')
  document.body.appendChild(fallback)
  return fallback
}
