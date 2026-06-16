import { describe, expect, it } from 'vitest'
import { embedSnapnoteInHtml, extractSnapnoteFromHtml, parsePayloadJson } from '@shared/snapnoteClipboard'

describe('snapnoteClipboard HTML backup', () => {
  it('round-trips payload in html comment', () => {
    const json = '{"version":1,"lines":[{"text":"hi","indentLevel":0,"formatting":{}}]}'
    const html = embedSnapnoteInHtml('hi', json)
    const extracted = extractSnapnoteFromHtml(html)
    expect(extracted).toBe(json)
    expect(parsePayloadJson(extracted!)?.lines[0]?.text).toBe('hi')
  })
})
