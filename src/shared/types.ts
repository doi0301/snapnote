/**
 * SnapNote 공유 타입 (SRD DR-01~03, TRD §3.2 정합)
 */

export type MemoId = string

/** 인라인 서식 구간 */
export interface TextSpan {
  start: number
  end: number
  bold?: boolean
  strikethrough?: boolean
  highlight?: HighlightColor
}

export type HighlightColor = 'yellow' | 'green' | 'pink'

export interface LineFormatting {
  bold?: boolean
  strikethrough?: boolean
  highlight?: HighlightColor | null
  hasCheckbox?: boolean
  checkboxChecked?: boolean
}

/** 에디터 한 줄 */
export interface EditorLine {
  id: string
  text: string
  indentLevel: number
  formatting: LineFormatting
  spans?: TextSpan[]
}

/** 메모 슬롯 색상 키 (DB·UI에서 확장 가능) */
export type MemoColorKey = 'coral' | 'green' | 'blue' | string

export interface Memo {
  id: MemoId
  content: EditorLine[]
  tags: string[]
  color: MemoColorKey
  isPinned: boolean
  /** 상단 고정한 시각(ms). 고정 해제 시 null. 최근 고정이 더 큰 값 */
  pinnedAt: number | null
  windowX: number | null
  windowY: number | null
  windowWidth: number
  windowHeight: number
  createdAt: string
  updatedAt: string
}

/** memo:update 시 부분 갱신 */
export type MemoUpdatePatch = Partial<
  Pick<
    Memo,
    | 'content'
    | 'tags'
    | 'color'
    | 'isPinned'
    | 'pinnedAt'
    | 'windowX'
    | 'windowY'
    | 'windowWidth'
    | 'windowHeight'
  >
>

export interface Settings {
  launchOnStartup: boolean
  clipboardMonitoring: boolean
  /** 클립보드 모니터링 최초 안내 메시지 표시 여부 (1회만) */
  clipboardNoticeShown: boolean
  colorSlot1: string
  colorSlot2: string
  colorSlot3: string
  defaultWindowWidth: number
  defaultWindowHeight: number
  globalShortcut: string
}

export type SettingsUpdatePatch = Partial<Settings>

/** app_state 테이블 (단일 행) */
export interface AppState {
  foldedStack: MemoId[]
  foldedPanelX: number
  foldedPanelY: number
}

export type ClipboardItemKind = 'text' | 'image'

export interface ClipboardItem {
  id: number
  /** DB 마이그레이션 전 데이터는 렌더러에서 `?? 'text'` 처리 */
  kind: ClipboardItemKind
  /** 텸스트 본문 또는 이미지 항목의 표시 제목(파일명·설명 등) */
  text: string
  capturedAt: string
  /** `userData/clipboard-images/` 아래 PNG 파일명 (`kind === 'image'`) */
  imagePath?: string | null
}

export interface ClipboardInsertPayload {
  text: string
  /** 없으면 메인에서 마지막 포커스 편집 창 기준 (S5-04) */
  targetMemoId?: MemoId | null
}

/** 폴디드 MemoSlot `getBoundingClientRect()` (콘텐츠 뷰포트 기준 DIP) */
export interface FoldedPreviewAnchor {
  left: number
  top: number
  width: number
  height: number
}

export interface MemoOpenPreviewPayload {
  id: MemoId
  anchor?: FoldedPreviewAnchor
}
