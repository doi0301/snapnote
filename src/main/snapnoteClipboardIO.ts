import { clipboard } from 'electron'
import {
  SNAPNOTE_CLIPBOARD_MIME,
  embedSnapnoteInHtml,
  extractSnapnoteFromHtml,
  parsePayloadJson,
  payloadToJson,
  type SnapnoteClipboardPayload
} from '@shared/snapnoteClipboard'

export function writeSnapnoteClipboard(
  plainText: string,
  payload: SnapnoteClipboardPayload
): void {
  const json = payloadToJson(payload)
  const html = embedSnapnoteInHtml(plainText, json)
  clipboard.write({
    text: plainText,
    html
  })
  try {
    clipboard.writeBuffer(SNAPNOTE_CLIPBOARD_MIME, Buffer.from(json, 'utf8'))
  } catch {
    /* html 백업으로 충분 */
  }
}

export function readSnapnoteClipboard(): SnapnoteClipboardPayload | null {
  try {
    if (clipboard.has(SNAPNOTE_CLIPBOARD_MIME)) {
      const buf = clipboard.readBuffer(SNAPNOTE_CLIPBOARD_MIME)
      const json = buf.toString('utf8')
      const parsed = parsePayloadJson(json)
      if (parsed) return parsed
    }
  } catch {
    /* fall through */
  }

  try {
    const html = clipboard.readHTML()
    const json = extractSnapnoteFromHtml(html)
    if (json) {
      const parsed = parsePayloadJson(json)
      if (parsed) return parsed
    }
  } catch {
    /* no payload */
  }

  return null
}
