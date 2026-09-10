import type { ClaudeBlockStatus } from './types'

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
