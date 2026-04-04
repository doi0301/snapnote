import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { SnapnotePreloadAPI, UpdateCheckResult } from '@shared/snapnote-api'
import type { UpdateEventPayload } from '@shared/types'
import type {
  AppState,
  ClipboardInsertPayload,
  ClipboardItem,
  Memo,
  MemoId,
  MemoOpenPreviewPayload,
  MemoUpdatePatch,
  Settings,
  SettingsUpdatePatch
} from '@shared/types'

function createSnapnoteApi(): SnapnotePreloadAPI {
  const memo = {
    create: (): Promise<Memo> => ipcRenderer.invoke(IPC_CHANNELS.MEMO_CREATE),
    update: (payload: { id: MemoId; patch: MemoUpdatePatch }): Promise<Memo> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMO_UPDATE, payload),
    delete: (id: MemoId): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.MEMO_DELETE, id),
    getAll: (): Promise<Memo[]> => ipcRenderer.invoke(IPC_CHANNELS.MEMO_GET_ALL),
    get: (id: MemoId): Promise<Memo> => ipcRenderer.invoke(IPC_CHANNELS.MEMO_GET, id),
    openEdit: (id: MemoId): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.MEMO_OPEN_EDIT, id),
    fold: (id: MemoId): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.MEMO_FOLD, id),
    closeFromStack: (id: MemoId): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMO_CLOSE_FROM_STACK, id),
    openPreview: (payload: MemoOpenPreviewPayload): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMO_OPEN_PREVIEW, payload),
    closePreview: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.MEMO_CLOSE_PREVIEW),
    schedulePreviewHide: (delayMs = 120): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMO_PREVIEW_SCHEDULE_HIDE, delayMs),
    cancelScheduledPreviewHide: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMO_PREVIEW_CANCEL_SCHEDULED_HIDE),
    setPinned: (payload: { id: MemoId; pinned: boolean }): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEMO_SET_PINNED, payload)
  }

  const clipboard = {
    getHistory: (): Promise<ClipboardItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_GET_HISTORY),
    insert: (payload: ClipboardInsertPayload): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_INSERT, payload),
    writeSystem: (text: string, opts?: { skipHistory?: boolean }): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE_SYSTEM, text, opts),
    hasEditInsertTarget: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_HAS_EDIT_TARGET),
    getImagePreview: (id: number): Promise<{ dataUrl: string } | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_GET_IMAGE_PREVIEW, id),
    writeSystemImage: (id: number): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE_SYSTEM_IMAGE, id)
  }

  const settings = {
    get: (): Promise<Settings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (patch: SettingsUpdatePatch): Promise<Settings> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, patch)
  }

  const app = {
    exportMemos: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.APP_EXPORT_MEMOS),
    exportMemosAsFile: (payload: { ids: string[] }): Promise<{ ok: boolean; reason?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_EXPORT_MEMOS_AS_FILE, payload),
    importMemos: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.APP_IMPORT_MEMOS),
    clearAllData: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.APP_CLEAR_ALL_DATA),
    getState: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.APP_STATE_GET),
    hideFoldedPanel: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.FOLDED_PANEL_HIDE),
    openHistory: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_HISTORY),
    setFoldedPanelContentHeight: (heightPx: number): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.FOLDED_PANEL_SET_CONTENT_HEIGHT, heightPx),
    moveEditWindowByDelta: (dx: number, dy: number): void => {
      ipcRenderer.send(IPC_CHANNELS.EDIT_WINDOW_MOVE_DELTA, { dx, dy })
    },
    notifyEditWindowDragEnd: (): void => {
      ipcRenderer.send(IPC_CHANNELS.EDIT_WINDOW_DRAG_END)
    },
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATER_CHECK),
    downloadUpdate: (): Promise<{ ok: boolean; reason?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATER_DOWNLOAD),
    quitAndInstall: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATER_QUIT_AND_INSTALL)
  }

  const on = {
    memoUpdated: (cb: (memo: Memo) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, memo: Memo): void => cb(memo)
      ipcRenderer.on(IPC_CHANNELS.MEMO_UPDATED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MEMO_UPDATED, listener)
    },
    memoDeleted: (cb: (id: MemoId) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, id: MemoId): void => cb(id)
      ipcRenderer.on(IPC_CHANNELS.MEMO_DELETED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MEMO_DELETED, listener)
    },
    stackChanged: (cb: (ids: MemoId[]) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, ids: MemoId[]): void => cb(ids)
      ipcRenderer.on(IPC_CHANNELS.STACK_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.STACK_CHANGED, listener)
    },
    clipboardItemAdded: (cb: (item: ClipboardItem) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, item: ClipboardItem): void => cb(item)
      ipcRenderer.on(IPC_CHANNELS.CLIPBOARD_ITEM_ADDED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLIPBOARD_ITEM_ADDED, listener)
    },
    settingsChanged: (cb: (settings: Settings) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, settings: Settings): void => cb(settings)
      ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_CHANGED, listener)
    },
    memosDataReset: (cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC_CHANNELS.MEMOS_DATA_RESET, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MEMOS_DATA_RESET, listener)
    },
    clipboardPasteText: (cb: (text: string) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, text: string): void => cb(text)
      ipcRenderer.on(IPC_CHANNELS.CLIPBOARD_PASTE_TEXT, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLIPBOARD_PASTE_TEXT, listener)
    },
    updateEvent: (cb: (payload: UpdateEventPayload) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: UpdateEventPayload): void => cb(payload)
      ipcRenderer.on(IPC_CHANNELS.UPDATE_EVENT, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_EVENT, listener)
    }
  }

  return { memo, clipboard, settings, app, on }
}

const snapnote = createSnapnoteApi()

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('snapnote', snapnote)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error non-isolated fallback
  window.electron = electronAPI
  // @ts-expect-error non-isolated fallback
  window.snapnote = snapnote
}
