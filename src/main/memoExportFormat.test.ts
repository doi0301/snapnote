import { describe, expect, it } from 'vitest'
import type { Memo } from '@shared/types'
import {
  memoMarkdownDefaultFilename,
  memosMarkdownDefaultFilename,
  sanitizeFilenamePart
} from './memoExportFormat'

function stubMemo(title: string): Memo {
  return {
    id: 'abc',
    content: [{ id: '1', text: title, indentLevel: 0, formatting: {} }],
    tags: [],
    color: 'coral',
    isPinned: false,
    pinnedAt: null,
    windowX: null,
    windowY: null,
    windowWidth: 400,
    windowHeight: 300,
    isDone: false,
    isFavorite: false,
    createdAt: '',
    updatedAt: ''
  }
}

describe('sanitizeFilenamePart', () => {
  it('replaces forbidden chars and truncates', () => {
    expect(sanitizeFilenamePart('hello/world:test', 15)).toBe('hello_world_tes')
  })

  it('returns memo for empty', () => {
    expect(sanitizeFilenamePart('   ', 15)).toBe('memo')
  })
})

describe('memoMarkdownDefaultFilename', () => {
  it('uses snapnote_ prefix and title up to 15 chars', () => {
    expect(memoMarkdownDefaultFilename(stubMemo('회의록 2025'))).toBe('snapnote_회의록 2025.md')
    expect(memoMarkdownDefaultFilename(stubMemo('가'.repeat(20)))).toBe(
      `snapnote_${'가'.repeat(15)}.md`
    )
  })

  it('uses memo for empty title', () => {
    expect(memoMarkdownDefaultFilename(stubMemo(''))).toBe('snapnote_(제목없음).md')
  })
})

describe('memosMarkdownDefaultFilename', () => {
  it('single vs multiple', () => {
    expect(memosMarkdownDefaultFilename([stubMemo('a')])).toBe('snapnote_a.md')
    expect(memosMarkdownDefaultFilename([stubMemo('a'), stubMemo('b')])).toBe('snapnote_export.md')
  })
})
