import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { BrowserWindow, app, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { UpdateEventPayload } from '@shared/types'

/**
 * electron-builder 가 리소스에 넣은 업데이트 메타가 유효한지 확인.
 * `app-update.yml` 이 없거나 플레이스홀더(example.com)가 남아 있으면 true.
 * `SNAPNOTE_ENABLE_AUTO_UPDATE=1` 로 강제 활성화 가능.
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

let feedAndListenersReady = false

function broadcastUpdate(payload: UpdateEventPayload): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(IPC_CHANNELS.UPDATE_EVENT, payload)
  }
}

/**
 * GitHub 피드 설정 + 이벤트 리스너 1회 등록. 실패 시 false (설정 화면에서 업데이트 불가).
 */
function ensureUpdaterReady(): boolean {
  if (is.dev || !app.isPackaged) return false
  if (process.env.SNAPNOTE_E2E === '1') return false
  if (process.env.SNAPNOTE_DISABLE_AUTO_UPDATE === '1') return false
  if (feedAndListenersReady) return true

  const baseOverride = process.env.SNAPNOTE_UPDATE_BASE_URL?.trim()
  const forceEnable = process.env.SNAPNOTE_ENABLE_AUTO_UPDATE === '1'

  if (baseOverride) {
    autoUpdater.setFeedURL({ provider: 'generic', url: baseOverride })
  } else if (embeddedFeedLooksPlaceholder() && !forceEnable) {
    console.info(
      '[SnapNote] auto-update: publish 설정 미완료. `electron-builder.yml` 의 publish 섹션을 확인하세요. 환경변수 SNAPNOTE_ENABLE_AUTO_UPDATE=1 / SNAPNOTE_UPDATE_BASE_URL 로도 활성화 가능.'
    )
    return false
  }

  autoUpdater.autoDownload = false
  autoUpdater.allowDowngrade = false

  autoUpdater.on('error', (err) => {
    console.warn('[SnapNote] autoUpdater:', err?.message ?? err)
    broadcastUpdate({ type: 'error', message: err?.message ?? String(err) })
  })

  autoUpdater.on('download-progress', (p) => {
    broadcastUpdate({ type: 'download-progress', percent: p.percent })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcastUpdate({ type: 'update-downloaded', version: info.version })
  })

  feedAndListenersReady = true
  return true
}

/**
 * IPC: 버전 표시, 업데이트 확인·다운로드·설치 (패키징 빌드 + 피드 설정 시).
 * 개발 모드에서는 `reason: 'not-packaged'` 등으로 UI가 안내 가능.
 */
export function registerUpdaterIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => app.getVersion())

  ipcMain.handle(IPC_CHANNELS.APP_UPDATER_CHECK, async () => {
    if (is.dev || !app.isPackaged) {
      return { ok: false as const, reason: 'not-packaged' as const }
    }
    if (!ensureUpdaterReady()) {
      return { ok: false as const, reason: 'feed-not-configured' as const }
    }
    broadcastUpdate({ type: 'checking' })
    try {
      const result = await autoUpdater.checkForUpdates()
      if (!result?.isUpdateAvailable) {
        return { ok: true as const, available: false as const }
      }
      return {
        ok: true as const,
        available: true as const,
        version: result.updateInfo.version
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false as const, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_UPDATER_DOWNLOAD, async () => {
    if (!ensureUpdaterReady()) {
      return { ok: false as const, reason: 'feed-not-configured' as const }
    }
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true as const }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false as const, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_UPDATER_QUIT_AND_INSTALL, () => {
    if (!ensureUpdaterReady()) return { ok: false as const }
    autoUpdater.quitAndInstall(false, true)
    return { ok: true as const }
  })
}
