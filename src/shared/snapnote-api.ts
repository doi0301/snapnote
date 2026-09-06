/**
 * Preload에서 노출하는 Renderer용 API 계약 (타입 단일화)
 */
import type {
  AppState,
  Category,
  CategoryCreatePayload,
  CategoryUpdatePatch,
  ClipboardInsertPayload,
  ClipboardItem,
  Memo,
  MemoId,
  MemoOpenPreviewPayload,
  MemoUpdatePatch,
  Settings,
  SettingsUpdatePatch,
  UpdateEventPayload
} from './types'
import type { SnapnoteClipboardPayload } from './snapnoteClipboard'

export type ExportMemosAsFilePayload = { ids: MemoId[] }
export type ExportMemosAsFileResult = { ok: boolean; reason?: string }
export type MemoLinkPickerResult = { action: 'link'; memoId: MemoId } | { action: 'clear' } | null
export type MemoLinkPickerPayload = { currentMemoId: MemoId; anchor?: { x: number; y: number } }

/** `app.checkForUpdates()` 응답 */
export type UpdateCheckResult =
  | { ok: false; reason?: string; error?: string }
  | { ok: true; available: false }
  | { ok: true; available: true; version: string }

export interface SnapnotePreloadAPI {
  memo: {
    create: () => Promise<Memo>
    update: (payload: { id: MemoId; patch: MemoUpdatePatch }) => Promise<Memo>
    delete: (id: MemoId) => Promise<void>
    moveToTrash: (id: MemoId) => Promise<void>
    getAll: () => Promise<Memo[]>
    getTrash: () => Promise<Memo[]>
    restore: (id: MemoId) => Promise<void>
    deletePermanent: (id: MemoId) => Promise<void>
    get: (id: MemoId) => Promise<Memo>
    openEdit: (id: MemoId) => Promise<void>
    closeEditWindow: (id: MemoId) => Promise<void>
    /** 링크 선택 메뉴(OS 네이티브) 표시 */
    pickLinkTarget: (payload: MemoLinkPickerPayload) => Promise<MemoLinkPickerResult>
    /** 상단 접기: 편집 창을 작업표시줄로 최소화 */
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
    writeSnapnote: (
      payload: SnapnoteClipboardPayload,
      plainText: string,
      opts?: { skipHistory?: boolean }
    ) => Promise<void>
    readSnapnote: () => Promise<SnapnoteClipboardPayload | null>
  }
  settings: {
    get: () => Promise<Settings>
    update: (patch: SettingsUpdatePatch) => Promise<Settings>
  }
  category: {
    list: () => Promise<Category[]>
    create: (payload: CategoryCreatePayload) => Promise<Category[]>
    update: (payload: { id: string; patch: CategoryUpdatePatch }) => Promise<Category[]>
    delete: (id: string) => Promise<Category[]>
  }
  app: {
    exportMemos: () => Promise<void>
    exportMemosAsFile: (payload: ExportMemosAsFilePayload) => Promise<ExportMemosAsFileResult>
    importMemos: () => Promise<void>
    clearAllData: () => Promise<void>
    getState: () => Promise<AppState>
    /** 폴디드 바만 숨김 (앱은 트레이에 유지) */
    hideFoldedPanel: () => Promise<void>
    /** 메모 히스토리 창 (전체보기) */
    openHistory: () => Promise<void>
    /** 현재 열린 편집 창 목록 (memoId + 제목) */
    listOpenEditWindows: () => Promise<Array<{ memoId: MemoId; title: string }>>
    /** 폴디드 `.folded-root` 픽셀 높이 — 창 클라이언트 높이 맞춤 */
    setFoldedPanelContentHeight: (heightPx: number) => Promise<void>
    /** frameless 편집 창: 상단 드래그 스트립에서만 호출 — IPC로 창 위치 이동 */
    moveEditWindowByDelta: (dx: number, dy: number) => void
    /** 상단 스트립 드래그 종료 시 스냅·좌표 저장 */
    notifyEditWindowDragEnd: () => void
    getVersion: () => Promise<string>
    checkForUpdates: () => Promise<UpdateCheckResult>
    downloadUpdate: () => Promise<{ ok: boolean; reason?: string; error?: string }>
    quitAndInstall: () => Promise<{ ok: boolean }>
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
    /** 카테고리 목록 추가·수정·삭제 — 모든 창 동기화 */
    categoryChanged: (cb: (categories: Category[]) => void) => () => void
    /** 편집 창에서만 사용 (클립보드 삽입 IPC) */
    clipboardPasteText: (cb: (text: string) => void) => () => void
    /** 자동 업데이트 진행 (설정 창 등) */
    updateEvent: (cb: (payload: UpdateEventPayload) => void) => () => void
    /** 편집 창에서만 사용 — 최소화됐던 창이 다시 보일 때 (스크롤 리셋용) */
    editWindowRestored: (cb: () => void) => () => void
  }
}
