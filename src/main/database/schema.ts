import type { Database } from 'sql.js'
import { selectAll, selectOne, run } from '../repositories/sqlRun'
import type { EditorLine } from '@shared/types'
import { migrateSectionScopeToIndent } from '@shared/sectionScopeMigration'

/** 스키마 버전 (PRAGMA user_version) */
export const SCHEMA_VERSION = 11

/** TRD §3.1 + DESIGN_SYSTEM 슬롯 기본색 */
const DEFAULT_COLOR_SLOT_1 = '#F28B74'
const DEFAULT_COLOR_SLOT_2 = '#5BB47A'
const DEFAULT_COLOR_SLOT_3 = '#5B8FD4'

const CREATE_MEMOS = `
CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  color TEXT NOT NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  pinned_at INTEGER,
  window_x INTEGER,
  window_y INTEGER,
  window_width INTEGER NOT NULL DEFAULT 400,
  window_height INTEGER NOT NULL DEFAULT 500,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`

const CREATE_APP_STATE = `
CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  folded_stack TEXT NOT NULL DEFAULT '[]',
  folded_panel_x INTEGER NOT NULL DEFAULT 100,
  folded_panel_y INTEGER NOT NULL DEFAULT 100
);
`

const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  launch_on_startup INTEGER NOT NULL DEFAULT 0,
  clipboard_monitoring INTEGER NOT NULL DEFAULT 1,
  color_slot_1 TEXT NOT NULL,
  color_slot_2 TEXT NOT NULL,
  color_slot_3 TEXT NOT NULL,
  default_window_width INTEGER NOT NULL DEFAULT 400,
  default_window_height INTEGER NOT NULL DEFAULT 500,
  window_opacity REAL NOT NULL DEFAULT 1.0,
  global_shortcut TEXT NOT NULL DEFAULT 'CommandOrControl+Shift+M',
  clipboard_notice_shown INTEGER NOT NULL DEFAULT 0,
  auto_markdown_paste INTEGER NOT NULL DEFAULT 0
);
`

const CREATE_CATEGORIES = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`

const CREATE_CLIPBOARD_HISTORY = `
CREATE TABLE IF NOT EXISTS clipboard_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'text',
  text TEXT NOT NULL,
  image_path TEXT,
  captured_at TEXT NOT NULL
);
`

function migrateMemosPinnedAt(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 2) return

  const cols = selectAll(db, 'PRAGMA table_info(memos)', [])
  const hasPinnedAt = cols.some((c) => String(c.name) === 'pinned_at')
  if (!hasPinnedAt) {
    run(db, 'ALTER TABLE memos ADD COLUMN pinned_at INTEGER')
  }
  run(db, 'PRAGMA user_version = 2')
}

function migrateSettingsClipboardNotice(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 3) return

  const cols = selectAll(db, 'PRAGMA table_info(settings)', [])
  const has = cols.some((c) => String(c.name) === 'clipboard_notice_shown')
  if (!has) {
    run(db, 'ALTER TABLE settings ADD COLUMN clipboard_notice_shown INTEGER NOT NULL DEFAULT 0')
  }
  run(db, 'PRAGMA user_version = 3')
}

function migrateClipboardHistoryImageColumns(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 4) return

  const cols = selectAll(db, 'PRAGMA table_info(clipboard_history)', [])
  const names = new Set(cols.map((c) => String(c.name)))
  if (!names.has('kind')) {
    run(db, `ALTER TABLE clipboard_history ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'`)
  }
  if (!names.has('image_path')) {
    run(db, 'ALTER TABLE clipboard_history ADD COLUMN image_path TEXT')
  }
  run(db, 'PRAGMA user_version = 4')
}

function migrateSettingsWindowOpacity(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 5) return

  const cols = selectAll(db, 'PRAGMA table_info(settings)', [])
  const has = cols.some((c) => String(c.name) === 'window_opacity')
  if (!has) {
    run(db, 'ALTER TABLE settings ADD COLUMN window_opacity REAL NOT NULL DEFAULT 1.0')
  }
  run(db, 'PRAGMA user_version = 5')
}

function migrateMemosIsDone(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 6) return

  const cols = selectAll(db, 'PRAGMA table_info(memos)', [])
  const has = cols.some((c) => String(c.name) === 'is_done')
  if (!has) {
    run(db, 'ALTER TABLE memos ADD COLUMN is_done INTEGER NOT NULL DEFAULT 0')
  }
  run(db, 'PRAGMA user_version = 6')
}

function migrateMemosDeletedAt(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 7) return

  const cols = selectAll(db, 'PRAGMA table_info(memos)', [])
  const has = cols.some((c) => String(c.name) === 'deleted_at')
  if (!has) {
    run(db, 'ALTER TABLE memos ADD COLUMN deleted_at TEXT')
  }
  run(db, 'PRAGMA user_version = 7')
}

function migrateMemosIsFavorite(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 8) return

  const cols = selectAll(db, 'PRAGMA table_info(memos)', [])
  const has = cols.some((c) => String(c.name) === 'is_favorite')
  if (!has) {
    run(db, 'ALTER TABLE memos ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0')
  }
  run(db, 'PRAGMA user_version = 8')
}

function migrateMemosCategoryId(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 9) return

  const cols = selectAll(db, 'PRAGMA table_info(memos)', [])
  const has = cols.some((c) => String(c.name) === 'category_id')
  if (!has) {
    run(db, 'ALTER TABLE memos ADD COLUMN category_id TEXT')
  }
  run(db, 'PRAGMA user_version = 9')
}

/** 셀(칸) 입력 모델 전환 — 붙여넣기 시 마크다운 자동 서식 변환을 기본 끔으로,
 *  원하는 사용자는 설정에서 다시 켤 수 있게 남겨둔다 */
function migrateSettingsAutoMarkdownPaste(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 10) return

  const cols = selectAll(db, 'PRAGMA table_info(settings)', [])
  const has = cols.some((c) => String(c.name) === 'auto_markdown_paste')
  if (!has) {
    run(db, 'ALTER TABLE settings ADD COLUMN auto_markdown_paste INTEGER NOT NULL DEFAULT 0')
  }
  run(db, 'PRAGMA user_version = 10')
}

/**
 * 섹션 소속 규칙이 "다음 타이틀 전까지"에서 들여쓰기 기반으로 바뀌면서(v1.0.18) 필요해진
 * 본문 들여쓰기 변환. 구버전 문서와 "섹션을 의도적으로 빠져나온 줄"은 내용만으로 구분되지
 * 않으므로 로드할 때마다 돌리면 안 된다 — 저장된 문서를 딱 한 번 훑어 변환한다.
 * 내용이 깨진 메모는 건너뛴다 (마이그레이션 하나가 전체 실행을 막지 않게).
 */
function migrateMemoContentSectionIndent(db: Database): void {
  const verRow = selectOne(db, 'PRAGMA user_version', [])
  const ver = verRow ? Number(verRow.user_version) : 0
  if (ver >= 11) return

  const rows = selectAll(db, 'SELECT id, content FROM memos', [])
  for (const row of rows) {
    let before: EditorLine[]
    try {
      before = JSON.parse(String(row.content)) as EditorLine[]
    } catch {
      continue
    }
    if (!Array.isArray(before)) continue
    const after = migrateSectionScopeToIndent(before)
    const changed = after.some((l, i) => l.indentLevel !== before[i]?.indentLevel)
    if (!changed) continue
    run(db, 'UPDATE memos SET content = ? WHERE id = ?', [JSON.stringify(after), String(row.id)])
  }
  run(db, 'PRAGMA user_version = 11')
}

/** 테이블 생성 */
export function applySchema(db: Database): void {
  db.run(CREATE_MEMOS)
  db.run(CREATE_APP_STATE)
  db.run(CREATE_SETTINGS)
  db.run(CREATE_CATEGORIES)
  db.run(CREATE_CLIPBOARD_HISTORY)

  migrateMemosPinnedAt(db)
  migrateSettingsClipboardNotice(db)
  migrateClipboardHistoryImageColumns(db)
  migrateSettingsWindowOpacity(db)
  migrateMemosIsDone(db)
  migrateMemosDeletedAt(db)
  migrateMemosIsFavorite(db)
  migrateMemosCategoryId(db)
  migrateSettingsAutoMarkdownPaste(db)
  migrateMemoContentSectionIndent(db)

  db.run(
    `INSERT OR IGNORE INTO app_state (id, folded_stack, folded_panel_x, folded_panel_y)
     VALUES ('singleton', '[]', 100, 100)`
  )

  db.run(
    `INSERT OR IGNORE INTO settings (
      id, launch_on_startup, clipboard_monitoring,
      color_slot_1, color_slot_2, color_slot_3,
      default_window_width, default_window_height, window_opacity, global_shortcut,
      clipboard_notice_shown, auto_markdown_paste
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'singleton',
      0,
      1,
      DEFAULT_COLOR_SLOT_1,
      DEFAULT_COLOR_SLOT_2,
      DEFAULT_COLOR_SLOT_3,
      400,
      500,
      1.0,
      'CommandOrControl+Shift+M',
      0,
      0
    ]
  )

  const v = Number(selectOne(db, 'PRAGMA user_version', [])?.user_version ?? 0)
  if (v < SCHEMA_VERSION) {
    run(db, `PRAGMA user_version = ${SCHEMA_VERSION}`)
  }
}
