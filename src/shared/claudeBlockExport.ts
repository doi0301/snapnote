import type { EditorLine } from './types'
import { computeSectionBlockRange } from './sectionFold'
import { slotLabelText } from './claudeBlock'

interface SlotGroup {
  slotName: string
  slotIndent: number
  contentLines: string[]
}

/**
 * 클로드 블록을 `[복사]` 형식의 프롬프트 텍스트로 조립한다 (기능정의서 6번).
 * - 라벨 줄은 `{라벨}` 그대로 출력, 다음 줄부터 내용
 * - 슬롯 사이 빈 줄 1개
 * - 내용 줄의 들여쓰기 계층은 슬롯 기준 상대 들여쓰기 × 공백 2칸으로 변환
 * - 블록 헤더(제목·배지·버튼)는 애초에 순회 범위에서 제외
 * - 취소선 처리된 줄(슬롯 라벨 포함)과, 내용이 빈 슬롯은 라벨째 생략
 */
export function exportClaudeBlockToText(lines: EditorLine[], headerIndex: number): string {
  const [, end] = computeSectionBlockRange(lines, headerIndex)
  const groups: SlotGroup[] = []
  let current: SlotGroup | null = null

  for (let i = headerIndex + 1; i <= end; i++) {
    const line = lines[i]
    if (!line) continue
    const slotName = line.formatting?.claudeSlot
    if (slotName) {
      if (line.formatting?.strikethrough) {
        current = null
        continue
      }
      current = { slotName, slotIndent: line.indentLevel, contentLines: [] }
      groups.push(current)
      continue
    }
    if (!current || line.formatting?.strikethrough) continue
    const relative = Math.max(0, line.indentLevel - current.slotIndent - 1)
    const prefix = '  '.repeat(relative)
    current.contentLines.push(...line.text.split('\n').map((t) => prefix + t))
  }

  const parts: string[] = []
  for (const g of groups) {
    const body = g.contentLines.join('\n')
    if (!body.trim()) continue
    parts.push(`${slotLabelText(g.slotName)}\n${body}`)
  }
  return parts.join('\n\n')
}
