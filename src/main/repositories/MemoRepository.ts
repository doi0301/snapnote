import { randomUUID } from 'node:crypto'
import type { Database } from 'sql.js'
import type { EditorLine, Memo, MemoId, MemoUpdatePatch } from '@shared/types'
import { run, selectAll, selectOne, type SqlRow } from './sqlRun'

const COLOR_ROTATION = ['coral', 'green', 'blue'] as const
const MAX_MEMOS = 50

function rowToMemo(row: SqlRow): Memo {
  const wx = row.window_x
  const wy = row.window_y
  const pa = row.pinned_at
  return {
    id: String(row.id),
    content: JSON.parse(String(row.content)) as EditorLine[],
    tags: JSON.parse(String(row.tags)) as string[],
    color: String(row.color),
    isPinned: Number(row.is_pinned) === 1,
    pinnedAt: pa === null || pa === undefined ? null : Number(pa),
    windowX: wx === null || wx === undefined ? null : Number(wx),
    windowY: wy === null || wy === undefined ? null : Number(wy),
    windowWidth: Number(row.window_width),
    windowHeight: Number(row.window_height),
    isDone: Number(row.is_done ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
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

  /** 51번째 생성 시 가장 오래된 메모( updated_at 기준 ) 삭제 */
  private enforceMemoLimit(): void {
    const db = this.getDb()
    const row = selectOne(db, 'SELECT COUNT(*) AS c FROM memos', [])
    const count = row ? Number(row.c) : 0
    if (count >= MAX_MEMOS) {
      run(
        db,
        `DELETE FROM memos WHERE id = (
          SELECT id FROM memos ORDER BY updated_at ASC LIMIT 1
        )`
      )
    }
  }

  createMemo(): Memo {
    this.enforceMemoLimit()
    const db = this.getDb()
    const row = selectOne(db, 'SELECT COUNT(*) AS c FROM memos', [])
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
        id, content, tags, color, is_pinned, pinned_at,
        window_x, window_y, window_width, window_height,
        is_done,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?, 0, ?, ?)`,
      [id, JSON.stringify(emptyContent), JSON.stringify([]), color, ww, wh, now, now]
    )
    this.persist()
    return this.getMemo(id)!
  }

  getMemo(id: MemoId): Memo | null {
    const row = selectOne(this.getDb(), 'SELECT * FROM memos WHERE id = ?', [id])
    return row ? rowToMemo(row) : null
  }

  getAllMemos(): Memo[] {
    const rows = selectAll(
      this.getDb(),
      'SELECT * FROM memos ORDER BY updated_at DESC, created_at DESC, id DESC'
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
      color: patch.color ?? existing.color,
      isPinned: nextIsPinned,
      pinnedAt: nextPinnedAt,
      windowX: patch.windowX !== undefined ? patch.windowX : existing.windowX,
      windowY: patch.windowY !== undefined ? patch.windowY : existing.windowY,
      windowWidth: patch.windowWidth ?? existing.windowWidth,
      windowHeight: patch.windowHeight ?? existing.windowHeight,
      isDone: patch.isDone ?? existing.isDone,
      updatedAt: new Date().toISOString()
    }
    run(
      this.getDb(),
      `UPDATE memos SET
        content = ?, tags = ?, color = ?, is_pinned = ?, pinned_at = ?,
        window_x = ?, window_y = ?, window_width = ?, window_height = ?,
        is_done = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        JSON.stringify(next.content),
        JSON.stringify(next.tags),
        next.color,
        next.isPinned ? 1 : 0,
        next.pinnedAt,
        next.windowX,
        next.windowY,
        next.windowWidth,
        next.windowHeight,
        next.isDone ? 1 : 0,
        next.updatedAt,
        id
      ]
    )
    this.persist()
    return this.getMemo(id)!
  }

  deleteMemo(id: MemoId): void {
    run(this.getDb(), 'DELETE FROM memos WHERE id = ?', [id])
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
        id, content, tags, color, is_pinned, pinned_at,
        window_x, window_y, window_width, window_height,
        is_done,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        JSON.stringify(m.content),
        JSON.stringify(m.tags),
        m.color,
        m.isPinned ? 1 : 0,
        m.pinnedAt ?? null,
        m.windowX,
        m.windowY,
        m.windowWidth,
        m.windowHeight,
        m.isDone ? 1 : 0,
        m.createdAt,
        m.updatedAt
      ]
    )
    this.persist()
    return true
  }
}
