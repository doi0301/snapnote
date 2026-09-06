import { describe, expect, it } from 'vitest'
import type { EditorLine } from '@shared/types'
import {
  computeSectionBlockRange,
  computeSectionHiddenIndices,
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
})
