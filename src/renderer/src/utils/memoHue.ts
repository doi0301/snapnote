import { isMemoColorKey, type MemoColorKey } from '@shared/memoColors'

/** DB `Memo.color` — 팔레트 12색 + 미인식 값 fallback */
export type MemoHue = MemoColorKey | 'default'

export function memoHue(color: string): MemoHue {
  return isMemoColorKey(color) ? color : 'default'
}
