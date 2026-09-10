import { describe, expect, it } from 'vitest'
import type { EditorLine } from './types'
import {
  clampDropIndexOutsideBlock,
  computeSectionBlockRange,
  computeSectionHiddenIndices,
  findEnclosingClaudeBlockIndex,
  findEnclosingSectionTitleIndex,
  isBlockHeader,
  moveSectionBlock,
  nextVisibleLineIndex
} from './sectionFold'

function line(
  id: string,
  text: string,
  formatting: EditorLine['formatting'] = {},
  indentLevel = 0
): EditorLine {
  return { id, text, indentLevel, formatting }
}

describe('section fold (들여쓰기 기반)', () => {
  it('hides lines while indent stays deeper than the title, until it returns to title level', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, sectionCollapsed: true, accentBar: 'blue' }, 0),
      line('b', 'body 1', {}, 1),
      line('c', 'body 2', {}, 1),
      line('d', 'back to top level', {}, 0),
      line('e', 'Sec B', { sectionTitle: true, accentBar: 'blue' }, 0)
    ]
    const hidden = computeSectionHiddenIndices(lines)
    expect([...hidden].sort()).toEqual([1, 2])
  })

  it('더 깊게 들여쓴 헤더는 자식으로 품고, 같거나 얕은 헤더에서 끊긴다', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, sectionCollapsed: true, accentBar: 'blue' }, 0),
      line('b', 'body 1', {}, 1),
      line('c', 'Sec B (더 깊게 들여씀)', { sectionTitle: true, accentBar: 'blue' }, 2),
      line('d', 'body of B', {}, 3)
    ]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 3])
    const hidden = computeSectionHiddenIndices(lines)
    expect([...hidden].sort((x, y) => x - y)).toEqual([1, 2, 3])
  })

  it('does not hide when section is expanded', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, sectionCollapsed: false, accentBar: 'blue' }, 0),
      line('b', 'body 1', {}, 1)
    ]
    expect(computeSectionHiddenIndices(lines).size).toBe(0)
  })

  it('a title with no deeper-indented follower has nothing to hide even when collapsed', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, sectionCollapsed: true, accentBar: 'blue' }, 0),
      line('b', 'not indented, so not part of the section', {}, 0)
    ]
    expect(computeSectionHiddenIndices(lines).size).toBe(0)
  })

  it('skips hidden lines when moving focus', () => {
    const hidden = new Set([1, 2])
    expect(nextVisibleLineIndex(0, 1, 5, hidden)).toBe(3)
    expect(nextVisibleLineIndex(3, -1, 5, hidden)).toBe(0)
    expect(nextVisibleLineIndex(0, -1, 5, hidden)).toBeNull()
  })

  it('computeSectionBlockRange includes lines while indent stays deeper than the title', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, accentBar: 'blue' }, 0),
      line('b', 'body 1', {}, 1),
      line('c', 'body 2', {}, 1),
      line('d', 'Sec B', { sectionTitle: true, accentBar: 'blue' }, 0)
    ]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 2])
  })

  it('computeSectionBlockRange stops as soon as indent returns to title level (Shift+Tab exclusion)', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, accentBar: 'blue' }, 0),
      line('b', 'body 1', {}, 1),
      line('c', 'excluded via shift+tab', {}, 0),
      line('d', 're-indented but stays excluded (streak already broken)', {}, 1)
    ]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 1])
  })

  it('computeSectionBlockRange is a single line when nothing below is indented deeper', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, accentBar: 'blue' }, 0),
      line('b', 'body 1 (not indented)', {}, 0)
    ]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 0])
  })

  it('computeSectionBlockRange is a single line for non-section-title lines', () => {
    const lines = [line('a', 'plain'), line('b', 'body 1')]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 0])
  })

  it('findEnclosingSectionTitleIndex finds the owning title for an in-scope index', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, accentBar: 'blue' }, 0),
      line('b', 'body 1', {}, 1),
      line('c', 'body 2', {}, 1)
    ]
    expect(findEnclosingSectionTitleIndex(lines, 1)).toBe(0)
    expect(findEnclosingSectionTitleIndex(lines, 2)).toBe(0)
  })

  it('findEnclosingSectionTitleIndex returns null once indent drops out of scope', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, accentBar: 'blue' }, 0),
      line('b', 'body 1', {}, 1),
      line('c', 'excluded', {}, 0)
    ]
    expect(findEnclosingSectionTitleIndex(lines, 2)).toBeNull()
  })

  it('findEnclosingSectionTitleIndex returns null with no preceding title', () => {
    const lines = [line('a', 'plain', {}, 1)]
    expect(findEnclosingSectionTitleIndex(lines, 0)).toBeNull()
  })

  it('moveSectionBlock moves a block down past a later line', () => {
    const arr = ['A-title', 'A-body', 'B-title', 'B-body']
    // move block [0,1] to drop before index 4 (end of array)
    expect(moveSectionBlock(arr, 0, 1, 4)).toEqual(['B-title', 'B-body', 'A-title', 'A-body'])
  })

  it('moveSectionBlock moves a block up before an earlier line', () => {
    const arr = ['A-title', 'B-title', 'B-body', 'C-title']
    // move block [1,2] (B) to drop at index 0 (before A)
    expect(moveSectionBlock(arr, 1, 2, 0)).toEqual(['B-title', 'B-body', 'A-title', 'C-title'])
  })

  it('moveSectionBlock is a no-op when dropIndex falls inside the block itself', () => {
    const arr = ['A-title', 'A-body', 'B-title']
    expect(moveSectionBlock(arr, 0, 1, 1)).toBe(arr)
    expect(moveSectionBlock(arr, 0, 1, 0)).toBe(arr)
    expect(moveSectionBlock(arr, 0, 1, 2)).toBe(arr)
  })

  it('clampDropIndexOutsideBlock snaps to the nearer boundary', () => {
    expect(clampDropIndexOutsideBlock(1, 0, 3)).toBe(0)
    expect(clampDropIndexOutsideBlock(3, 0, 3)).toBe(4)
    expect(clampDropIndexOutsideBlock(0, 0, 3)).toBe(0)
    expect(clampDropIndexOutsideBlock(5, 0, 3)).toBe(5)
  })

  describe('클로드 블록 (isBlockHeader 일반화 — 섹션과 완전히 같은 알고리즘)', () => {
    it('isBlockHeader recognizes both sectionTitle and claudeBlock', () => {
      expect(isBlockHeader(line('a', 'Sec', { sectionTitle: true }))).toBe(true)
      expect(
        isBlockHeader(line('b', 'Block', { claudeBlock: { templateId: 'blank', status: 'draft' } }))
      ).toBe(true)
      expect(isBlockHeader(line('c', 'plain'))).toBe(false)
    })

    it('computeSectionBlockRange treats claudeSlot lines as plain deeper-indented body', () => {
      const lines = [
        line('h', '클로드 블록', { claudeBlock: { templateId: 'blank', status: 'draft' } }, 0),
        line('s1', '{첨부}', { claudeSlot: '첨부' }, 1),
        line('c1', '파일 A', {}, 2),
        line('s2', '{명령}', { claudeSlot: '명령' }, 1),
        line('c2', '요약해줘', {}, 2)
      ]
      expect(computeSectionBlockRange(lines, 0)).toEqual([0, 4])
    })

    it('클로드 블록도 같은 규칙 — 얕거나 같은 헤더에서 끊기고, 더 깊은 헤더는 품는다', () => {
      const deeper = [
        line('h', '클로드 블록', { claudeBlock: { templateId: 'blank', status: 'draft' } }, 0),
        line('s1', '{첨부}', { claudeSlot: '첨부' }, 1),
        line('sec', 'Sec B (더 깊게 들여씀)', { sectionTitle: true }, 2)
      ]
      expect(computeSectionBlockRange(deeper, 0)).toEqual([0, 2])

      const sameLevel = [
        line('h', '클로드 블록', { claudeBlock: { templateId: 'blank', status: 'draft' } }, 0),
        line('s1', '{첨부}', { claudeSlot: '첨부' }, 1),
        line('sec', 'Sec B (같은 들여쓰기)', { sectionTitle: true }, 0)
      ]
      expect(computeSectionBlockRange(sameLevel, 0)).toEqual([0, 1])
    })

    it('collapsing a claude block hides its slots and content via the shared sectionCollapsed field', () => {
      const lines = [
        line(
          'h',
          '클로드 블록',
          { claudeBlock: { templateId: 'blank', status: 'draft' }, sectionCollapsed: true },
          0
        ),
        line('s1', '{첨부}', { claudeSlot: '첨부' }, 1),
        line('c1', '파일 A', {}, 2)
      ]
      expect([...computeSectionHiddenIndices(lines)].sort()).toEqual([1, 2])
    })

    it('findEnclosingSectionTitleIndex finds the owning claude block header', () => {
      const lines = [
        line('h', '클로드 블록', { claudeBlock: { templateId: 'blank', status: 'draft' } }, 0),
        line('s1', '{첨부}', { claudeSlot: '첨부' }, 1),
        line('c1', '파일 A', {}, 2)
      ]
      expect(findEnclosingSectionTitleIndex(lines, 1)).toBe(0)
      expect(findEnclosingSectionTitleIndex(lines, 2)).toBe(0)
    })
  })
})

describe('중첩 (섹션 > 클로드 블록)', () => {
  /** 섹션(0) > 클로드 블록(1) > 슬롯(2) > 내용(3) > 섹션으로 복귀한 줄(1) */
  const nested = (): EditorLine[] => [
    line('sec', '섹션 A', { sectionTitle: true, accentBar: 'blue' }, 0),
    line('s-body', '섹션 본문', {}, 1),
    line(
      'cb',
      '클로드 블록',
      { claudeBlock: { templateId: 'blank', status: 'draft' }, accentBar: 'blue' },
      1
    ),
    line('slot', '{명령}', { claudeSlot: '명령' }, 2),
    line('content', '고쳐줘', {}, 3),
    line('after', '블록 뒤 섹션 본문', {}, 1),
    line('top', '최상위로 복귀', {}, 0)
  ]

  it('섹션 범위가 더 깊게 들여쓴 클로드 블록을 품는다', () => {
    expect(computeSectionBlockRange(nested(), 0)).toEqual([0, 5])
  })

  it('클로드 블록 범위는 자기 슬롯·내용까지만이다', () => {
    expect(computeSectionBlockRange(nested(), 2)).toEqual([2, 4])
  })

  it('같거나 얕은 들여쓰기의 헤더에서는 여전히 끊긴다', () => {
    const lines = [
      line('a', '섹션 A', { sectionTitle: true }, 0),
      line('b', '본문', {}, 1),
      line('c', '섹션 B', { sectionTitle: true }, 0),
      line('d', 'B 본문', {}, 1)
    ]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 1])
  })

  it('섹션을 접으면 안의 클로드 블록까지 전부 숨는다', () => {
    const lines = nested()
    lines[0] = { ...lines[0]!, formatting: { ...lines[0]!.formatting, sectionCollapsed: true } }
    const hidden = computeSectionHiddenIndices(lines)
    expect([...hidden].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5])
  })

  it('끝난 클로드 블록 뒤의 줄도 바깥 섹션 소속으로 잡는다', () => {
    // index 5 = '블록 뒤 섹션 본문' — 역방향 첫 헤더인 클로드 블록(2)의 범위 밖이지만
    // 거기서 멈추지 말고 바깥으로 계속 스캔해 섹션(0)을 찾아야 한다
    expect(findEnclosingSectionTitleIndex(nested(), 5)).toBe(0)
  })

  it('클로드 블록 내부는 가장 안쪽 클로드 블록 헤더를 돌려준다', () => {
    expect(findEnclosingClaudeBlockIndex(nested(), 4)).toBe(2)
  })

  it('섹션 안이지만 클로드 블록 밖이면 클로드 헤더가 없다고 답한다', () => {
    expect(findEnclosingClaudeBlockIndex(nested(), 1)).toBeNull()
    expect(findEnclosingClaudeBlockIndex(nested(), 5)).toBeNull()
  })
})
