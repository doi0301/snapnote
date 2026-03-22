import type { Database } from 'sql.js'

export type SqlRow = Record<string, string | number | Uint8Array | null | bigint>

/** SELECT 한 행 (없으면 null). sql.js prepare/bind/step */
export function selectOne(db: Database, sql: string, params: unknown[] = []): SqlRow | null {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  try {
    if (!stmt.step()) return null
    return stmt.getAsObject() as SqlRow
  } finally {
    stmt.free()
  }
}

/** SELECT 여러 행 */
export function selectAll(db: Database, sql: string, params: unknown[] = []): SqlRow[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: SqlRow[] = []
  try {
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as SqlRow)
    }
    return rows
  } finally {
    stmt.free()
  }
}

export function run(db: Database, sql: string, params: unknown[] = []): void {
  db.run(sql, params)
}
