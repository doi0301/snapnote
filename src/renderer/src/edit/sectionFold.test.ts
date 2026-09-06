import { describe, expect, it } from 'vitest'
import type { EditorLine } from '@shared/types'
import {
  clampDropIndexOutsideBlock,
  computeSectionBlockRange,
  computeSectionHiddenIndices,
  moveSectionBlock,
  nextVisibleLineIndex
} from './sectionFold'

function line(id: string, text: string, formatting: EditorLine['formatting'] = {}): EditorLine {
  return { id, text, indentLevel: 0, formatting }
}

describe('section fold', () => {
  it('hides lines until the next section title', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, sectionCollapsed: true, accentBar: 'blue' }),
      line('b', 'body 1'),
      line('c', 'body 2'),
      line('d', 'Sec B', { sectionTitle: true, accentBar: 'blue' }),
      line('e', 'body 3')
    ]
    const hidden = computeSectionHiddenIndices(lines)
    expect([...hidden].sort()).toEqual([1, 2])
  })

  it('does not hide when section is expanded', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, sectionCollapsed: false, accentBar: 'blue' }),
      line('b', 'body 1')
    ]
    expect(computeSectionHiddenIndices(lines).size).toBe(0)
  })

  it('skips hidden lines when moving focus', () => {
    const hidden = new Set([1, 2])
    expect(nextVisibleLineIndex(0, 1, 5, hidden)).toBe(3)
    expect(nextVisibleLineIndex(3, -1, 5, hidden)).toBe(0)
    expect(nextVisibleLineIndex(0, -1, 5, hidden)).toBeNull()
  })

  it('self-only scope does not hide anything even when collapsed', () => {
    const lines = [
      line('a', 'Sec A', {
        sectionTitle: true,
        sectionCollapsed: true,
        sectionScope: 'self-only',
        accentBar: 'blue'
      }),
      line('b', 'body 1'),
      line('c', 'body 2')
    ]
    expect(computeSectionHiddenIndices(lines).size).toBe(0)
  })

  it('computeSectionBlockRange includes lines up to the next title (until-next)', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, accentBar: 'blue' }),
      line('b', 'body 1'),
      line('c', 'body 2'),
      line('d', 'Sec B', { sectionTitle: true, accentBar: 'blue' })
    ]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 2])
  })

  it('computeSectionBlockRange is a single line for self-only scope', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, sectionScope: 'self-only', accentBar: 'blue' }),
      line('b', 'body 1')
    ]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 0])
  })

  it('computeSectionBlockRange is a single line for non-section-title lines', () => {
    const lines = [line('a', 'plain'), line('b', 'body 1')]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 0])
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
