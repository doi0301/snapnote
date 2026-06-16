import {
  MARKDOWN_INDENT_SPACES,
  applyHeadingMarkersToText
} from './memoMarkdownExport'
import type { EditorLine, LineFormatting, TextSpan } from './types'

const TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/
const TABLE_SEP_RE = /^\s*\|[\s\-:|]+\|\s*$/

function newLineId(): string {
  return crypto.randomUUID()
}

function clampIndent(level: number): number {
  return Math.min(6, Math.max(0, level))
}

function parseLeadingIndent(raw: string): { indentLevel: number; rest: string } {
  const m = raw.match(/^((?:  )*)/)
  const spaces = m?.[1]?.length ?? 0
  return {
    indentLevel: clampIndent(Math.floor(spaces / MARKDOWN_INDENT_SPACES)),
    rest: raw.slice(spaces)
  }
}

/** SnapNote MD 내보내기·일반 GFM 패턴 감지 */
export function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false
  if (/- \[[ xX]\]/.test(text)) return true
  if (/^ {0,12}#{1,6}\s+\S/m.test(text)) return true
  if (/^ {0,12}---\s*$/m.test(text)) return true
  if (/^\s*\|.+\|\s*$/m.test(text)) return true
  if (/\*\*[^*]+\*\*/.test(text)) return true
  if (/~~[^~]+~~/.test(text)) return true
  return false
}

function mergeSpans(spans: TextSpan[] | undefined, extra: TextSpan[]): TextSpan[] | undefined {
  const merged = [...(spans ?? []), ...extra]
  return merged.length
    ? merged.sort((a, b) => a.start - b.start || a.end - b.end)
    : undefined
}

function shiftSpans(spans: TextSpan[] | undefined, offset: number): TextSpan[] | undefined {
  if (!spans?.length) return spans
  return spans.map((s) => ({ ...s, start: s.start + offset, end: s.end + offset }))
}

/** `**bold**`, `~~strike~~` → text + spans */
export function parseInlineMarkdown(input: string): { text: string; spans?: TextSpan[] } {
  let text = ''
  const spans: TextSpan[] = []
  let i = 0

  while (i < input.length) {
    if (input.startsWith('**', i)) {
      const close = input.indexOf('**', i + 2)
      if (close !== -1) {
        const inner = input.slice(i + 2, close)
        const parsed = parseInlineMarkdown(inner)
        const start = text.length
        text += parsed.text
        if (parsed.spans?.length) {
          for (const s of parsed.spans) {
            spans.push({ ...s, start: s.start + start, end: s.end + start })
          }
        }
        if (parsed.text.length > 0) spans.push({ start, end: text.length, bold: true })
        i = close + 2
        continue
      }
    }
    if (input.startsWith('~~', i)) {
      const close = input.indexOf('~~', i + 2)
      if (close !== -1) {
        const inner = input.slice(i + 2, close)
        const parsed = parseInlineMarkdown(inner)
        const start = text.length
        text += parsed.text
        if (parsed.spans?.length) {
          for (const s of parsed.spans) {
            spans.push({ ...s, start: s.start + start, end: s.end + start })
          }
        }
        if (parsed.text.length > 0) spans.push({ start, end: text.length, strikethrough: true })
        i = close + 2
        continue
      }
    }
    text += input[i]!
    i++
  }

  return spans.length ? { text, spans } : { text }
}

interface ParsedLineBody {
  text: string
  spans?: TextSpan[]
  formatting: LineFormatting
  indentLevel: number
}

function applyHeadingToInline(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  inline: { text: string; spans?: TextSpan[] }
): { text: string; spans?: TextSpan[] } {
  let text = inline.text
  let spans = inline.spans
  if (level === 1 || level === 2) {
    const end = text.length
    if (end > 0 && !spans?.some((s) => s.bold && s.start <= 0 && s.end >= end)) {
      spans = mergeSpans(spans, [{ start: 0, end, bold: true }]) ?? [{ start: 0, end, bold: true }]
    }
  }
  const marked = applyHeadingMarkersToText(text, level)
  const openLen = marked.length - text.length
  if (openLen > 0) {
    spans = shiftSpans(spans, openLen)
    if (level <= 3) {
      const closeLen =
        marked.endsWith(']') || marked.endsWith('>') || marked.endsWith(')') ? 1 : 0
      if (closeLen && spans?.length) {
        const innerEnd = marked.length - closeLen
        spans = spans
          .map((s) => (s.end > innerEnd ? { ...s, end: innerEnd } : s))
          .filter((s) => s.start < s.end)
      }
    }
    text = marked
  }
  return { text, spans }
}

function parseMarkdownLine(raw: string): ParsedLineBody {
  const { indentLevel, rest } = parseLeadingIndent(raw)

  if (/^---\s*$/.test(rest)) {
    return { text: '', spans: undefined, formatting: { hasDivider: true }, indentLevel }
  }

  const checkbox = rest.match(/^- \[([ xX])\]\s?(.*)$/)
  if (checkbox) {
    const formatting: LineFormatting = {
      hasCheckbox: true,
      checkboxChecked: checkbox[1] !== ' '
    }
    if (formatting.checkboxChecked) formatting.strikethrough = true
    const inline = parseInlineMarkdown(checkbox[2] ?? '')
    return { text: inline.text, spans: inline.spans, formatting, indentLevel }
  }

  const heading = rest.match(/^(#{1,6})\s+(.*)$/)
  if (heading) {
    const level = heading[1]!.length as 1 | 2 | 3 | 4 | 5 | 6
    const inline = parseInlineMarkdown(heading[2] ?? '')
    const applied = applyHeadingToInline(level, inline)
    return {
      text: applied.text,
      spans: applied.spans,
      formatting: { headingLevel: level },
      indentLevel
    }
  }

  const inline = parseInlineMarkdown(rest)
  return { text: inline.text, spans: inline.spans, formatting: {}, indentLevel }
}

function parseTableRow(line: string): string[] | null {
  const m = line.match(TABLE_ROW_RE)
  if (!m) return null
  return m[1]!
    .split('|')
    .map((c) => c.trim().replace(/\\\|/g, '|'))
}

function isTableSeparator(line: string): boolean {
  return TABLE_SEP_RE.test(line)
}

function parseTableBlock(rawLines: string[], start: number): { line: EditorLine; next: number } | null {
  const first = rawLines[start]
  if (!first || !TABLE_ROW_RE.test(first)) return null
  const header = parseTableRow(first)
  if (!header) return null
  const sep = rawLines[start + 1]
  if (!sep || !isTableSeparator(sep)) return null

  const rows: string[][] = [header]
  let i = start + 2
  while (i < rawLines.length) {
    const row = parseTableRow(rawLines[i]!)
    if (!row) break
    rows.push(row)
    i++
  }

  const { indentLevel } = parseLeadingIndent(first)
  const cols = Math.min(5, Math.max(2, ...rows.map((r) => r.length)))

  return {
    line: {
      id: newLineId(),
      text: '',
      indentLevel,
      formatting: {
        isTable: true,
        tableRows: rows.map((r) => {
          const cells = [...r]
          while (cells.length < cols) cells.push('')
          return cells.slice(0, cols)
        }),
        tableCols: cols
      }
    },
    next: i
  }
}

/** Markdown 본문 → EditorLine[] */
export function parseMarkdownToEditorLines(text: string): EditorLine[] {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n')
  const out: EditorLine[] = []
  let i = 0

  while (i < rawLines.length) {
    const table = parseTableBlock(rawLines, i)
    if (table) {
      out.push(table.line)
      i = table.next
      continue
    }

    const parsed = parseMarkdownLine(rawLines[i] ?? '')
    out.push({
      id: newLineId(),
      text: parsed.text,
      indentLevel: parsed.indentLevel,
      formatting: parsed.formatting,
      spans: parsed.spans
    })
    i++
  }

  return out.length ? out : [{ id: newLineId(), text: '', indentLevel: 0, formatting: {} }]
}
