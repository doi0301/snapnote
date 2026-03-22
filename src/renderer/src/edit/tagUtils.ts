export function parseTagString(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const re = /#([^\s#]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) {
    const t = m[1].trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export function tagsToInputString(tags: string[]): string {
  if (!tags.length) return ''
  return `${tags.map((t) => `#${t}`).join(' ')} `
}

export function collectAllTags(memos: { tags: string[] }[]): string[] {
  const s = new Set<string>()
  for (const m of memos) {
    for (const t of m.tags) {
      const x = t.trim()
      if (x) s.add(x)
    }
  }
  return [...s].sort((a, b) => a.localeCompare(b, 'ko'))
}

export function parseHashAtCursor(
  full: string,
  cursor: number
): { start: number; query: string } | null {
  const left = full.slice(0, cursor)
  const re = /(^|\s)#([^\s#]*)$/
  const m = left.match(re)
  if (!m) return null
  const hashIndex = left.lastIndexOf('#')
  if (hashIndex < 0) return null
  return { start: hashIndex, query: m[2] ?? '' }
}
