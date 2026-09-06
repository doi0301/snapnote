import { describe, expect, it } from 'vitest'
import {
  CLAUDE_BLOCK_BLANK_TEMPLATE_ID,
  CLAUDE_BLOCK_TEMPLATES,
  CLAUDE_STATUS_META,
  CLAUDE_STATUS_ORDER,
  findClaudeBlockTemplate,
  slotLabelText,
  slotNameFromLabelText
} from './claudeBlock'

describe('claudeBlock templates', () => {
  it('has the 5 templates from the spec, each with an id/label/slots', () => {
    expect(CLAUDE_BLOCK_TEMPLATES).toHaveLength(5)
    for (const t of CLAUDE_BLOCK_TEMPLATES) {
      expect(typeof t.id).toBe('string')
      expect(typeof t.label).toBe('string')
      expect(Array.isArray(t.slots)).toBe(true)
      expect(t.slots.length).toBeGreaterThan(0)
    }
  })

  it('has a blank template with {첨부}/{명령} slots', () => {
    const blank = findClaudeBlockTemplate(CLAUDE_BLOCK_BLANK_TEMPLATE_ID)
    expect(blank?.slots).toEqual(['첨부', '명령'])
  })

  it('findClaudeBlockTemplate returns undefined for unknown ids', () => {
    expect(findClaudeBlockTemplate('nope')).toBeUndefined()
  })

  it('template ids are unique', () => {
    const ids = CLAUDE_BLOCK_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
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
