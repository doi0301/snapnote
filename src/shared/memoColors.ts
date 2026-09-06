/**
 * 메모 색상 팔레트 (P4) — 창 상단·폴디드 슬롯에 쓰이는 고정 12색.
 * `coral`/`green`/`blue` 는 기존 3색 그대로 유지해 과거 메모의 `color` 값이
 * 별도 마이그레이션 없이 그대로 유효하다.
 */
export const MEMO_COLOR_PALETTE = [
  'coral',
  'green',
  'blue',
  'purple',
  'pink',
  'yellow',
  'teal',
  'indigo',
  'orange',
  'mint',
  'gray',
  'rose'
] as const

export type MemoColorKey = (typeof MEMO_COLOR_PALETTE)[number]

const PALETTE_SET = new Set<string>(MEMO_COLOR_PALETTE)

export function isMemoColorKey(color: string): color is MemoColorKey {
  return PALETTE_SET.has(color)
}

/**
 * 현재 열린 창들이 쓰지 않는 색 중에서 무작위로 하나 고른다.
 * 전부(12색) 소진됐으면 팔레트 전체에서 무작위로 고른다.
 */
export function pickRandomMemoColor(usedColors: Iterable<string>): MemoColorKey {
  const used = new Set(usedColors)
  const available = MEMO_COLOR_PALETTE.filter((c) => !used.has(c))
  const pool = available.length > 0 ? available : MEMO_COLOR_PALETTE
  return pool[Math.floor(Math.random() * pool.length)]!
}
