import { isKeycapStorageChar, keycapDisplayChar } from './keycapChar'
import type { EditorLine, TextSpan } from './types'

export const MARKDOWN_INDENT_SPACES = 2

const HEADING_MARKERS: Record<number, { open: string; close: string | null }> = {
  1: { open: '[', close: ']' },
  2: { open: '<', close: '>' },
  3: { open: '(', close: ')' },
  4: { open: '- ', close: null },
  5: { open: '\u25B8 ', close: null },
  6: { open: '\u25AB ', close: null }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** 에디터 본문에서 SnapNote 위계 마커 제거 */
export function stripAllHeadingMarkers(text: string): string {
  let t = text
  let changed = true
  while (changed) {
    changed = false
    for (const m of Object.values(HEADING_MARKERS)) {
      if (m.close) {
        if (t.startsWith(m.open)) {
          t = t.slice(m.open.length)
          changed = true
        }
        if (t.endsWith(m.close)) {
          t = t.slice(0, t.length - m.close.length)
          changed = true
        }
      } else if (t.startsWith(m.open)) {
        t = t.slice(m.open.length)
        changed = true
      }
    }
  }
  return t.replace(/^(\s*)• /, '$1')
}

function indentPrefix(level: number): string {
  const n = Math.min(6, Math.max(0, level))
  return ' '.repeat(n * MARKDOWN_INDENT_SPACES)
}

/** MD → 에디터 역변환 시 SnapNote 위계 마커를 본문에 다시 붙임 */
export function applyHeadingMarkersToText(text: string, level: 1 | 2 | 3 | 4 | 5 | 6): string {
  const marker = HEADING_MARKERS[level]!
  const content = text.replace(/^(\s*)• /, '$1')
  return marker.close ? marker.open + content + marker.close : marker.open + content
}

function headingUsesStructuralBold(level?: number): boolean {
  return level === 1 || level === 2
}

function collectBreakpoints(text: string, spans: TextSpan[]): number[] {
  const p = new Set<number>([0, text.length])
  for (const s of spans) {
    p.add(clamp(s.start, 0, text.length))
    p.add(clamp(s.end, 0, text.length))
  }
  return [...p].sort((a, b) => a - b)
}

function displayChar(ch: string): string {
  return isKeycapStorageChar(ch) ? keycapDisplayChar(ch) : ch
}

function spanAtMid(spans: TextSpan[], mid: number): TextSpan | undefined {
  for (const s of spans) {
    if (mid >= s.start && mid < s.end) return s
  }
  return undefined
}

/** 인라인 볼드·취소선·keycap 표시 */
export function formatInlineMarkdown(
  text: string,
  spans: TextSpan[] | undefined,
  opts?: { structuralBold?: boolean; lineStrike?: boolean }
): string {
  if (!text) return ''
  const list = spans ?? []
  const bp = collectBreakpoints(text, list)
  const parts: string[] = []
  for (let k = 0; k < bp.length - 1; k++) {
    const a = bp[k]!
    const b = bp[k + 1]!
    if (a >= b) continue
    let chunk = [...text.slice(a, b)].map(displayChar).join('')
    const mid = (a + b) / 2
    const sp = spanAtMid(list, mid)
    const bold = Boolean(opts?.structuralBold || sp?.bold)
    const strike = Boolean(opts?.lineStrike || sp?.strikethrough)
    if (bold) chunk = `**${chunk}**`
    if (strike) chunk = `~~${chunk}~~`
    parts.push(chunk)
  }
  return parts.join('')
}

function tableLineToMarkdown(line: EditorLine): string {
  const rows = line.formatting?.tableRows ?? []
  if (!rows.length) return ''
  const cols = line.formatting?.tableCols ?? Math.max(...rows.map((r) => r.length), 2)
  const clipped = rows.map((row) => {
    const cells = [...row]
    while (cells.length < cols) cells.push('')
    return cells.slice(0, cols).map((c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '))
  })
  const header = clipped[0] ?? Array.from({ length: cols }, () => '')
  const body = clipped.slice(1)
  const sep = Array.from({ length: cols }, () => '---')
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`)
  ]
  return indentPrefix(line.indentLevel) + lines.join('\n' + indentPrefix(line.indentLevel))
}

/** 한 줄을 Markdown으로 변환 */
export function editorLineToMarkdown(line: EditorLine): string {
  const fmt = line.formatting ?? {}
  const indent = indentPrefix(line.indentLevel)

  if (fmt.hasDivider) {
    return `${indent}---`
  }

  if (fmt.isTable && fmt.tableRows?.length) {
    return tableLineToMarkdown(line)
  }

  const rawText = line.text ?? ''
  const stripped = stripAllHeadingMarkers(rawText)
  const headingLevel = fmt.headingLevel
  const lineStrike = Boolean(fmt.strikethrough || (fmt.hasCheckbox && fmt.checkboxChecked))
  const inner = formatInlineMarkdown(stripped, line.spans, {
    structuralBold: headingUsesStructuralBold(headingLevel),
    lineStrike
  })

  if (fmt.hasCheckbox) {
    const mark = fmt.checkboxChecked ? 'x' : ' '
    return `${indent}- [${mark}] ${inner}`
  }

  if (headingLevel != null && headingLevel >= 1 && headingLevel <= 6) {
    const hashes = '#'.repeat(headingLevel)
    return `${indent}${hashes} ${inner}`
  }

  if (!stripped && !rawText) return ''
  return `${indent}${inner}`
}

/** 메모 본문 전체 */
export function memoContentToMarkdown(content: EditorLine[]): string {
  return content.map((line) => editorLineToMarkdown(line)).join('\n')
}

/** 파일명·제목용 — 마커 제거 후 trim */
export function memoTitleFromContent(content: EditorLine[]): string {
  const first = content[0]
  if (!first) return '(제목 없음)'
  const stripped = stripAllHeadingMarkers(first.text ?? '').trim()
  return stripped || '(제목 없음)'
}
