import { randomUUID } from 'node:crypto'
import type { Database } from 'sql.js'
import type { EditorLine, Memo, MemoId, MemoUpdatePatch } from '@shared/types'
import { run, selectAll, selectOne, type SqlRow } from './sqlRun'

const COLOR_ROTATION = ['coral', 'green', 'blue'] as const
const MAX_MEMOS = 50
/** 휴지통 보관 기간 (일) */
export const TRASH_RETENTION_DAYS = 7

function rowToMemo(row: SqlRow): Memo {
  const wx = row.window_x
  const wy = row.window_y
  const pa = row.pinned_at
  const da = row.deleted_at
  return {
    id: String(row.id),
    content: JSON.parse(String(row.content)) as EditorLine[],
    tags: JSON.parse(String(row.tags)) as string[],
    categoryId: row.category_id === null || row.category_id === undefined ? null : String(row.category_id),
    color: String(row.color),
    isPinned: Number(row.is_pinned) === 1,
    pinnedAt: pa === null || pa === undefined ? null : Number(pa),
    windowX: wx === null || wx === undefined ? null : Number(wx),
    windowY: wy === null || wy === undefined ? null : Number(wy),
    windowWidth: Number(row.window_width),
    windowHeight: Number(row.window_height),
    isDone: Number(row.is_done ?? 0) === 1,
    isFavorite: Number(row.is_favorite ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: da === null || da === undefined ? null : String(da)
  }
}

export class MemoRepository {
  constructor(
    private readonly getDb: () => Database,
    private readonly persistFn: () => void
  ) {}

  private persist(): void {
    this.persistFn()
  }

  /** 51번째 생성 시 가장 오래된 활성 메모( updated_at 기준 ) 삭제 */
  private enforceMemoLimit(): void {
    const db = this.getDb()
    const row = selectOne(db, 'SELECT COUNT(*) AS c FROM memos WHERE deleted_at IS NULL', [])
    const count = row ? Number(row.c) : 0
    if (count >= MAX_MEMOS) {
      run(
        db,
        `DELETE FROM memos WHERE id = (
          SELECT id FROM memos WHERE deleted_at IS NULL ORDER BY updated_at ASC LIMIT 1
        )`
      )
    }
  }

  createMemo(): Memo {
    this.enforceMemoLimit()
    const db = this.getDb()
    const row = selectOne(db, 'SELECT COUNT(*) AS c FROM memos WHERE deleted_at IS NULL', [])
    const n = row ? Number(row.c) : 0
    const color = COLOR_ROTATION[n % COLOR_ROTATION.length]
    const id = randomUUID()
    const now = new Date().toISOString()
    const emptyContent: EditorLine[] = []
    const st = selectOne(db, 'SELECT default_window_width, default_window_height FROM settings WHERE id = ?', [
      'singleton'
    ])
    const defW = st ? Number(st.default_window_width) : 400
    const defH = st ? Number(st.default_window_height) : 500
    const ww = Number.isFinite(defW) && defW >= 300 ? defW : 400
    const wh = Number.isFinite(defH) && defH >= 350 ? defH : 500
    run(
      db,
      `INSERT INTO memos (
        id, content, tags, category_id, color, is_pinned, pinned_at,
        window_x, window_y, window_width, window_height,
        is_done, is_favorite,
        created_at, updated_at,
        deleted_at
      ) VALUES (?, ?, ?, NULL, ?, 0, NULL, NULL, NULL, ?, ?, 0, 0, ?, ?, NULL)`,
      [id, JSON.stringify(emptyContent), JSON.stringify([]), color, ww, wh, now, now]
    )
    this.persist()
    return this.getMemo(id)!
  }

  getMemo(id: MemoId): Memo | null {
    const row = selectOne(this.getDb(), 'SELECT * FROM memos WHERE id = ?', [id])
    return row ? rowToMemo(row) : null
  }

  /** 활성 메모만 (deleted_at IS NULL) — 히스토리 목록용 */
  getAllMemos(): Memo[] {
    const rows = selectAll(
      this.getDb(),
      'SELECT * FROM memos WHERE deleted_at IS NULL ORDER BY updated_at DESC, created_at DESC, id DESC'
    )
    return rows.map(rowToMemo)
  }

  /** 휴지통 메모 (deleted_at IS NOT NULL), 이동 시각 최신순 */
  getTrashMemos(): Memo[] {
    const rows = selectAll(
      this.getDb(),
      'SELECT * FROM memos WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
    )
    return rows.map(rowToMemo)
  }

  /**
   * 창 이동/리사이즈 저장 전용 업데이트.
   * 히스토리 정렬 안정성을 위해 `updatedAt`은 유지한다.
   */
  updateMemoWindowBounds(
    id: MemoId,
    patch: { windowX: number | null; windowY: number | null; windowWidth: number; windowHeight: number }
  ): Memo {
    const existing = this.getMemo(id)
    if (!existing) {
      throw new Error(`Memo not found: ${id}`)
    }
    const next: Memo = {
      ...existing,
      windowX: patch.windowX,
      windowY: patch.windowY,
      windowWidth: patch.windowWidth,
      windowHeight: patch.windowHeight
    }
    run(
      this.getDb(),
      `UPDATE memos SET
        window_x = ?, window_y = ?, window_width = ?, window_height = ?
      WHERE id = ?`,
      [next.windowX, next.windowY, next.windowWidth, next.windowHeight, id]
    )
    this.persist()
    return this.getMemo(id)!
  }

  updateMemo(id: MemoId, patch: MemoUpdatePatch): Memo {
    const existing = this.getMemo(id)
    if (!existing) {
      throw new Error(`Memo not found: ${id}`)
    }
    if (existing.deletedAt !== null) {
      throw new Error(`Cannot update a trashed memo: ${id}`)
    }
    const nextIsPinned = patch.isPinned ?? existing.isPinned
    let nextPinnedAt: number | null
    if (!nextIsPinned) {
      nextPinnedAt = null
    } else if (patch.pinnedAt !== undefined) {
      nextPinnedAt = patch.pinnedAt
    } else if (patch.isPinned === true && !existing.isPinned) {
      nextPinnedAt = Date.now()
    } else {
      nextPinnedAt = existing.pinnedAt
    }

    const next: Memo = {
      ...existing,
      ...patch,
      content: patch.content ?? existing.content,
      tags: patch.tags ?? existing.tags,
      categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
      color: patch.color ?? existing.color,
      isPinned: nextIsPinned,
      pinnedAt: nextPinnedAt,
      windowX: patch.windowX !== undefined ? patch.windowX : existing.windowX,
      windowY: patch.windowY !== undefined ? patch.windowY : existing.windowY,
      windowWidth: patch.windowWidth ?? existing.windowWidth,
      windowHeight: patch.windowHeight ?? existing.windowHeight,
      isDone: patch.isDone ?? existing.isDone,
      isFavorite: patch.isFavorite ?? existing.isFavorite,
      updatedAt: new Date().toISOString()
    }
    run(
      this.getDb(),
      `UPDATE memos SET
        content = ?, tags = ?, category_id = ?, color = ?, is_pinned = ?, pinned_at = ?,
        window_x = ?, window_y = ?, window_width = ?, window_height = ?,
        is_done = ?, is_favorite = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        JSON.stringify(next.content),
        JSON.stringify(next.tags),
        next.categoryId,
        next.color,
        next.isPinned ? 1 : 0,
        next.pinnedAt,
        next.windowX,
        next.windowY,
        next.windowWidth,
        next.windowHeight,
        next.isDone ? 1 : 0,
        next.isFavorite ? 1 : 0,
        next.updatedAt,
        id
      ]
    )
    this.persist()
    return this.getMemo(id)!
  }

  /** 히스토리 삭제 → 휴지통 이동 */
  softDeleteMemo(id: MemoId): void {
    run(this.getDb(), 'UPDATE memos SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), id])
    this.persist()
  }

  /** 휴지통에서 복원 */
  restoreMemo(id: MemoId): void {
    run(this.getDb(), 'UPDATE memos SET deleted_at = NULL WHERE id = ?', [id])
    this.persist()
  }

  /** 물리 삭제 — 빈 메모 자동 제거 및 휴지통 영구 삭제 전용 */
  deleteMemo(id: MemoId): void {
    run(this.getDb(), 'DELETE FROM memos WHERE id = ?', [id])
    this.persist()
  }

  /**
   * 보관 기간이 지난 휴지통 메모 영구 삭제.
   * @param beforeIso 이 시각보다 이전에 삭제된 것 모두 제거 (ISO 8601)
   */
  purgeTrashExpired(beforeIso: string): void {
    run(
      this.getDb(),
      'DELETE FROM memos WHERE deleted_at IS NOT NULL AND deleted_at < ?',
      [beforeIso]
    )
    this.persist()
  }

  /** 설정「모든 데이터 삭제」— 메모 전부 제거 */
  deleteAllMemos(): void {
    run(this.getDb(), 'DELETE FROM memos', [])
    this.persist()
  }

  /** Import: 동일 id 있으면 false. TRD 병합 규칙(중복 id 스킵) */
  importMemo(m: Memo): boolean {
    if (this.getMemo(m.id)) return false
    this.enforceMemoLimit()
    run(
      this.getDb(),
      `INSERT INTO memos (
        id, content, tags, category_id, color, is_pinned, pinned_at,
        window_x, window_y, window_width, window_height,
        is_done, is_favorite,
        created_at, updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        JSON.stringify(m.content),
        JSON.stringify(m.tags),
        m.categoryId ?? null,
        m.color,
        m.isPinned ? 1 : 0,
        m.pinnedAt ?? null,
        m.windowX,
        m.windowY,
        m.windowWidth,
        m.windowHeight,
        m.isDone ? 1 : 0,
        m.isFavorite ? 1 : 0,
        m.createdAt,
        m.updatedAt,
        m.deletedAt ?? null
      ]
    )
    this.persist()
    return true
  }
}
