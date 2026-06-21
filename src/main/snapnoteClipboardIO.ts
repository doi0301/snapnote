import { clipboard } from 'electron'
import {
  extractSnapnoteFromHtml,
  parsePayloadJson,
  type SnapnoteClipboardPayload
} from '@shared/snapnoteClipboard'

let cachedRichClipboard: {
  plainText: string
  payload: SnapnoteClipboardPayload
} | null = null

/** 테스트·캐시 초기화 */
export function clearSnapnoteClipboardCache(): void {
  cachedRichClipboard = null
}

export function writeSnapnoteClipboard(
  plainText: string,
  payload: SnapnoteClipboardPayload
): void {
  cachedRichClipboard = { plainText, payload }
  /** HTML/커스텀 MIME 는 외부 앱에서 서식 붙여넣기를 유발하므로 text/plain 만 기록 */
  clipboard.writeText(plainText)
}

export function readSnapnoteClipboard(): SnapnoteClipboardPayload | null {
  let systemText = ''
  try {
    systemText = clipboard.readText()
  } catch {
    return null
  }

  if (
    cachedRichClipboard &&
    cachedRichClipboard.plainText === systemText
  ) {
    return cachedRichClipboard.payload
  }

  /** 이전 버전(HTML 백업) 클립보드 호환 */
  try {
    const html = clipboard.readHTML()
    const json = extractSnapnoteFromHtml(html)
    if (json) {
      const parsed = parsePayloadJson(json)
      if (parsed && linesPlainFromPayload(parsed) === systemText) {
        return parsed
      }
    }
  } catch {
    /* no payload */
  }

  return null
}

function linesPlainFromPayload(payload: SnapnoteClipboardPayload): string {
  return payload.lines.map((l) => l.text).join('\n')
}
