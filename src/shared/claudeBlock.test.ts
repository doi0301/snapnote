import { describe, expect, it } from 'vitest'
import type { EditorLine } from './types'
import {
  computeClaudeBoxPositions,
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

describe('computeClaudeBoxPositions', () => {
  const line = (
    id: string,
    text: string,
    formatting: EditorLine['formatting'] = {},
    indentLevel = 0
  ): EditorLine => ({ id, text, indentLevel, formatting })

  it('헤더는 start, 중간은 mid, 마지막은 end 로 표시한다', () => {
    const lines = [
      line('t', '메모', {}, 0),
      line('h', '블록', { claudeBlock: { status: 'draft' } }, 0),
      line('s', '{명령}', { claudeSlot: '명령' }, 1),
      line('b', '고쳐줘', {}, 2),
      line('after', '블록 밖', {}, 0)
    ]
    const pos = computeClaudeBoxPositions(lines)
    expect(pos.get(0)).toBeUndefined()
    expect(pos.get(1)).toBe('start')
    expect(pos.get(2)).toBe('mid')
    expect(pos.get(3)).toBe('end')
    expect(pos.get(4)).toBeUndefined()
  })

  it('헤더 혼자면 single 이다', () => {
    const lines = [line('h', '블록', { claudeBlock: { status: 'draft' } }, 0)]
    expect(computeClaudeBoxPositions(lines).get(0)).toBe('single')
  })

  it('접힌 블록은 헤더만 single 이고 나머지에는 위치를 주지 않는다', () => {
    const lines = [
      line('h', '블록', { claudeBlock: { status: 'draft' }, sectionCollapsed: true }, 0),
      line('s', '{명령}', { claudeSlot: '명령' }, 1)
    ]
    const pos = computeClaudeBoxPositions(lines)
    expect(pos.get(0)).toBe('single')
    expect(pos.get(1)).toBeUndefined()
  })

  it('섹션 안에 중첩된 블록도 자기 범위만 감싼다', () => {
    const lines = [
      line('sec', '섹션', { sectionTitle: true }, 0),
      line('sb', '섹션 본문', {}, 1),
      line('h', '블록', { claudeBlock: { status: 'draft' } }, 1),
      line('s', '{명령}', { claudeSlot: '명령' }, 2),
      line('after', '섹션 본문 2', {}, 1)
    ]
    const pos = computeClaudeBoxPositions(lines)
    expect(pos.get(1)).toBeUndefined()
    expect(pos.get(2)).toBe('start')
    expect(pos.get(3)).toBe('end')
    expect(pos.get(4)).toBeUndefined()
  })
})
