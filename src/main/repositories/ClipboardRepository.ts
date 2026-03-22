import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { Database } from 'sql.js'
import type { ClipboardItem } from '@shared/types'
import { run, selectAll, selectOne, type SqlRow } from './sqlRun'

const MAX_ITEMS = 30

/** 저장 시 파일명만 허용 (경로 조각 차단) */
export function isSafeClipboardImageFileName(name: string): boolean {
  if (!name || name.length > 200) return false
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return false
  return /^[a-f0-9]{16}-\d+\.png$/i.test(name)
}

function rowToItem(row: SqlRow): ClipboardItem {
  const k = row.kind != null ? String(row.kind) : 'text'
  const kind = k === 'image' ? 'image' : 'text'
  const imagePathRaw = row.image_path
  const imagePath =
    imagePathRaw != null && String(imagePathRaw).length > 0 ? String(imagePathRaw) : undefined
  return {
    id: Number(row.id),
    kind,
    text: String(row.text),
    capturedAt: String(row.captured_at),
    ...(imagePath ? { imagePath } : {})
  }
}

export class ClipboardRepository {
  constructor(
    private readonly getDb: () => Database,
    private readonly persistFn: () => void,
    /** 이미지 파일 삭제용 절대 디렉터리 (테스트에서는 null) */
    private readonly getImageDir: () => string | null = () => null
  ) {}

  private persist(): void {
    this.persistFn()
  }

  private tryUnlinkImage(filename: string): void {
    if (!isSafeClipboardImageFileName(filename)) return
    const dir = this.getImageDir()
    if (!dir) return
    const abs = join(dir, filename)
    try {
      if (existsSync(abs)) unlinkSync(abs)
    } catch {
      /* ignore */
    }
  }

  /** FIFO: 최신 MAX_ITEMS 유지, 잘리는 행의 이미지 파일 삭제 */
  private trimExcess(): void {
    const db = this.getDb()
    const rows = selectAll(
      db,
      'SELECT id, image_path FROM clipboard_history ORDER BY captured_at DESC, id DESC'
    )
    if (rows.length <= MAX_ITEMS) return
    const removed = rows.slice(MAX_ITEMS)
    for (const r of removed) {
      const ip = r.image_path
      if (ip != null && String(ip).length > 0) {
        this.tryUnlinkImage(String(ip))
      }
      run(db, 'DELETE FROM clipboard_history WHERE id = ?', [r.id])
    }
    this.persist()
  }

  /** 동일 텍스트가 있으면 삭제 후 최신으로 다시 넣음 */
  addItem(text: string): ClipboardItem | null {
    if (!text) return null
    const db = this.getDb()
    run(db, `DELETE FROM clipboard_history WHERE kind = 'text' AND text = ?`, [text])
    const now = new Date().toISOString()
    run(
      db,
      `INSERT INTO clipboard_history (kind, text, image_path, captured_at) VALUES ('text', ?, NULL, ?)`,
      [text, now]
    )
    this.trimExcess()
    const row = selectOne(db, 'SELECT * FROM clipboard_history WHERE id = last_insert_rowid()', [])
    return row ? rowToItem(row) : null
  }

  /** PNG 파일은 서비스가 디스크에 쓴 뒤 파일명만 전달 */
  addImageItem(displayLabel: string, imageFileName: string): ClipboardItem | null {
    if (!displayLabel || !isSafeClipboardImageFileName(imageFileName)) return null
    const db = this.getDb()
    const now = new Date().toISOString()
    run(
      db,
      `INSERT INTO clipboard_history (kind, text, image_path, captured_at) VALUES ('image', ?, ?, ?)`,
      [displayLabel.slice(0, 500), imageFileName, now]
    )
    this.trimExcess()
    const row = selectOne(db, 'SELECT * FROM clipboard_history WHERE id = last_insert_rowid()', [])
    return row ? rowToItem(row) : null
  }

  getItemById(id: number): ClipboardItem | null {
    const row = selectOne(this.getDb(), 'SELECT * FROM clipboard_history WHERE id = ?', [id])
    return row ? rowToItem(row) : null
  }

  getItems(): ClipboardItem[] {
    const rows = selectAll(
      this.getDb(),
      `SELECT * FROM clipboard_history ORDER BY captured_at DESC, id DESC LIMIT ${MAX_ITEMS}`
    )
    return rows.map(rowToItem)
  }

  /** 클립보드 히스토리 전부 삭제 + 디스크 PNG 정리 */
  clearAll(): void {
    const db = this.getDb()
    const rows = selectAll(db, 'SELECT image_path FROM clipboard_history WHERE image_path IS NOT NULL', [])
    for (const r of rows) {
      const p = r.image_path
      if (p != null && String(p).length > 0) {
        this.tryUnlinkImage(String(p))
      }
    }
    run(db, 'DELETE FROM clipboard_history', [])
    this.persist()
  }
}
