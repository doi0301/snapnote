import type { Memo } from '@shared/types'

export function memoBodyPlain(m: Memo): string {
  return m.content.map((l) => l.text).join('\n')
}

/** 여러 메모를 한 파일에 구분선으로 구분 */
export function memosToMarkdown(memos: Memo[]): string {
  const parts: string[] = []
  for (const m of memos) {
    const title = (m.content[0]?.text ?? '').trim() || '(제목 없음)'
    const tags = m.tags.length ? m.tags.map((t) => `#${t}`).join(' ') : ''
    parts.push(
      `# ${title}\n\n` +
        `- tags: ${tags}\n` +
        `- updated: ${m.updatedAt}\n\n` +
        memoBodyPlain(m)
    )
  }
  return parts.join('\n---\n\n')
}
