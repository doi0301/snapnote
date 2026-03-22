import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'

/**
 * electron-builder 가 리소스에 넣은 업데이트 메타에 example.com 이 남아 있으면
 * 매 실행마다 쓸모없는 요청을 하지 않는다. 실제 `publish.url` 로 다시 빌드하면 검사가 켜진다.
 * 메타 파일이 없거나 애매하면 `SNAPNOTE_ENABLE_AUTO_UPDATE=1` 로 강제 활성화 가능.
 */
function embeddedFeedLooksPlaceholder(): boolean {
  try {
    const p = join(process.resourcesPath, 'app-update.yml')
    if (!existsSync(p)) return true
    const raw = readFileSync(p, 'utf8')
    return raw.includes('example.com')
  } catch {
    return true
  }
}

/**
 * 패키징된 앱에서만 generic 피드로 업데이트 확인.
 * - 개발 / E2E / `SNAPNOTE_DISABLE_AUTO_UPDATE=1` 이면 동작 안 함.
 * - `SNAPNOTE_UPDATE_BASE_URL` 이 있으면 그 URL로 피드 고정(테스트·스테이징용).
 */
export function setupAutoUpdater(): void {
  if (is.dev || !app.isPackaged) return
  if (process.env.SNAPNOTE_E2E === '1') return
  if (process.env.SNAPNOTE_DISABLE_AUTO_UPDATE === '1') return

  const baseOverride = process.env.SNAPNOTE_UPDATE_BASE_URL?.trim()
  const forceEnable = process.env.SNAPNOTE_ENABLE_AUTO_UPDATE === '1'

  if (baseOverride) {
    autoUpdater.setFeedURL({ provider: 'generic', url: baseOverride })
  } else if (embeddedFeedLooksPlaceholder() && !forceEnable) {
    console.info(
      '[SnapNote] auto-update: publish URL 미설정(example.com) 또는 메타 없음. `electron-builder.yml` 의 publish.url 을 바꾼 뒤 재빌드하거나, SNAPNOTE_ENABLE_AUTO_UPDATE=1 / SNAPNOTE_UPDATE_BASE_URL 로 켜세요.'
    )
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('error', (err) => {
    console.warn('[SnapNote] autoUpdater:', err?.message ?? err)
  })

  void autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
    console.warn('[SnapNote] checkForUpdates failed:', err)
  })
}
