import { createRequire } from 'node:module'
import { dirname, join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Database } from 'sql.js'
import initSqlJs from 'sql.js'
import { applySchema } from '../database/schema'
import { MemoRepository, TRASH_RETENTION_DAYS } from './MemoRepository'

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

describe('MemoRepository – trash', () => {
  let db: Database
  let repo: MemoRepository

  beforeAll(async () => {
    const SQL = await initSqlJs({ locateFile: (f) => join(sqlJsWasmDir(), f) })
    db = new SQL.Database()
    applySchema(db)
    repo = new MemoRepository(() => db, () => {})
  })

  it('softDelete moves memo to trash and removes from active list', () => {
    const m = repo.createMemo()
    expect(repo.getAllMemos().some((x) => x.id === m.id)).toBe(true)

    repo.softDeleteMemo(m.id)

    const active = repo.getAllMemos()
    expect(active.some((x) => x.id === m.id)).toBe(false)

    const trash = repo.getTrashMemos()
    expect(trash.some((x) => x.id === m.id)).toBe(true)
    expect(trash.find((x) => x.id === m.id)!.deletedAt).not.toBeNull()
  })

  it('restoreMemo moves memo back to active list', () => {
    const m = repo.createMemo()
    repo.softDeleteMemo(m.id)
    expect(repo.getAllMemos().some((x) => x.id === m.id)).toBe(false)

    repo.restoreMemo(m.id)

    expect(repo.getAllMemos().some((x) => x.id === m.id)).toBe(true)
    expect(repo.getMemo(m.id)!.deletedAt).toBeNull()
    expect(repo.getTrashMemos().some((x) => x.id === m.id)).toBe(false)
  })

  it('purgeTrashExpired removes only expired memos', () => {
    const m1 = repo.createMemo()
    const m2 = repo.createMemo()
    repo.softDeleteMemo(m1.id)
    repo.softDeleteMemo(m2.id)

    // m1을 이미 만료된 것처럼 직접 업데이트
    const pastIso = new Date(Date.now() - (TRASH_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString()
    db.run('UPDATE memos SET deleted_at = ? WHERE id = ?', [pastIso, m1.id])

    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    repo.purgeTrashExpired(cutoff)

    expect(repo.getMemo(m1.id)).toBeNull()
    expect(repo.getMemo(m2.id)).not.toBeNull()
  })

  it('enforceMemoLimit counts only active memos', async () => {
    const SQL = await initSqlJs({ locateFile: (f) => join(sqlJsWasmDir(), f) })
    const d = new SQL.Database()
    applySchema(d)
    const r = new MemoRepository(() => d, () => {})

    for (let i = 0; i < 49; i++) r.createMemo()
    const toTrash = r.createMemo()
    r.softDeleteMemo(toTrash.id)

    // 활성은 49개이므로 생성 2번은 모두 허용되어야 함
    const a = r.createMemo()
    const b = r.createMemo()
    expect(r.getMemo(a.id)).not.toBeNull()
    expect(r.getMemo(b.id)).not.toBeNull()
    expect(r.getAllMemos().length).toBe(50)
  })

  it('updateMemo throws when memo is in trash', () => {
    const m = repo.createMemo()
    repo.softDeleteMemo(m.id)
    expect(() => repo.updateMemo(m.id, { isDone: true })).toThrow()
  })

  it('deletedAt is null on newly created memos', () => {
    const m = repo.createMemo()
    expect(m.deletedAt).toBeNull()
  })
})
