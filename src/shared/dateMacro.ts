/** 오늘 날짜를 yy-mm-dd 형식으로 반환 */
export function formatTodayShort(now: Date = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const TODAY_MACRO = '#오늘'

export interface TodayMacroExpandResult {
  text: string
  cursor: number
}

/** 커서 앞이 `#오늘`로 끝나면 날짜로 치환한 결과 반환 */
export function tryExpandTodayMacro(
  beforeCursor: string,
  afterCursor: string,
  now: Date = new Date()
): TodayMacroExpandResult | null {
  if (!beforeCursor.endsWith(TODAY_MACRO)) return null
  const dateStr = formatTodayShort(now)
  const prefix = beforeCursor.slice(0, beforeCursor.length - TODAY_MACRO.length)
  const text = prefix + dateStr + afterCursor
  const cursor = prefix.length + dateStr.length
  return { text, cursor }
}
