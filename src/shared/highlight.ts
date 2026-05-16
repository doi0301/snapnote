import type { HighlightColor } from './types'

/** 레거시(7색) JSON → 현재 팔레트 색상 */
export function normalizeHighlightColor(raw: string | undefined | null): HighlightColor | undefined {
  if (raw == null || raw === '') return undefined
  switch (raw) {
    case 'yellow':
    case 'green':
    case 'pink':
    case 'gray':
    case 'blue':
    case 'orange':
    case 'purple':
      return raw
    case 'mint':
      return 'green'
    default:
      return 'yellow'
  }
}
