/**
 * SnapNote 공유 타입 (SRD DR-01~03, TRD §3.2 정합)
 */

export type MemoId = string

export type HighlightColor = 'yellow' | 'green' | 'pink' | 'gray' | 'blue' | 'orange' | 'purple'

/** 거터 단축키 강조 바 (자동 계층 없음) */
export type AccentBarKind = 'blue' | 'teal' | 'orange'

/** 인라인 서식 구간 */
export interface TextSpan {
  start: number
  end: number
  bold?: boolean
  strikethrough?: boolean
  underline?: boolean
  highlight?: HighlightColor
  /** 검정 네모 숫자 아이콘 (0–9) */
  keycap?: boolean
  /** 연결된 메모 UUID — 클릭 시 해당 편집 창 열기 */
  memoLinkId?: MemoId
}

export interface LineFormatting {
  bold?: boolean
  strikethrough?: boolean
  highlight?: HighlightColor | null
  hasCheckbox?: boolean
  checkboxChecked?: boolean
  hasDivider?: boolean
  /** Ctrl+1~6 위계 (H4 `- ` · H5 `▸ ` · H6 `▫ `) */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
  /** 단축키로 줄마다 설정하는 왼쪽 강조 바 */
  accentBar?: AccentBarKind | null
  /** accent bar 줄 본문 접기 (기본 펼침) */
  lineCollapsed?: boolean
  /** 섹션 컬러바 타이틀 (텍스트 유형 최상위, Ctrl+`) */
  sectionTitle?: boolean
  /** 섹션 타이틀 아래 줄들 접기 (다음 섹션 전까지) */
  sectionCollapsed?: boolean
  /** 이 줄 전체가 표 셀 편집 모드일 때 */
  isTable?: boolean
  /** 행 × 열 (열 최대 5, 빈 문자열 허용) */
  tableRows?: string[][]
  /** 표시·편집할 열 수 (2~5, 내용보다 우선) */
  tableCols?: number
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
  /** 태그와 별개인 상위 분류. 미리 등록해둔 카테고리 목록에서 하나만 선택 (CategoryRepository) */
  categoryId: string | null
  color: MemoColorKey
  isPinned: boolean
  /** 상단 고정한 시각(ms). 고정 해제 시 null. 최근 고정이 더 큰 값 */
  pinnedAt: number | null
  windowX: number | null
  windowY: number | null
  windowWidth: number
  windowHeight: number
  /** 히스토리에서 완료 처리 시 시각적 강조 완화 */
  isDone: boolean
  /** 히스토리 목록에서 상단 고정 */
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  /** null = 활성, ISO 문자열 = 휴지통 이동 시각 */
  deletedAt: string | null
}

/** memo:update 시 부분 갱신 */
export type MemoUpdatePatch = Partial<
  Pick<
    Memo,
    | 'content'
    | 'tags'
    | 'categoryId'
    | 'color'
    | 'isPinned'
    | 'pinnedAt'
    | 'windowX'
    | 'windowY'
    | 'windowWidth'
    | 'windowHeight'
    | 'isDone'
    | 'isFavorite'
  >
>

/** 미리 등록해두는 상위 분류 목록 (자유 입력 태그와 별개) */
export interface Category {
  id: string
  name: string
  /** 미지정 시 목록에서 기본 색 순환 표시 */
  color: string | null
  sortOrder: number
  createdAt: string
}

export interface CategoryCreatePayload {
  name: string
  color?: string | null
}

export type CategoryUpdatePatch = Partial<Pick<Category, 'name' | 'color' | 'sortOrder'>>

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
  windowOpacity: number
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

/** Main → Renderer: 자동 업데이트 진행 (IPC `UPDATE_EVENT`) */
export type UpdateEventPayload =
  | { type: 'error'; message: string }
  | { type: 'download-progress'; percent: number }
  | { type: 'update-downloaded'; version: string }
  | { type: 'checking' }
