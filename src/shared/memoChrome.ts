/**
 * 편집 창 크롬(상·하단 바) 면색 — edit.css 의 .edit-topbar / .editor-bottom-bar / .edit-root 배경과 동기화
 */
export function editWindowChromeHex(memoColor: string): string {
  const k = String(memoColor).toLowerCase()
  if (k === 'coral') return '#b84a38'
  if (k === 'green') return '#2a7d4d'
  if (k === 'blue') return '#3569a8'
  return '#556376'
}
