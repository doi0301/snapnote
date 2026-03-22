/** DB `Memo.color` — 최대 3색 로테이션과 동일 키 */
export type MemoHue = 'coral' | 'green' | 'blue' | 'default'

const KNOWN = new Set<string>(['coral', 'green', 'blue'])

export function memoHue(color: string): MemoHue {
  return KNOWN.has(color) ? (color as MemoHue) : 'default'
}
