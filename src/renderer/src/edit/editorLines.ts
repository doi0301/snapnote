import { normalizeHighlightColor } from '@shared/highlight'
import type { EditorLine as EditorLineModel } from '@shared/types'

const MAX_INDENT = 3

function normalizeLineHighlights(line: EditorLineModel): EditorLineModel {
  const formatting = { ...(line.formatting ?? {}) }
  if (formatting.highlight != null) {
    const n = normalizeHighlightColor(String(formatting.highlight))
    if (n === undefined) delete formatting.highlight
    else formatting.highlight = n
  }
  const spans = line.spans?.map((s) => {
    if (!s.highlight) return s
    return { ...s, highlight: normalizeHighlightColor(String(s.highlight))! }
  })
  return { ...line, formatting, spans }
}

/** S3-03: 빈 문서는 한 줄, indent 0~3 클램프 */
export function normalizeEditorLines(content: EditorLineModel[]): EditorLineModel[] {
  if (!content.length) {
    return [{ id: crypto.randomUUID(), text: '', indentLevel: 0, formatting: {} }]
  }
  return content.map((l) => {
    const base = {
      ...l,
      indentLevel: Math.min(MAX_INDENT, Math.max(0, l.indentLevel ?? 0)),
      formatting: l.formatting ?? {}
    }
    return normalizeLineHighlights(base)
  })
}

export { MAX_INDENT }
