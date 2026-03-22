import { app } from 'electron'

/** `app.quit()` 경로에서 폴디드 `close`의 preventDefault를 막기 위한 플래그 */
let appQuitting = false

export function setAppQuitting(value: boolean): void {
  appQuitting = value
}

export function isAppQuitting(): boolean {
  return appQuitting
}

/**
 * 트레이 Quit 등에서 호출. 일부 환경에서 `before-quit`보다 창 `close`가 먼저 오면
 * `preventDefault`로 종료가 막히므로, `app.quit()` 전에 반드시 플래그를 켠다.
 */
export function requestQuit(): void {
  setAppQuitting(true)
  app.quit()
}
