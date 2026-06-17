import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SnapnoteClipboardPayload } from '@shared/snapnoteClipboard'

const { writeMock, writeBufferMock } = vi.hoisted(() => ({
  writeMock: vi.fn(),
  writeBufferMock: vi.fn()
}))

vi.mock('electron', () => ({
  clipboard: {
    write: writeMock,
    writeBuffer: writeBufferMock,
    has: vi.fn(() => false),
    readBuffer: vi.fn(),
    readHTML: vi.fn(() => '')
  }
}))

import { writeSnapnoteClipboard } from './snapnoteClipboardIO'

const payload: SnapnoteClipboardPayload = {
  version: 1,
  lines: [{ text: 'hello', indentLevel: 0, formatting: {} }]
}

describe('writeSnapnoteClipboard', () => {
  beforeEach(() => {
    writeMock.mockClear()
    writeBufferMock.mockClear()
  })

  it('writes text and html once without writeBuffer', () => {
    writeSnapnoteClipboard('hello', payload)
    expect(writeMock).toHaveBeenCalledTimes(1)
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'hello',
        html: expect.stringContaining('hello')
      })
    )
    expect(writeBufferMock).not.toHaveBeenCalled()
  })
})
