import { memoContentToMarkdown, memoTitleFromContent } from '@shared/memoMarkdownExport'
import type { Memo } from '@shared/types'

const TITLE_MAX_LEN = 15

/** Windows 파일명 금지 문자 제거·길이 제한 */
export function sanitizeFilenamePart(raw: string, maxLen: number): string {
  const cleaned = raw
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'memo'
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen)
}

export function memoMarkdownDefaultFilename(m: Memo): string {
  const titleRaw = memoTitleFromContent(m.content)
  const title = sanitizeFilenamePart(titleRaw === '(제목 없음)' ? '(제목없음)' : titleRaw, TITLE_MAX_LEN)
  return `snapnote_${title}.md`
}

export function memosMarkdownDefaultFilename(memos: Memo[]): string {
  if (memos.length === 1) return memoMarkdownDefaultFilename(memos[0]!)
  return 'snapnote_export.md'
}

export function memoBodyMarkdown(m: Memo): string {
  return memoContentToMarkdown(m.content)
}

/** 여러 메모를 한 파일에 구분선으로 구분 */
export function memosToMarkdown(memos: Memo[]): string {
  const parts: string[] = []
  for (const m of memos) {
    const title = memoTitleFromContent(m.content)
    const tags = m.tags.length ? m.tags.map((t) => `#${t}`).join(' ') : ''
    parts.push(
      `# ${title}\n\n` + `- tags: ${tags}\n` + `- updated: ${m.updatedAt}\n\n` + memoBodyMarkdown(m)
    )
  }
  return parts.join('\n---\n\n')
}
