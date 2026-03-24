/**
 * Preload에서 노출하는 Renderer용 API 계약 (타입 단일화)
 */
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
} from './types'

export interface SnapnotePreloadAPI {
  memo: {
    create: () => Promise<Memo>
    update: (payload: { id: MemoId; patch: MemoUpdatePatch }) => Promise<Memo>
    delete: (id: MemoId) => Promise<void>
    getAll: () => Promise<Memo[]>
    get: (id: MemoId) => Promise<Memo>
    openEdit: (id: MemoId) => Promise<void>
    fold: (id: MemoId) => Promise<void>
    closeFromStack: (id: MemoId) => Promise<void>
    openPreview: (payload: MemoOpenPreviewPayload) => Promise<void>
    closePreview: () => Promise<void>
    schedulePreviewHide: (delayMs?: number) => Promise<void>
    cancelScheduledPreviewHide: () => Promise<void>
    setPinned: (payload: { id: MemoId; pinned: boolean }) => Promise<void>
  }
  clipboard: {
    getHistory: () => Promise<ClipboardItem[]>
    insert: (payload: ClipboardInsertPayload) => Promise<void>
    writeSystem: (text: string, opts?: { skipHistory?: boolean }) => Promise<void>
    hasEditInsertTarget: () => Promise<boolean>
    getImagePreview: (id: number) => Promise<{ dataUrl: string } | null>
    writeSystemImage: (id: number) => Promise<void>
  }
  settings: {
    get: () => Promise<Settings>
    update: (patch: SettingsUpdatePatch) => Promise<Settings>
  }
  app: {
    exportMemos: () => Promise<void>
    importMemos: () => Promise<void>
    clearAllData: () => Promise<void>
    getState: () => Promise<AppState>
    /** 폴디드 바만 숨김 (앱은 트레이에 유지) */
    hideFoldedPanel: () => Promise<void>
    /** 메모 히스토리 창 (전체보기) */
    openHistory: () => Promise<void>
    /** 폴디드 `.folded-root` 픽셀 높이 — 창 클라이언트 높이 맞춤 */
    setFoldedPanelContentHeight: (heightPx: number) => Promise<void>
  }
  /** Main → Renderer 이벤트 구독 (unsubscribe 반환) */
  on: {
    memoUpdated: (cb: (memo: Memo) => void) => () => void
    memoDeleted: (cb: (id: MemoId) => void) => () => void
    stackChanged: (cb: (ids: MemoId[]) => void) => () => void
    clipboardItemAdded: (cb: (item: ClipboardItem) => void) => () => void
    settingsChanged: (cb: (settings: Settings) => void) => () => void
    /** 메모 전체 삭제 등 — 목록 갱신 */
    memosDataReset: (cb: () => void) => () => void
    /** 편집 창에서만 사용 (클립보드 삽입 IPC) */
    clipboardPasteText: (cb: (text: string) => void) => () => void
  }
}
