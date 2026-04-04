import type { HighlightColor } from './types'

/** 레거시(7색) JSON → 현재 3색 */
export function normalizeHighlightColor(raw: string | undefined | null): HighlightColor | undefined {
  if (raw == null || raw === '') return undefined
  switch (raw) {
    case 'yellow':
    case 'green':
    case 'pink':
      return raw
    case 'blue':
    case 'mint':
      return 'green'
    case 'orange':
      return 'yellow'
    case 'purple':
      return 'pink'
    default:
      return 'yellow'
  }
}
