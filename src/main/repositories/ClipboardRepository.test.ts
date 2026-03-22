import { createRequire } from 'node:module'
import { dirname, join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from 'sql.js'
import initSqlJs from 'sql.js'
import { applySchema } from '../database/schema'
import { ClipboardRepository } from './ClipboardRepository'

const require = createRequire(import.meta.url)

function sqlJsWasmDir(): string {
  return dirname(require.resolve('sql.js'))
}

describe('ClipboardRepository', () => {
  let db: Database
  let repo: ClipboardRepository

  beforeEach(async () => {
    const SQL = await initSqlJs({
      locateFile: (f) => join(sqlJsWasmDir(), f)
    })
    db = new SQL.Database()
    applySchema(db)
    repo = new ClipboardRepository(() => db, () => {})
  })

  it('keeps at most 30 items (FIFO trim)', () => {
    for (let i = 0; i < 31; i++) {
      repo.addItem(`line-${i}`)
    }
    const items = repo.getItems()
    expect(items.length).toBe(30)
    expect(items[0]?.text).toBe('line-30')
    expect(items[0]?.kind).toBe('text')
    expect(items.map((x) => x.text)).not.toContain('line-0')
  })

  it('moves duplicate text to newest', () => {
    repo.addItem('dup')
    repo.addItem('other')
    repo.addItem('dup')
    const items = repo.getItems()
    const dups = items.filter((x) => x.text === 'dup')
    expect(dups.length).toBe(1)
    expect(items[0]?.text).toBe('dup')
  })

  it('adds image item with safe filename and kind image', () => {
    const img = repo.addImageItem('screenshot.png', 'a1b2c3d4e5f67890-1700000000000.png')
    expect(img?.kind).toBe('image')
    expect(img?.text).toBe('screenshot.png')
    expect(img?.imagePath).toBe('a1b2c3d4e5f67890-1700000000000.png')
    const items = repo.getItems()
    expect(items[0]?.kind).toBe('image')
  })

  it('rejects unsafe image filename', () => {
    expect(repo.addImageItem('x', '../../../evil.png')).toBeNull()
  })
})
