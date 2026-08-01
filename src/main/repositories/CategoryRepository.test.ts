import { createRequire } from 'node:module'
import { dirname, join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Database } from 'sql.js'
import initSqlJs from 'sql.js'
import { applySchema } from '../database/schema'
import { CategoryRepository } from './CategoryRepository'
import { MemoRepository } from './MemoRepository'

const require = createRequire(import.meta.url)

function sqlJsWasmDir(): string {
  return dirname(require.resolve('sql.js'))
}

describe('CategoryRepository', () => {
  let db: Database
  let repo: CategoryRepository
  let memos: MemoRepository

  beforeAll(async () => {
    const SQL = await initSqlJs({
      locateFile: (f) => join(sqlJsWasmDir(), f)
    })
    db = new SQL.Database()
    applySchema(db)
    repo = new CategoryRepository(() => db, () => {})
    memos = new MemoRepository(() => db, () => {})
  })

  it('creates categories with incrementing sort order', () => {
    const a = repo.createCategory({ name: '업무' })
    const b = repo.createCategory({ name: '개인' })
    expect(a.sortOrder).toBe(0)
    expect(b.sortOrder).toBe(1)
    expect(repo.listCategories().map((c) => c.name)).toEqual(['업무', '개인'])
  })

  it('renames a category', () => {
    const c = repo.createCategory({ name: '임시' })
    const updated = repo.updateCategory(c.id, { name: '수정됨' })
    expect(updated.name).toBe('수정됨')
  })

  it('deleting a category clears categoryId on memos that referenced it', () => {
    const c = repo.createCategory({ name: '삭제될 카테고리' })
    const m = memos.createMemo()
    memos.updateMemo(m.id, { categoryId: c.id })
    expect(memos.getMemo(m.id)!.categoryId).toBe(c.id)

    repo.deleteCategory(c.id)

    expect(repo.getCategory(c.id)).toBeNull()
    expect(memos.getMemo(m.id)!.categoryId).toBeNull()
  })

  it('new memos default to no category', () => {
    const m = memos.createMemo()
    expect(m.categoryId).toBeNull()
  })
})
