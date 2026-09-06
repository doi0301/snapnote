import { describe, expect, it } from 'vitest'
import { EMOJI_PALETTE_ITEMS } from './emojiPaletteItems'

function symbolChars(): string[] {
  return EMOJI_PALETTE_ITEMS.filter((i) => i.kind === 'sym').map((i) => i.char)
}

describe('이모지 팔레트 상태 아이콘', () => {
  it('완료·취소·진행중을 색으로 구분되는 아이콘으로 제공한다', () => {
    const chars = symbolChars()
    expect(chars).toContain('✅')
    expect(chars).toContain('❌')
    expect(chars).toContain('👀')
  })

  it('색이 없어 구분되지 않는 체크·엑스·별·십자가는 제공하지 않는다', () => {
    const chars = symbolChars()
    for (const removed of ['✓', '✔', '✗', '☆', '★', '†']) {
      expect(chars).not.toContain(removed)
    }
  })
})
