import { randomUUID } from 'node:crypto'
import type { Database } from 'sql.js'
import type { Category, CategoryCreatePayload, CategoryUpdatePatch } from '@shared/types'
import { run, selectAll, selectOne, type SqlRow } from './sqlRun'

function rowToCategory(row: SqlRow): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    color: row.color === null || row.color === undefined ? null : String(row.color),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at)
  }
}

export class CategoryRepository {
  constructor(
    private readonly getDb: () => Database,
    private readonly persistFn: () => void
  ) {}

  private persist(): void {
    this.persistFn()
  }

  listCategories(): Category[] {
    const rows = selectAll(
      this.getDb(),
      'SELECT * FROM categories ORDER BY sort_order ASC, created_at ASC'
    )
    return rows.map(rowToCategory)
  }

  createCategory(payload: CategoryCreatePayload): Category {
    const db = this.getDb()
    const name = payload.name.trim()
    if (!name) throw new Error('Category name is required')
    const row = selectOne(db, 'SELECT MAX(sort_order) AS m FROM categories', [])
    const nextOrder = row && row.m !== null && row.m !== undefined ? Number(row.m) + 1 : 0
    const id = randomUUID()
    const now = new Date().toISOString()
    run(
      db,
      'INSERT INTO categories (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, name, payload.color ?? null, nextOrder, now]
    )
    this.persist()
    return this.getCategory(id)!
  }

  getCategory(id: string): Category | null {
    const row = selectOne(this.getDb(), 'SELECT * FROM categories WHERE id = ?', [id])
    return row ? rowToCategory(row) : null
  }

  updateCategory(id: string, patch: CategoryUpdatePatch): Category {
    const existing = this.getCategory(id)
    if (!existing) throw new Error(`Category not found: ${id}`)
    const next: Category = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
      color: patch.color !== undefined ? patch.color : existing.color,
      sortOrder: patch.sortOrder !== undefined ? patch.sortOrder : existing.sortOrder
    }
    run(
      this.getDb(),
      'UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?',
      [next.name, next.color, next.sortOrder, id]
    )
    this.persist()
    return this.getCategory(id)!
  }

  /** 삭제 시 해당 카테고리를 참조하던 메모는 미지정(null)으로 되돌림 */
  deleteCategory(id: string): void {
    const db = this.getDb()
    run(db, 'UPDATE memos SET category_id = NULL WHERE category_id = ?', [id])
    run(db, 'DELETE FROM categories WHERE id = ?', [id])
    this.persist()
  }
}
