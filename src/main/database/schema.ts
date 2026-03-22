import type { Database } from 'sql.js'
import { selectAll, selectOne, run } from '../repositories/sqlRun'

/** 스키마 버전 (PRAGMA user_version) */
export const SCHEMA_VERSION = 4

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
  global_shortcut TEXT NOT NULL DEFAULT 'CommandOrControl+Shift+M',
  clipboard_notice_shown INTEGER NOT NULL DEFAULT 0
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

/** 테이블 생성 */
export function applySchema(db: Database): void {
  db.run(CREATE_MEMOS)
  db.run(CREATE_APP_STATE)
  db.run(CREATE_SETTINGS)
  db.run(CREATE_CLIPBOARD_HISTORY)

  migrateMemosPinnedAt(db)
  migrateSettingsClipboardNotice(db)
  migrateClipboardHistoryImageColumns(db)

  db.run(
    `INSERT OR IGNORE INTO app_state (id, folded_stack, folded_panel_x, folded_panel_y)
     VALUES ('singleton', '[]', 100, 100)`
  )

  db.run(
    `INSERT OR IGNORE INTO settings (
      id, launch_on_startup, clipboard_monitoring,
      color_slot_1, color_slot_2, color_slot_3,
      default_window_width, default_window_height, global_shortcut,
      clipboard_notice_shown
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'singleton',
      0,
      1,
      DEFAULT_COLOR_SLOT_1,
      DEFAULT_COLOR_SLOT_2,
      DEFAULT_COLOR_SLOT_3,
      400,
      500,
      'CommandOrControl+Shift+M',
      0
    ]
  )

  const v = Number(selectOne(db, 'PRAGMA user_version', [])?.user_version ?? 0)
  if (v < SCHEMA_VERSION) {
    run(db, `PRAGMA user_version = ${SCHEMA_VERSION}`)
  }
}
