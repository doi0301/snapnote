import type { HighlightColor } from './types'

/** 형광펜 hover 시 노출할 단어 한 개 메타 */
export const HIGHLIGHT_META: Record<HighlightColor, string> = {
  yellow: '확인',
  green: '핵심',
  pink: '아이디어',
  gray: '참고',
  blue: '정보',
  orange: '주의',
  purple: '후속'
}

export function highlightSwatchLabel(color: HighlightColor, colorName: string): string {
  return `${colorName} — ${HIGHLIGHT_META[color]}`
}
