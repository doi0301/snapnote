import type { EditorLine } from '@shared/types'

/** 폴디드 슬롯·프리뷰용 첫 줄 요약 (최대 `max`자) */
export function firstLinePreview(lines: EditorLine[], max = 10): string {
  const t = lines[0]?.text?.trim() ?? ''
  if (t.length <= max) return t || '…'
  return `${t.slice(0, max)}…`
}
