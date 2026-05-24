/** keycap 저장용 전각 숫자 (０–９) — textarea 1글자 폭 ≈ 1em */
export function keycapStorageChar(digit: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9): string {
  return String.fromCharCode(0xff10 + digit)
}

/** mirror·팔레트 표시용 반각 숫자 */
export function keycapDisplayChar(ch: string): string {
  const c = ch.charCodeAt(0)
  if (c >= 0xff10 && c <= 0xff19) return String.fromCharCode(c - 0xff10 + 0x30)
  return ch
}

export function isKeycapStorageChar(ch: string): boolean {
  if (!ch) return false
  const c = ch.charCodeAt(0)
  return c >= 0xff10 && c <= 0xff19
}
