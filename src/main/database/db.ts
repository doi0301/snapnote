import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
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
 * userData/snapnote.db 열기 + 스키마 적용.
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

  let fileBuffer: Buffer | undefined
  if (existsSync(dbFilePath)) {
    fileBuffer = readFileSync(dbFilePath)
  }

  db = fileBuffer ? new SQL.Database(new Uint8Array(fileBuffer)) : new SQL.Database()

  db.run('PRAGMA foreign_keys = ON')

  applySchema(db)
  persistDatabase()

  if (is.dev) {
    console.log('[SnapNote] SQLite (sql.js):', dbFilePath)
  }

  return db
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
