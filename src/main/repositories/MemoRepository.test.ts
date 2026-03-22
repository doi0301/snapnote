import { createRequire } from 'node:module'
import { dirname, join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Database } from 'sql.js'
import initSqlJs from 'sql.js'
import { applySchema } from '../database/schema'
import { MemoRepository } from './MemoRepository'

const require = createRequire(import.meta.url)

function sqlJsWasmDir(): string {
  return dirname(require.resolve('sql.js'))
}

describe('MemoRepository', () => {
  let db: Database
  let repo: MemoRepository

  beforeAll(async () => {
    const SQL = await initSqlJs({
      locateFile: (f) => join(sqlJsWasmDir(), f)
    })
    db = new SQL.Database()
    applySchema(db)
    repo = new MemoRepository(() => db, () => {})
  })

  it('creates memo with coral/green/blue rotation', () => {
    const a = repo.createMemo()
    const b = repo.createMemo()
    const c = repo.createMemo()
    expect(a.color).toBe('coral')
    expect(b.color).toBe('green')
    expect(c.color).toBe('blue')
  })

  it('enforces 50 memo limit by deleting oldest', async () => {
    const SQL = await initSqlJs({ locateFile: (f) => join(sqlJsWasmDir(), f) })
    const d = new SQL.Database()
    applySchema(d)
    const r = new MemoRepository(() => d, () => {})
    const ids: string[] = []
    for (let i = 0; i < 50; i++) {
      ids.push(r.createMemo().id)
    }
    expect(r.getAllMemos().length).toBe(50)
    const newest = r.createMemo()
    expect(r.getAllMemos().length).toBe(50)
    expect(r.getMemo(ids[0])).toBeNull()
    expect(r.getMemo(newest.id)).not.toBeNull()
  })
})
