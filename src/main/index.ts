import { existsSync, mkdirSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { app, BrowserWindow } from 'electron'
import { setupApplicationMenu } from './applicationMenu'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { requestQuit, setAppQuitting } from './appLifecycle'
import { DataService } from './DataService'
import { closeDatabase, initDatabase } from './database/db'
import { TrayManager } from './TrayManager'

app.setName('SnapNote')

/** E2E: 임시 userData + 단일 인스턴스 락 우회 (`playwright test`) */
const isE2E = process.env.SNAPNOTE_E2E === '1'
if (isE2E) {
  app.setPath('userData', mkdtempSync(join(tmpdir(), 'snapnote-e2e-')))
}

/**
 * Windows에서 Chromium disk_cache / GPU cache ERROR(0x5) 완화용.
 * 주의: cache를 userData *안*에 두면 일부 Electron 버전에서 userData가 중첩되어
 * DB가 ...\electron-disk-cache\SnapNote\snapnote.db 로 잘못 생길 수 있음 → appData 형제 폴더 사용.
 */
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
  try {
    const cacheRoot = join(app.getPath('appData'), 'SnapNoteChromiumCache')
    mkdirSync(cacheRoot, { recursive: true })
    app.setPath('cache', cacheRoot)
  } catch {
    // 캐시 경로 설정 실패 시 기본값 사용
  }
}

function resolveTrayIconPath(): string {
  const candidates = [
    join(app.getAppPath(), 'resources', 'icon.png'),
    join(__dirname, '../../resources/icon.png')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return candidates[0]
}

let dataService: DataService | undefined
/** `before-quit`에서 비동기 플러시 후 `app.quit()` 재호출용 */
let quitAfterFlushPrepared = false

/** 앱 하나만 실행 (두 번째 실행은 기존 인스턴스의 폴디드만 앞으로). E2E는 병렬/연속 실행을 위해 락 생략 */
const hasMainInstanceLock = isE2E || app.requestSingleInstanceLock()

if (!hasMainInstanceLock) {
  app.quit()
} else {
  if (!isE2E) {
    app.on('second-instance', () => {
      dataService?.windowManager.showFoldedPanel()
    })
  }

  app
    .whenReady()
    .then(async () => {
      electronApp.setAppUserModelId('com.snapnote.app')
      setupApplicationMenu()

      /**
       * 앱 시작 순서 (TASK-S5-02)
       * 1. `initDatabase()` — SQLite(sql.js) 준비
       * 2. `new DataService()` — Repository + WindowManager(인스턴스만) + Clipboard/GlobalShortcut 서비스
       * 3. `registerIpcHandlers()` — IPC 등록 후 말미에 `windowManager.init()` → 폴디드 창 생성
       *    (`foldedPanelOptions`가 `app_state`의 x/y·스택은 렌더러가 `getState`로 복원)
       * 4. `runPostStartupTasks()` — 로그인 시 실행 적용, 클립보드 폴링(설정 ON 시), 전역 단축키 등록, 클립보드 안내(1회)
       * 5. `TrayManager.init()` — 트레이 아이콘·메뉴
       */
      await initDatabase()

      dataService = new DataService()
      dataService.seedPerfHistoryMemosFromEnv()
      dataService.registerIpcHandlers()
      dataService.runPostStartupTasks()

      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      const tray = new TrayManager({
        toggleFolded: () => dataService!.windowManager.toggleFoldedPanel(),
        showFolded: () => dataService!.windowManager.showFoldedPanel(),
        newMemo: () => {
          const memo = dataService!.createMemoWithStack()
          dataService!.windowManager.openEditWindow(memo.id)
        },
        openHistory: () => dataService!.windowManager.openHistoryModal(),
        openSettings: () => dataService!.windowManager.openSettingsWindow(),
        quit: () => requestQuit()
      })
      tray.init(resolveTrayIconPath())

      /** E2E: OS 전역 단축키와 동일한 `toggleFoldedPanel` 경로를 메인에서 직접 호출 */
      if (isE2E) {
        ;(globalThis as unknown as { __snapnoteE2E: { toggleFolded: () => void } }).__snapnoteE2E = {
          toggleFolded: (): void => {
            dataService?.windowManager.toggleFoldedPanel()
          }
        }
      }

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          dataService?.windowManager.showFoldedPanel()
        }
      })
    })
    .catch((err) => {
      console.error('[SnapNote] Startup failed:', err)
    })

  /**
   * 트레이 상주: 창이 모두 닫혀도 `app.quit()` 호출하지 않음.
   * (Electron 기본은 macOS에서 dock 유지 등이지만, SnapNote는 Win/macOS/Linux 모두 트레이로 유지)
   */
  app.on('window-all-closed', () => {})

  app.on('before-quit', (e) => {
    if (quitAfterFlushPrepared) {
      return
    }
    e.preventDefault()
    quitAfterFlushPrepared = true
    setAppQuitting(true)
    void (async () => {
      try {
        await dataService?.windowManager.flushAllOpenEditDraftsFromDom()
      } catch (err) {
        console.error('[SnapNote] flush edit drafts on quit failed:', err)
      }
      dataService?.shutdownClipboardMonitoring()
      dataService?.shutdownGlobalShortcuts()
      dataService?.windowManager.dispose()
      closeDatabase()
      app.quit()
    })()
  })
}
