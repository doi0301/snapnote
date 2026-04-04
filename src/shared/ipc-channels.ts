/**
 * IPC 채널명 단일 출처 (TRD §2.3 + Folded/Preview 확장)
 */

export const IPC_CHANNELS = {
  /** Main → Renderer */
  MEMO_UPDATED: 'memo:updated',
  /** 메모 영구 삭제·빈 메모 폐기 후 목록 갱신용 */
  MEMO_DELETED: 'memo:deleted',
  STACK_CHANGED: 'stack:changed',
  CLIPBOARD_ITEM_ADDED: 'clipboard:item-added',
  SETTINGS_CHANGED: 'settings:changed',
  /** 메모 전체 삭제 등 — 목록 화면 갱신용 */
  MEMOS_DATA_RESET: 'memos:data-reset',

  /** Renderer → Main (invoke) */
  MEMO_CREATE: 'memo:create',
  MEMO_UPDATE: 'memo:update',
  MEMO_DELETE: 'memo:delete',
  MEMO_GET_ALL: 'memo:get-all',
  MEMO_GET: 'memo:get',
  MEMO_OPEN_EDIT: 'memo:open-edit',
  MEMO_FOLD: 'memo:fold',
  MEMO_CLOSE_FROM_STACK: 'memo:close-from-stack',
  /** 호버 프리뷰 (WindowManager, S2) */
  MEMO_OPEN_PREVIEW: 'memo:open-preview',
  MEMO_CLOSE_PREVIEW: 'memo:close-preview',
  /** 슬롯→프리뷰 이동용 짧은 지연 닫기 / 취소 */
  MEMO_PREVIEW_SCHEDULE_HIDE: 'memo:preview-schedule-hide',
  MEMO_PREVIEW_CANCEL_SCHEDULED_HIDE: 'memo:preview-cancel-scheduled-hide',
  /** 편집 창 항상 위 + DB is_pinned */
  MEMO_SET_PINNED: 'memo:set-pinned',

  CLIPBOARD_GET_HISTORY: 'clipboard:get-history',
  CLIPBOARD_INSERT: 'clipboard:insert',
  /** OS 클립보드에 텍스트만 기록 (히스토리 📋) */
  CLIPBOARD_WRITE_SYSTEM: 'clipboard:write-system',
  /** 마지막 포커스 편집 창이 있으면 삽입 가능 */
  CLIPBOARD_HAS_EDIT_TARGET: 'clipboard:has-edit-target',
  /** 히스토리 이미지 항목 미리보기 (data URL) */
  CLIPBOARD_GET_IMAGE_PREVIEW: 'clipboard:get-image-preview',
  /** OS 클립보드에 이미지 복사 (히스토리 📋) */
  CLIPBOARD_WRITE_SYSTEM_IMAGE: 'clipboard:write-system-image',

  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  APP_EXPORT_MEMOS: 'app:export-memos',
  /** 선택 메모를 Markdown 또는 CSV로 저장 */
  APP_EXPORT_MEMOS_AS_FILE: 'app:export-memos-as-file',
  APP_IMPORT_MEMOS: 'app:import-memos',
  APP_GET_VERSION: 'app:get-version',
  APP_UPDATER_CHECK: 'app:updater-check',
  APP_UPDATER_DOWNLOAD: 'app:updater-download',
  APP_UPDATER_QUIT_AND_INSTALL: 'app:updater-quit-and-install',
  /** Main → Renderer: 자동 업데이트 진행 상태 */
  UPDATE_EVENT: 'update:event',
  /** 모든 메모·클립보드 히스토리·폴디드 스택 초기화 (설정 유지) */
  APP_CLEAR_ALL_DATA: 'app:clear-all-data',

  /** 폴디드 스택·패널 위치 */
  APP_STATE_GET: 'app-state:get',
  /** 폴디드 패널 창 숨김 (트레이에서 다시 열기) */
  FOLDED_PANEL_HIDE: 'folded-panel:hide',
  /** 렌더러 측정 `.folded-root` 높이 → `setContentSize` (hug) */
  FOLDED_PANEL_SET_CONTENT_HEIGHT: 'folded-panel:set-content-height',
  /** 메모 히스토리 모달 */
  APP_OPEN_HISTORY: 'app:open-history',

  /** Renderer → Main (ipcRenderer.send): 편집 창 상단 스트립 드래그 — delta만큼 setPosition */
  EDIT_WINDOW_MOVE_DELTA: 'edit-window:move-delta',
  /** Renderer → Main (send): 상단 스트립 드래그 종료 — 가장자리 스냅 + 창 좌표 DB 반영 */
  EDIT_WINDOW_DRAG_END: 'edit-window:drag-end',

  /** Main → 편집 창: 클립보드 삽입 텍스트 (preload `on.clipboardPasteText`) */
  CLIPBOARD_PASTE_TEXT: 'clipboard:paste-text'
} as const

/** Main → Renderer 구독용 채널 */
export type IpcEventChannel =
  | typeof IPC_CHANNELS.MEMO_UPDATED
  | typeof IPC_CHANNELS.MEMO_DELETED
  | typeof IPC_CHANNELS.STACK_CHANGED
  | typeof IPC_CHANNELS.CLIPBOARD_ITEM_ADDED
  | typeof IPC_CHANNELS.SETTINGS_CHANGED
  | typeof IPC_CHANNELS.MEMOS_DATA_RESET
  | typeof IPC_CHANNELS.CLIPBOARD_PASTE_TEXT
  | typeof IPC_CHANNELS.UPDATE_EVENT

/** Renderer → Main invoke 채널 */
export type IpcInvokeChannel = Exclude<
  (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS],
  IpcEventChannel
>
