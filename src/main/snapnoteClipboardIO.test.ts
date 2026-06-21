import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SnapnoteClipboardPayload } from '@shared/snapnoteClipboard'

const { writeTextMock, readTextMock, readHTMLMock } = vi.hoisted(() => ({
  writeTextMock: vi.fn(),
  readTextMock: vi.fn(() => ''),
  readHTMLMock: vi.fn(() => '')
}))

vi.mock('electron', () => ({
  clipboard: {
    writeText: writeTextMock,
    readText: readTextMock,
    readHTML: readHTMLMock
  }
}))

import {
  clearSnapnoteClipboardCache,
  readSnapnoteClipboard,
  writeSnapnoteClipboard
} from './snapnoteClipboardIO'

const payload: SnapnoteClipboardPayload = {
  version: 1,
  lines: [{ text: 'hello', indentLevel: 0, formatting: {} }]
}

describe('writeSnapnoteClipboard', () => {
  beforeEach(() => {
    writeTextMock.mockClear()
    readTextMock.mockClear()
    readHTMLMock.mockClear()
    clearSnapnoteClipboardCache()
  })

  it('writes text/plain only without html or custom mime', () => {
    writeSnapnoteClipboard('hello', payload)
    expect(writeTextMock).toHaveBeenCalledTimes(1)
    expect(writeTextMock).toHaveBeenCalledWith('hello')
  })
})

describe('readSnapnoteClipboard', () => {
  beforeEach(() => {
    clearSnapnoteClipboardCache()
  })

  it('returns cached payload when system text matches', () => {
    writeSnapnoteClipboard('hello', payload)
    readTextMock.mockReturnValue('hello')
    expect(readSnapnoteClipboard()).toEqual(payload)
  })

  it('returns null when clipboard text changed externally', () => {
    writeSnapnoteClipboard('hello', payload)
    readTextMock.mockReturnValue('other')
    expect(readSnapnoteClipboard()).toBeNull()
  })
})
