import type { EditorLine, LineFormatting, TextSpan } from './types'
import { keycapDisplayChar } from './keycapChar'
import { stripAllHeadingMarkers } from './memoMarkdownExport'

export const SNAPNOTE_CLIPBOARD_MIME = 'application/x-snapnote+json'

export const SNAPNOTE_CLIPBOARD_HTML_MARKER = 'snapnote:v1:'

export interface SnapnoteClipboardLine {
  text: string
  indentLevel: number
  formatting: LineFormatting
  spans?: TextSpan[]
}

export interface SnapnoteClipboardPayload {
  version: 1
  lines: SnapnoteClipboardLine[]
}

function cloneFormatting(f: LineFormatting): LineFormatting {
  const out: LineFormatting = { ...f }
  if (f.tableRows) {
    out.tableRows = f.tableRows.map((row) => [...row])
  }
  return out
}

function cloneSpans(spans: TextSpan[] | undefined): TextSpan[] | undefined {
  return spans?.map((s) => ({ ...s }))
}

function escapeTsvCell(cell: string): string {
  const c = cell ?? ''
  if (/[\t\n\r"]/.test(c)) {
    return `"${c.replace(/"/g, '""')}"`
  }
  return c
}

function plainTextFromString(text: string): string {
  return [...text].map((ch) => keycapDisplayChar(ch)).join('')
}

function tableRowsToPlainTsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => escapeTsvCell(plainTextFromString(cell ?? ''))).join('\t')).join('\r\n')
}

/** 복사용 — id 제외 deep clone */
export function serializeLinesForClipboard(lines: EditorLine[]): SnapnoteClipboardPayload {
  return {
    version: 1,
    lines: lines.map((l) => ({
      text: l.text,
      indentLevel: l.indentLevel,
      formatting: cloneFormatting(l.formatting ?? {}),
      spans: cloneSpans(l.spans)
    }))
  }
}

export function payloadToJson(payload: SnapnoteClipboardPayload): string {
  return JSON.stringify(payload)
}

export function parsePayloadJson(json: string): SnapnoteClipboardPayload | null {
  try {
    const data = JSON.parse(json) as SnapnoteClipboardPayload
    if (data?.version !== 1 || !Array.isArray(data.lines)) return null
    return data
  } catch {
    return null
  }
}

/** 붙여넣기용 EditorLine[] (새 id) */
export function deserializeSnapnoteClipboard(
  payload: SnapnoteClipboardPayload
): EditorLine[] {
  return payload.lines.map((l) => ({
    id: crypto.randomUUID(),
    text: l.text,
    indentLevel: l.indentLevel,
    formatting: cloneFormatting(l.formatting ?? {}),
    spans: cloneSpans(l.spans)
  }))
}

/** 외부 앱용 text/plain — SnapNote 마커 제거, keycap 반각 숫자 */
export function linesToPlainText(lines: EditorLine[]): string {
  return lines
    .map((l) => {
      if (l.formatting?.isTable && l.formatting.tableRows?.length) {
        return tableRowsToPlainTsv(l.formatting.tableRows)
      }
      return plainTextFromString(stripAllHeadingMarkers(l.text ?? ''))
    })
    .join('\n')
}

/** HTML 클립보드 백업용 */
export function embedSnapnoteInHtml(plainText: string, json: string): string {
  const encoded = encodeURIComponent(json)
  const escaped = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<meta charset="utf-8"><!--${SNAPNOTE_CLIPBOARD_HTML_MARKER}${encoded}-->${escaped}`
}

/** HTML에서 SnapNote payload 추출 */
export function extractSnapnoteFromHtml(html: string): string | null {
  const re = new RegExp(`<!--${SNAPNOTE_CLIPBOARD_HTML_MARKER}([^>]+)-->`)
  const m = html.match(re)
  if (!m?.[1]) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}

/** 한 줄 구간 slice (spans 재매핑) */
/** surrogate pair(이모지) 중간 인덱스 보정 — 쪼개진 lone surrogate(U+FFFD) 방지 */
function snapStartToCodePoint(text: string, index: number): number {
  if (index <= 0 || index >= text.length) return index
  const code = text.charCodeAt(index)
  const prev = text.charCodeAt(index - 1)
  return code >= 0xdc00 && code <= 0xdfff && prev >= 0xd800 && prev <= 0xdbff ? index - 1 : index
}

function snapEndToCodePoint(text: string, index: number): number {
  if (index <= 0 || index >= text.length) return index
  const code = text.charCodeAt(index)
  const prev = text.charCodeAt(index - 1)
  return code >= 0xdc00 && code <= 0xdfff && prev >= 0xd800 && prev <= 0xdbff ? index + 1 : index
}

export function sliceEditorLine(line: EditorLine, rawStart: number, rawEnd: number): EditorLine {
  const start = snapStartToCodePoint(line.text, rawStart)
  const end = snapEndToCodePoint(line.text, rawEnd)
  const text = line.text.slice(start, end)
  const spans = line.spans
    ?.filter((s) => s.end > start && s.start < end)
    .map((s) => ({
      ...s,
      start: Math.max(0, s.start - start),
      end: Math.min(end - start, s.end - start)
    }))
    .filter((s) => s.start < s.end)

  const isFullLine = start === 0 && end === line.text.length
  const formatting = isFullLine
    ? cloneFormatting(line.formatting ?? {})
    : line.formatting?.isTable
      ? {}
      : {}

  return {
    id: line.id,
    text,
    indentLevel: isFullLine ? line.indentLevel : 0,
    formatting,
    spans: spans?.length ? spans : undefined
  }
}

export interface NormalizedLineSelection {
  startLine: number
  startOffset: number
  endLine: number
  endOffset: number
}

/** 선택 구간 → 복사용 EditorLine[] */
export function extractLinesForSelection(
  lines: EditorLine[],
  norm: NormalizedLineSelection
): EditorLine[] {
  const out: EditorLine[] = []
  for (let i = norm.startLine; i <= norm.endLine; i++) {
    const line = lines[i]
    if (!line) continue

    if (line.formatting?.isTable && line.formatting.tableRows?.length) {
      if (i === norm.startLine && i === norm.endLine) {
        out.push(sliceEditorLine(line, 0, line.text.length))
      } else if (i === norm.startLine || i === norm.endLine) {
        continue
      } else {
        out.push({
          id: line.id,
          text: line.text,
          indentLevel: line.indentLevel,
          formatting: cloneFormatting(line.formatting),
          spans: cloneSpans(line.spans)
        })
      }
      continue
    }

    if (i === norm.startLine && i === norm.endLine) {
      out.push(sliceEditorLine(line, norm.startOffset, norm.endOffset))
    } else if (i === norm.startLine) {
      out.push(sliceEditorLine(line, norm.startOffset, line.text.length))
    } else if (i === norm.endLine) {
      out.push(sliceEditorLine(line, 0, norm.endOffset))
    } else {
      out.push({
        id: line.id,
        text: line.text,
        indentLevel: line.indentLevel,
        formatting: cloneFormatting(line.formatting ?? {}),
        spans: cloneSpans(line.spans)
      })
    }
  }
  return out
}
