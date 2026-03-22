import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join, isAbsolute, relative } from 'path'
import { BrowserWindow, app, clipboard, dialog, ipcMain, nativeImage } from 'electron'
import { ClipboardService } from './ClipboardService'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  ClipboardInsertPayload,
  EditorLine,
  Memo,
  MemoId,
  MemoOpenPreviewPayload,
  MemoUpdatePatch,
  AppState,
  SettingsUpdatePatch
} from '@shared/types'
import { getDatabase, persistDatabase } from './database/db'
import { ClipboardRepository, isSafeClipboardImageFileName } from './repositories/ClipboardRepository'
import { MemoRepository } from './repositories/MemoRepository'
import { SettingsRepository } from './repositories/SettingsRepository'
import { GlobalShortcutService } from './globalShortcutService'
import { WindowManager } from './WindowManager'

/** TRD §9 export JSON */
interface ExportFile {
  version: string
  exportedAt: string
  memos: Memo[]
}

export class DataService {
  private readonly memos: MemoRepository
  private readonly settings: SettingsRepository
  private readonly clipboard: ClipboardRepository
  private readonly clipboardService: ClipboardService
  private readonly globalShortcutService: GlobalShortcutService
  readonly windowManager: WindowManager

  constructor() {
    const db = (): ReturnType<typeof getDatabase> => getDatabase()
    this.memos = new MemoRepository(db, persistDatabase)
    this.settings = new SettingsRepository(db, persistDatabase)
    this.clipboard = new ClipboardRepository(db, persistDatabase, () =>
      join(app.getPath('userData'), 'clipboard-images')
    )
    this.windowManager = new WindowManager({
      memos: this.memos,
      settings: this.settings,
      broadcast: (channel, ...args) => this.broadcast(channel, ...args),
      onNewMemoFromShortcut: () => {
        const memo = this.createMemoWithStack()
        this.windowManager.openEditWindow(memo.id)
      },
      onOpenHistoryFromShortcut: () => {
        this.windowManager.openHistoryModal()
      }
    })
    this.globalShortcutService = new GlobalShortcutService(() => {
      this.windowManager.toggleFoldedPanel()
    })
    this.clipboardService = new ClipboardService({
      repo: this.clipboard,
      getSettings: () => this.settings.getSettings(),
      onItemAdded: (item) => this.broadcast(IPC_CHANNELS.CLIPBOARD_ITEM_ADDED, item),
      getImageDir: () => join(app.getPath('userData'), 'clipboard-images')
    })
  }

  /** IPC 등록 직후: 클립보드 폴링 시작 + 최초 안내(1회) */
  runPostStartupTasks(): void {
    this.applyLaunchOnStartup(this.settings.getSettings().launchOnStartup)
    this.clipboardService.syncWithSettings()
    this.globalShortcutService.syncFromSettings(this.settings.getSettings())
    void this.maybeShowClipboardMonitoringNotice()
  }

  /** Windows/macOS 로그인 시 실행 (설정 연동) */
  private applyLaunchOnStartup(enabled: boolean): void {
    if (process.platform !== 'win32' && process.platform !== 'darwin') return
    try {
      app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
    } catch (err) {
      console.error('[SnapNote] setLoginItemSettings failed:', err)
    }
  }

  /** 앱 종료 시 폴링 중지 */
  shutdownClipboardMonitoring(): void {
    this.clipboardService.stop()
  }

  /** 전역 단축키 해제 (종료 시) */
  shutdownGlobalShortcuts(): void {
    this.globalShortcutService.dispose()
  }

  private async maybeShowClipboardMonitoringNotice(): Promise<void> {
    try {
      if (process.env.SNAPNOTE_E2E === '1') return
      const s = this.settings.getSettings()
      if (!s.clipboardMonitoring || s.clipboardNoticeShown) return
      await dialog.showMessageBox({
        type: 'info',
        title: 'SnapNote',
        message: '클립보드 모니터링',
        detail:
          '복사한 텍스트와 이미지(비트맵)를 히스토리에 저장합니다. 이미지는 PC에 PNG로 보관되며, 패널에서 이름과 미리보기로 확인할 수 있습니다.\n\n끄려면: 설정 창 → 일반 → 「클립보드 모니터링」 체크를 해제하세요. (트레이 아이콘 메뉴에서 설정을 열 수 있습니다.)'
      })
      const next = this.settings.updateSettings({ clipboardNoticeShown: true })
      this.broadcast(IPC_CHANNELS.SETTINGS_CHANGED, next)
    } catch (err) {
      console.error('[SnapNote] Clipboard monitoring notice failed:', err)
    }
  }

  /** 트레이·메인에서 새 메모 + 스택 선두 (IPC `memo:create`와 동일 로직) */
  createMemoWithStack(): Memo {
    const memo = this.memos.createMemo()
    this.settings.prependMemoToFoldedStack(memo.id)
    this.broadcast(IPC_CHANNELS.MEMO_UPDATED, memo)
    this.broadcast(IPC_CHANNELS.STACK_CHANGED, this.settings.getAppState().foldedStack)
    return memo
  }

  /**
   * E2E/성능: `SNAPNOTE_PERF_SEED` = 1…50 이면 본문 1줄 메모를 그만큼 생성 (폴디드 스택은 건드리지 않음).
   * 히스토리 50개·열기 시간 측정용.
   */
  seedPerfHistoryMemosFromEnv(): void {
    const raw = process.env.SNAPNOTE_PERF_SEED
    if (raw === undefined || raw === '') return
    const n = Math.min(50, Math.max(0, parseInt(raw, 10)))
    if (!Number.isFinite(n) || n <= 0) return
    for (let i = 0; i < n; i++) {
      const m = this.memos.createMemo()
      const line: EditorLine = {
        id: randomUUID(),
        text: `perf-hist-${i}-${'x'.repeat(24)}`,
        indentLevel: 0,
        formatting: {}
      }
      const tags = i % 11 === 0 ? ['perftag'] : []
      this.memos.updateMemo(m.id, { content: [line], tags })
    }
    console.log(`[SnapNote] PERF: seeded ${n} memos (SNAPNOTE_PERF_SEED)`)
  }

  private broadcast(channel: string, ...args: unknown[]): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args)
      }
    }
  }

  registerIpcHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.MEMO_CREATE, () => {
      return this.createMemoWithStack()
    })

    ipcMain.handle(IPC_CHANNELS.MEMO_GET, (_e, id: MemoId) => {
      const memo = this.memos.getMemo(id)
      if (!memo) throw new Error(`Memo not found: ${id}`)
      return memo
    })

    ipcMain.handle(IPC_CHANNELS.MEMO_GET_ALL, () => this.memos.getAllMemos())

    ipcMain.handle(IPC_CHANNELS.MEMO_UPDATE, (_e, payload: { id: MemoId; patch: MemoUpdatePatch }) => {
      const memo = this.memos.updateMemo(payload.id, payload.patch)
      this.broadcast(IPC_CHANNELS.MEMO_UPDATED, memo)
      return memo
    })

    ipcMain.handle(IPC_CHANNELS.MEMO_DELETE, (_e, id: MemoId) => {
      this.memos.deleteMemo(id)
      this.settings.removeMemoFromFoldedStack(id)
      this.windowManager.onMemoDeleted(id)
      this.broadcast(IPC_CHANNELS.STACK_CHANGED, this.settings.getAppState().foldedStack)
      this.broadcast(IPC_CHANNELS.MEMO_DELETED, id)
    })

    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => this.settings.getSettings())

    ipcMain.handle(IPC_CHANNELS.APP_STATE_GET, (): AppState => this.settings.getAppState())

    ipcMain.handle(IPC_CHANNELS.FOLDED_PANEL_HIDE, () => {
      this.windowManager.hideFoldedPanel()
    })

    ipcMain.handle(IPC_CHANNELS.APP_OPEN_HISTORY, () => {
      this.windowManager.openHistoryModal()
    })

    ipcMain.handle(IPC_CHANNELS.FOLDED_PANEL_SET_CONTENT_HEIGHT, (_e, raw: unknown) => {
      const h = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(h) || h <= 0) return
      this.windowManager.setFoldedPanelContentHeight(h)
    })

    ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_e, patch: SettingsUpdatePatch) => {
      const s = this.settings.updateSettings(patch)
      this.broadcast(IPC_CHANNELS.SETTINGS_CHANGED, s)
      this.clipboardService.syncWithSettings()
      if (patch.globalShortcut !== undefined) {
        this.globalShortcutService.syncFromSettings(s)
      }
      if (patch.launchOnStartup !== undefined) {
        this.applyLaunchOnStartup(s.launchOnStartup)
      }
      return s
    })

    ipcMain.handle(IPC_CHANNELS.CLIPBOARD_GET_HISTORY, () => this.clipboard.getItems())

    ipcMain.handle(IPC_CHANNELS.CLIPBOARD_INSERT, async (_e, payload: ClipboardInsertPayload) => {
      if (!payload?.text) return
      this.windowManager.pasteClipboardToEdit(payload.text, payload.targetMemoId ?? null)
    })

    ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE_SYSTEM, (_e, text: string) => {
      if (typeof text === 'string' && text.length > 0) {
        clipboard.writeText(text)
      }
    })

    ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HAS_EDIT_TARGET, () => {
      return this.windowManager.lastFocusedEditMemoId != null
    })

    ipcMain.handle(IPC_CHANNELS.CLIPBOARD_GET_IMAGE_PREVIEW, (_e, id: unknown) => {
      const num = typeof id === 'number' ? id : Number(id)
      if (!Number.isFinite(num)) return null
      const item = this.clipboard.getItemById(num)
      if (!item || item.kind !== 'image' || !item.imagePath) return null
      if (!isSafeClipboardImageFileName(item.imagePath)) return null
      const base = join(app.getPath('userData'), 'clipboard-images')
      const abs = join(base, item.imagePath)
      const rel = relative(base, abs)
      if (rel.startsWith('..') || isAbsolute(rel)) return null
      if (!existsSync(abs)) return null
      try {
        const buf = readFileSync(abs)
        return { dataUrl: `data:image/png;base64,${buf.toString('base64')}` }
      } catch {
        return null
      }
    })

    ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE_SYSTEM_IMAGE, (_e, id: unknown) => {
      const num = typeof id === 'number' ? id : Number(id)
      if (!Number.isFinite(num)) return
      const item = this.clipboard.getItemById(num)
      if (!item || item.kind !== 'image' || !item.imagePath) return
      if (!isSafeClipboardImageFileName(item.imagePath)) return
      const base = join(app.getPath('userData'), 'clipboard-images')
      const abs = join(base, item.imagePath)
      const rel = relative(base, abs)
      if (rel.startsWith('..') || isAbsolute(rel)) return
      if (!existsSync(abs)) return
      try {
        const buf = readFileSync(abs)
        clipboard.writeImage(nativeImage.createFromBuffer(buf))
      } catch (err) {
        console.error('[SnapNote] clipboard write image failed:', err)
      }
    })

    ipcMain.handle(IPC_CHANNELS.MEMO_OPEN_EDIT, (_e, id: MemoId) => {
      this.windowManager.openEditWindow(id)
    })

    ipcMain.handle(IPC_CHANNELS.MEMO_SET_PINNED, (_e, payload: { id: MemoId; pinned: boolean }) => {
      this.windowManager.setEditWindowPinned(payload.id, payload.pinned)
    })
    ipcMain.handle(IPC_CHANNELS.MEMO_FOLD, async (_e, id: MemoId) => {
      await this.windowManager.foldEditWindow(id)
    })
    ipcMain.handle(IPC_CHANNELS.MEMO_CLOSE_FROM_STACK, async (_e, id: MemoId) => {
      await this.windowManager.closeFromStack(id)
    })
    ipcMain.handle(IPC_CHANNELS.MEMO_OPEN_PREVIEW, (_e, payload: MemoOpenPreviewPayload) => {
      this.windowManager.openPreview(payload.id, payload.anchor)
    })
    ipcMain.handle(IPC_CHANNELS.MEMO_CLOSE_PREVIEW, () => {
      this.windowManager.hidePreview()
    })
    ipcMain.handle(IPC_CHANNELS.MEMO_PREVIEW_SCHEDULE_HIDE, (_e, delayMs: number) => {
      const ms = typeof delayMs === 'number' ? delayMs : 120
      this.windowManager.schedulePreviewHide(ms)
    })
    ipcMain.handle(IPC_CHANNELS.MEMO_PREVIEW_CANCEL_SCHEDULED_HIDE, () => {
      this.windowManager.cancelScheduledPreviewHide()
    })

    this.windowManager.init()

    ipcMain.handle(IPC_CHANNELS.APP_EXPORT_MEMOS, async () => {
      const focused = BrowserWindow.getFocusedWindow()
      const memos = this.memos.getAllMemos()
      const payload: ExportFile = {
        version: '1',
        exportedAt: new Date().toISOString(),
        memos
      }
      const saveOpts = {
        title: 'Export memos',
        defaultPath: 'snapnote-memos.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      }
      const { canceled, filePath } = focused
        ? await dialog.showSaveDialog(focused, saveOpts)
        : await dialog.showSaveDialog(saveOpts)
      if (canceled || !filePath) return
      writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    })

    ipcMain.handle(IPC_CHANNELS.APP_CLEAR_ALL_DATA, async () => {
      await this.windowManager.prepareWipeAllMemos()
      this.memos.deleteAllMemos()
      this.clipboard.clearAll()
      this.settings.updateAppState({ foldedStack: [] })
      this.broadcast(IPC_CHANNELS.STACK_CHANGED, this.settings.getAppState().foldedStack)
      this.broadcast(IPC_CHANNELS.MEMOS_DATA_RESET)
    })

    ipcMain.handle(IPC_CHANNELS.APP_IMPORT_MEMOS, async () => {
      const focused = BrowserWindow.getFocusedWindow()
      const openOpts = {
        title: 'Import memos',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile' as const]
      }
      const { canceled, filePaths } = focused
        ? await dialog.showOpenDialog(focused, openOpts)
        : await dialog.showOpenDialog(openOpts)
      if (canceled || !filePaths?.[0]) return
      const raw = readFileSync(filePaths[0], 'utf-8')
      const data = JSON.parse(raw) as ExportFile
      if (!data.memos || !Array.isArray(data.memos)) {
        throw new Error('Invalid export file: missing memos array')
      }
      for (const m of data.memos) {
        if (!m?.id) continue
        if (this.memos.importMemo(m as Memo)) {
          const saved = this.memos.getMemo(m.id)
          if (saved) this.broadcast(IPC_CHANNELS.MEMO_UPDATED, saved)
        }
      }
    })
  }
}
