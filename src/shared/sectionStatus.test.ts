import { describe, expect, it } from 'vitest'
import { SECTION_STATUS_META, SECTION_STATUS_ORDER } from './sectionStatus'

describe('섹션 상태', () => {
  it('할일·진행중·보류·완료 네 단계다', () => {
    expect(SECTION_STATUS_ORDER).toEqual(['todo', 'doing', 'hold', 'done'])
  })

  it('각 상태에 이모지와 라벨이 있다', () => {
    for (const s of SECTION_STATUS_ORDER) {
      expect(SECTION_STATUS_META[s].emoji).toBeTruthy()
      expect(SECTION_STATUS_META[s].label).toBeTruthy()
    }
  })
})
