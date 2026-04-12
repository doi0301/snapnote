import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import type { Database } from 'sql.js'
import initSqlJs from 'sql.js'
import { is } from '@electron-toolkit/utils'
import { applySchema } from './schema'

const require = createRequire(import.meta.url)

let db: Database | null = null
let dbFilePath: string | null = null

/** sql.js package.json exports에 package.json 경로가 없어 resolve 불가 → main 엔트리(dist) 기준 */
function resolveSqlJsWasmDir(): string {
  const entry = require.resolve('sql.js')
  return dirname(entry)
}

/**
 * 메모리 DB 내용을 userData/snapnote.db 로 저장 (sql.js는 파일 핸들 없이 export 사용)
 */
export function persistDatabase(): void {
  if (!db || !dbFilePath) return
  const data = db.export()
  writeFileSync(dbFilePath, Buffer.from(data))
}

/**
 * DB 파일이 존재하고 비어있지 않으면 `.bak` 으로 백업 복사.
 * 매 시작마다 1회만 실행되며, 이전 `.bak`을 덮어쓴다.
 */
function backupDatabaseFile(filePath: string): void {
  try {
    if (!existsSync(filePath)) return
    const stat = statSync(filePath)
    if (stat.size === 0) return
    copyFileSync(filePath, filePath + '.bak')
  } catch {
    console.warn('[SnapNote] DB 백업 실패 (무시)')
  }
}

/**
 * userData/snapnote.db 열기 + 스키마 적용.
 * DB 로딩 전 자동 백업하고, 손상 시 `.bak`에서 복구를 시도한다.
 * 반드시 `app.whenReady()` 이후 호출.
 */
export async function initDatabase(): Promise<Database> {
  if (db) {
    return db
  }

  const userData = app.getPath('userData')
  mkdirSync(userData, { recursive: true })
  dbFilePath = join(userData, 'snapnote.db')

  const wasmDir = resolveSqlJsWasmDir()
  const SQL = await initSqlJs({
    locateFile: (file) => join(wasmDir, file)
  })

  backupDatabaseFile(dbFilePath)

  db = tryLoadDatabase(SQL, dbFilePath)
  if (!db) {
    db = tryRestoreFromBackup(SQL, dbFilePath)
  }
  if (!db) {
    console.warn('[SnapNote] 새 DB로 시작합니다.')
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')

  applySchema(db)
  persistDatabase()

  if (is.dev) {
    console.log('[SnapNote] SQLite (sql.js):', dbFilePath)
  }

  return db
}

function tryLoadDatabase(
  SQL: Awaited<ReturnType<typeof initSqlJs>>,
  filePath: string
): Database | null {
  try {
    if (!existsSync(filePath)) return null
    const buf = readFileSync(filePath)
    if (buf.length === 0) return null
    const loaded = new SQL.Database(new Uint8Array(buf))
    loaded.exec('SELECT count(*) FROM sqlite_master')
    return loaded
  } catch (err) {
    console.error('[SnapNote] DB 로딩 실패:', err)
    return null
  }
}

function tryRestoreFromBackup(
  SQL: Awaited<ReturnType<typeof initSqlJs>>,
  filePath: string
): Database | null {
  const bakPath = filePath + '.bak'
  try {
    if (!existsSync(bakPath)) return null
    const buf = readFileSync(bakPath)
    if (buf.length === 0) return null
    const loaded = new SQL.Database(new Uint8Array(buf))
    loaded.exec('SELECT count(*) FROM sqlite_master')
    console.info('[SnapNote] 백업 DB에서 복구했습니다:', bakPath)
    return loaded
  } catch (err) {
    console.error('[SnapNote] 백업 DB도 손상:', err)
    return null
  }
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error(
      '[SnapNote] Database not initialized. Call initDatabase() after app.whenReady().'
    )
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    try {
      persistDatabase()
    } finally {
      db.close()
      db = null
      dbFilePath = null
    }
  }
}
