import type { LineFormatting, TextSpan } from '@shared/types'
import { clamp } from './spanFormat'

const HL_CLASS: Record<string, string> = {
  yellow: 'inline-hl-yellow',
  green: 'inline-hl-green',
  pink: 'inline-hl-pink'
}

function collectBreakpoints(
  text: string,
  spans: TextSpan[],
  selectionStart?: number,
  selectionEnd?: number
): number[] {
  const p = new Set<number>([0, text.length])
  for (const s of spans) {
    p.add(clamp(s.start, 0, text.length))
    p.add(clamp(s.end, 0, text.length))
  }
  if (selectionStart !== undefined && selectionEnd !== undefined) {
    p.add(clamp(selectionStart, 0, text.length))
    p.add(clamp(selectionEnd, 0, text.length))
  }
  return [...p].sort((a, b) => a - b)
}

function sliceOverlapsSelection(
  a: number,
  b: number,
  selectionStart?: number,
  selectionEnd?: number
): boolean {
  if (selectionStart === undefined || selectionEnd === undefined) return false
  if (selectionEnd <= selectionStart) return false
  return a < selectionEnd && b > selectionStart
}

function classForSlice(
  sliceStart: number,
  sliceEnd: number,
  mid: number,
  spans: TextSpan[],
  lineStrike: boolean,
  selectionStart?: number,
  selectionEnd?: number
): string {
  const parts: string[] = []
  if (lineStrike) parts.push('inline-strike')
  if (sliceOverlapsSelection(sliceStart, sliceEnd, selectionStart, selectionEnd)) {
    parts.push('inline-selected')
  }
  for (const s of spans) {
    if (mid >= s.start && mid < s.end) {
      if (s.bold) parts.push('inline-bold')
      if (s.strikethrough) parts.push('inline-strike')
      if (s.highlight) {
        const c = HL_CLASS[s.highlight]
        if (c) parts.push(c)
      }
    }
  }
  return parts.join(' ')
}

export interface SpannedLineMirrorProps {
  text: string
  spans?: TextSpan[] | undefined
  /** 체크 완료 줄: 전체 취소선 (줄 단위) */
  lineFormatting?: LineFormatting
  selectionStart?: number
  selectionEnd?: number
}

/** 읽기 전용 미러 레이어 — textarea 위에 동일 타이포로 볼드/취소선/하이라이트 표시 */
export function SpannedLineMirror({
  text,
  spans,
  lineFormatting,
  selectionStart,
  selectionEnd
}: SpannedLineMirrorProps): React.JSX.Element {
  const s = spans ?? []
  const lineStrike = Boolean(
    lineFormatting?.checkboxChecked && lineFormatting?.hasCheckbox
  )
  if (!text) {
    return <span className="editor-line-mirror-empty" />
  }
  const bp = collectBreakpoints(text, s, selectionStart, selectionEnd)
  const parts: React.JSX.Element[] = []
  for (let k = 0; k < bp.length - 1; k++) {
    const a = bp[k]!
    const b = bp[k + 1]!
    if (a === b) continue
    const slice = text.slice(a, b)
    const mid = Math.min(a + Math.floor((b - a - 1) / 2), text.length - 1)
    const cls = classForSlice(a, b, mid >= a ? mid : a, s, lineStrike, selectionStart, selectionEnd)
    parts.push(
      <span key={`${a}:${b}`} className={cls}>
        {slice}
      </span>
    )
  }
  return <span className="editor-line-mirror-parts">{parts}</span>
}
