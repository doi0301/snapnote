import type { ClaudeBlockStatus } from './types'
import templatesJson from './claudeBlockTemplates.json'

export interface ClaudeBlockTemplate {
  id: string
  label: string
  slots: string[]
}

/** 템플릿 정의 — 이 파일(JSON)만 편집하면 코드 수정 없이 종류를 추가·변경할 수 있다 */
export const CLAUDE_BLOCK_TEMPLATES: ClaudeBlockTemplate[] = templatesJson as ClaudeBlockTemplate[]

export const CLAUDE_BLOCK_BLANK_TEMPLATE_ID = 'blank'

export function findClaudeBlockTemplate(templateId: string): ClaudeBlockTemplate | undefined {
  return CLAUDE_BLOCK_TEMPLATES.find((t) => t.id === templateId)
}

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
