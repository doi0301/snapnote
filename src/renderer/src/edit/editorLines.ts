import type { EditorLine as EditorLineModel } from '@shared/types'

const MAX_INDENT = 3

/** S3-03: 빈 문서는 한 줄, indent 0~3 클램프 */
export function normalizeEditorLines(content: EditorLineModel[]): EditorLineModel[] {
  if (!content.length) {
    return [{ id: crypto.randomUUID(), text: '', indentLevel: 0, formatting: {} }]
  }
  return content.map((l) => ({
    ...l,
    indentLevel: Math.min(MAX_INDENT, Math.max(0, l.indentLevel ?? 0)),
    formatting: l.formatting ?? {}
  }))
}

export { MAX_INDENT }
