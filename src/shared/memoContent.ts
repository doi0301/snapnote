import type { EditorLine, Memo } from './types'

/** 본문에 공백이 아닌 글자가 한 글자라도 있는지 (히스토리 노출·빈 메모 폐기 판단) */
export function memoHasTextContent(m: Pick<Memo, 'content'>): boolean {
  return m.content.some((line: EditorLine) => line.text.trim().length > 0)
}
