import { normalizeHighlightColor } from '@shared/highlight'
import type { EditorLine as EditorLineModel } from '@shared/types'
import { stripBoldFromInterval } from './spanFormat'
import { padTableRows, resolveTableCols } from './tableLine'

const MAX_INDENT = 6
const MAX_TABLE_COLS = 5

/** 구버전: H4=`▸ ` · H5=`- ` → 신버전 H4=`- ` · H5=`▸ ` · H6=`▫ ` */
const LEGACY_H4_MARKER_PREFIX = '\u25B8 '
const LEGACY_H5_MARKER_PREFIX = '- '

function normalizeAccentBar(line: EditorLineModel): EditorLineModel {
  const formatting = { ...(line.formatting ?? {}) }
  const ab = formatting.accentBar
  if (ab === undefined || ab === null) {
    delete formatting.accentBar
    return { ...line, formatting }
  }
  if (ab === 'blue' || ab === 'teal' || ab === 'orange') {
    return { ...line, formatting }
  }
  delete formatting.accentBar
  return { ...line, formatting }
}

/** 섹션 타이틀: sectionCollapsed는 타이틀일 때만 유지. 폐기된 sectionScope 필드는 정리 */
function normalizeSectionTitle(line: EditorLineModel): EditorLineModel {
  const formatting = { ...(line.formatting ?? {}) } as Record<string, unknown>
  delete formatting.sectionScope
  if (!formatting.sectionTitle) {
    delete formatting.sectionTitle
    delete formatting.sectionCollapsed
    return { ...line, formatting }
  }
  formatting.sectionTitle = true
  if (!formatting.sectionCollapsed) delete formatting.sectionCollapsed
  return { ...line, formatting }
}

/**
 * 구버전 섹션 범위(항상 "다음 타이틀 전까지", `sectionScope: 'self-only'` 는 예외) 를
 * 새 들여쓰기 기반 규칙(타이틀보다 깊게 들여쓴 줄만 소속)으로 1회 변환한다.
 * 이미 새 규칙을 만족하는 문서에는 아무 효과가 없어(멱등) 매 로드마다 안전하게 돌 수 있다.
 */
function migrateSectionScopeToIndent(content: EditorLineModel[]): EditorLineModel[] {
  const next = content.map((l) => ({ ...l }))
  for (let i = 0; i < next.length; i++) {
    const title = next[i]!
    if (!title.formatting?.sectionTitle) continue
    const legacyScope = (title.formatting as Record<string, unknown>).sectionScope
    if (legacyScope === 'self-only') continue
    const titleIndent = Math.max(0, Math.min(MAX_INDENT, title.indentLevel ?? 0))
    const targetIndent = Math.min(MAX_INDENT, titleIndent + 1)
    for (let j = i + 1; j < next.length; j++) {
      const body = next[j]!
      if (body.formatting?.sectionTitle) break
      if ((body.indentLevel ?? 0) <= titleIndent) {
        next[j] = { ...body, indentLevel: targetIndent }
      }
    }
  }
  return next
}

function migrateHeadingMarkers(line: EditorLineModel): EditorLineModel {
  const formatting = { ...(line.formatting ?? {}) }
  const hl = formatting.headingLevel
  if (hl === undefined || hl === null) {
    return { ...line, formatting }
  }
  const n = Number(hl)
  if (!Number.isInteger(n) || n < 1 || n > 6) {
    const nextFmt = { ...formatting }
    delete nextFmt.headingLevel
    return { ...line, formatting: nextFmt }
  }

  let nextHl = n as 1 | 2 | 3 | 4 | 5 | 6
  const t = line.text
  if (nextHl === 4 && t.startsWith(LEGACY_H4_MARKER_PREFIX)) {
    nextHl = 5
  } else if (nextHl === 5 && t.startsWith(LEGACY_H5_MARKER_PREFIX)) {
    nextHl = 4
  }

  const nextFormatting = { ...formatting, headingLevel: nextHl }
  return { ...line, formatting: nextFormatting }
}

function normalizeTableLine(line: EditorLineModel): EditorLineModel {
  const formatting = { ...(line.formatting ?? {}) }
  if (!formatting.isTable) {
    const next = { ...formatting }
    delete next.tableRows
    delete next.tableCols
    return { ...line, formatting: next }
  }
  const rows = formatting.tableRows
  if (!Array.isArray(rows) || rows.length === 0) {
    const next = { ...formatting, isTable: false }
    delete next.tableRows
    delete next.tableCols
    return { ...line, formatting: next }
  }
  const clipped = rows.map((row) =>
    Array.isArray(row) ? row.slice(0, MAX_TABLE_COLS).map((c) => (c == null ? '' : String(c))) : []
  )
  const tableCols = resolveTableCols(clipped, MAX_TABLE_COLS, formatting.tableCols)
  const padded = padTableRows(clipped, MAX_TABLE_COLS, tableCols)
  return {
    ...line,
    text: '',
    spans: undefined,
    formatting: { ...formatting, tableRows: padded, tableCols }
  }
}

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

/** H3 ( ) 위계 — 볼드 span 제거 */
function stripBoldForParenHeading(line: EditorLineModel): EditorLineModel {
  if (line.formatting?.headingLevel !== 3) return line
  if (!line.spans?.some((s) => s.bold)) return line
  const len = line.text.length
  const spans = stripBoldFromInterval(line.spans, 0, len, len)
  return { ...line, spans }
}

/** S3-03: 빈 문서는 한 줄, indent 0~6 클램프 */
export function normalizeEditorLines(content: EditorLineModel[]): EditorLineModel[] {
  if (!content.length) {
    return [{ id: crypto.randomUUID(), text: '', indentLevel: 0, formatting: {} }]
  }
  return migrateSectionScopeToIndent(content).map((l) => {
    const migrated = migrateHeadingMarkers(normalizeLineHighlights(l))
    const base = {
      ...migrated,
      indentLevel: Math.min(MAX_INDENT, Math.max(0, migrated.indentLevel ?? 0)),
      formatting: migrated.formatting ?? {}
    }
    return normalizeTableLine(
      normalizeSectionTitle(normalizeAccentBar(stripBoldForParenHeading(base)))
    )
  })
}

export { MAX_INDENT, MAX_TABLE_COLS }
