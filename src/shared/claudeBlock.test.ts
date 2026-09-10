import { describe, expect, it } from 'vitest'
import {
  CLAUDE_DEFAULT_SLOT_NAMES,
  CLAUDE_STATUS_META,
  CLAUDE_STATUS_ORDER,
  slotLabelText,
  slotNameFromLabelText
} from './claudeBlock'

describe('기본 슬롯', () => {
  it('사용 빈도 순서대로 명령 → 첨부 두 개다', () => {
    expect([...CLAUDE_DEFAULT_SLOT_NAMES]).toEqual(['명령', '첨부'])
  })
})

describe('slot label helpers', () => {
  it('slotLabelText wraps the name in braces', () => {
    expect(slotLabelText('첨부')).toBe('{첨부}')
  })

  it('slotNameFromLabelText strips braces and whitespace', () => {
    expect(slotNameFromLabelText('{첨부}')).toBe('첨부')
    expect(slotNameFromLabelText('  {명령} ')).toBe('명령')
    expect(slotNameFromLabelText('명령')).toBe('명령')
  })
})

describe('status meta', () => {
  it('has all 5 statuses in order with an emoji + label each', () => {
    expect(CLAUDE_STATUS_ORDER).toEqual(['draft', 'sent', 'review', 'followup', 'done'])
    for (const s of CLAUDE_STATUS_ORDER) {
      expect(CLAUDE_STATUS_META[s].emoji).toBeTruthy()
      expect(CLAUDE_STATUS_META[s].label).toBeTruthy()
    }
  })
})
