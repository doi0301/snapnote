import { describe, expect, it } from 'vitest'
import type { EditorLine } from './types'
import {
  clampDropIndexOutsideBlock,
  computeSectionBlockRange,
  computeSectionHiddenIndices,
  findEnclosingSectionTitleIndex,
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

  it('always stops at the next section title regardless of its indent (no nesting)', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, sectionCollapsed: true, accentBar: 'blue' }, 0),
      line('b', 'body 1', {}, 1),
      line('c', 'Sec B (더 깊게 들여씀)', { sectionTitle: true, accentBar: 'blue' }, 2),
      line('d', 'body of B', {}, 3)
    ]
    const hidden = computeSectionHiddenIndices(lines)
    expect([...hidden].sort()).toEqual([1])
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
})
