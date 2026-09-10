import type { ClaudeBlockStatus, EditorLine } from './types'
import { computeSectionBlockRange } from './sectionFold'

/**
 * `/클로드` 로 블록을 만들 때 깔리는 기본 슬롯 (P6).
 * 템플릿 유형 개념은 폐기했다 — 실사용이 사실상 {명령} + {첨부} 조합에 수렴해서,
 * 유형을 고르는 단계보다 슬롯을 그때그때 붙이는 편이 빠르다.
 * 사용 빈도 순서대로 깐다.
 */
export const CLAUDE_DEFAULT_SLOT_NAMES = ['명령', '첨부'] as const

/** 슬롯 라벨 텍스트("{첨부}") ↔ claudeSlot 값("첨부") 변환 */
export function slotLabelText(slotName: string): string {
  return `{${slotName}}`
}

export function slotNameFromLabelText(text: string): string {
  return text.trim().replace(/^\{/, '').replace(/\}$/, '').trim()
}

export const CLAUDE_STATUS_ORDER: ClaudeBlockStatus[] = ['draft', 'sent', 'review', 'followup', 'done']

export const CLAUDE_STATUS_META: Record<ClaudeBlockStatus, { emoji: string; label: string }> = {
  draft: { emoji: '⚪', label: '작성중' },
  sent: { emoji: '🔵', label: '질문완료' },
  review: { emoji: '🟡', label: '답변검토' },
  followup: { emoji: '🟠', label: '추가질문' },
  done: { emoji: '✅', label: '종료' }
}

/** followup 선택 시 블록 끝에 자동으로 붙는 슬롯 이름 */
export const CLAUDE_FOLLOWUP_SLOT_NAME = '추가질문'

/** 클로드 블록을 테두리로 감쌀 때, 한 줄이 박스의 어디인지 */
export type ClaudeBoxPos = 'start' | 'mid' | 'end' | 'single'

/**
 * 클로드 블록 범위의 각 줄에 박스 위치를 배정한다 (P6).
 * DOM 을 그룹핑하지 않고 줄마다 CSS 테두리 조각을 그리기 위한 파생 데이터다 —
 * 렌더 루프의 평면 구조(드롭 인디케이터·패드·인덱스 기반 포커스)를 건드리지 않는다.
 * 접힌 블록은 헤더만 `single` 이 된다 (나머지 줄은 어차피 렌더되지 않는다).
 */
export function computeClaudeBoxPositions(lines: EditorLine[]): Map<number, ClaudeBoxPos> {
  const pos = new Map<number, ClaudeBoxPos>()
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]?.formatting?.claudeBlock) continue
    if (lines[i]?.formatting?.sectionCollapsed) {
      pos.set(i, 'single')
      continue
    }
    const [, end] = computeSectionBlockRange(lines, i)
    if (end === i) {
      pos.set(i, 'single')
      continue
    }
    pos.set(i, 'start')
    for (let j = i + 1; j < end; j++) pos.set(j, 'mid')
    pos.set(end, 'end')
  }
  return pos
}
