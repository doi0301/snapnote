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
  /** writeBuffer 는 Windows 에서 text/plain 을 덮어써 외부 앱 붙여넣기가 깨진다. SnapNote 메타는 HTML 주석으로만 보관 */
  clipboard.write({
    text: plainText,
    html
  })
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
