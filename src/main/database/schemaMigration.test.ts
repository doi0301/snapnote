import { createRequire } from 'node:module'
import { dirname, join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import type { EditorLine } from '@shared/types'
import { applySchema, SCHEMA_VERSION } from './schema'
import { selectAll, selectOne, run } from '../repositories/sqlRun'

const require = createRequire(import.meta.url)

let SQL: Awaited<ReturnType<typeof initSqlJs>>

function contentOf(db: Database, id: string): EditorLine[] {
  const row = selectOne(db, 'SELECT content FROM memos WHERE id = ?', [id])
  return JSON.parse(String(row!.content)) as EditorLine[]
}

/** user_version 10 (구버전 섹션 규칙) 상태의 DB 를 만든다 */
function legacyDb(memos: { id: string; content: EditorLine[] }[]): Database {
  const db = new SQL.Database()
  applySchema(db)
  for (const m of memos) {
    run(
      db,
      `INSERT INTO memos (id, content, tags, color, is_pinned, created_at, updated_at)
       VALUES (?, ?, '[]', 'blue', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      [m.id, JSON.stringify(m.content)]
    )
  }
  run(db, 'PRAGMA user_version = 10')
  return db
}

describe('user_version 11 — 구버전 섹션 본문 들여쓰기 마이그레이션', () => {
  beforeAll(async () => {
    SQL = await initSqlJs({ locateFile: (f) => join(dirname(require.resolve('sql.js')), f) })
  })

  it('구버전 문서의 섹션 본문을 딱 한 번 들여쓴다', () => {
    const db = legacyDb([
      {
        id: 'm1',
        content: [
          { id: 'a', text: 'Sec A', indentLevel: 0, formatting: { sectionTitle: true } },
          { id: 'b', text: 'body', indentLevel: 0, formatting: {} },
          { id: 'c', text: 'Sec B', indentLevel: 0, formatting: { sectionTitle: true } }
        ]
      }
    ])

    applySchema(db)
    expect(contentOf(db, 'm1').map((l) => l.indentLevel)).toEqual([0, 1, 0])

    // 두 번째 실행은 아무것도 바꾸지 않는다 (user_version 이 이미 11)
    applySchema(db)
    expect(contentOf(db, 'm1').map((l) => l.indentLevel)).toEqual([0, 1, 0])
  })

  it('마이그레이션 뒤 user_version 이 최신이다', () => {
    const db = legacyDb([])
    applySchema(db)
    const ver = selectOne(db, 'PRAGMA user_version', [])
    expect(Number(ver!.user_version)).toBe(SCHEMA_VERSION)
  })

  it('내용이 깨진 메모는 건너뛰고 나머지를 계속 변환한다', () => {
    const db = legacyDb([
      {
        id: 'ok',
        content: [
          { id: 'a', text: 'Sec A', indentLevel: 0, formatting: { sectionTitle: true } },
          { id: 'b', text: 'body', indentLevel: 0, formatting: {} }
        ]
      }
    ])
    run(
      db,
      `INSERT INTO memos (id, content, tags, color, is_pinned, created_at, updated_at)
       VALUES ('bad', '{not json', '[]', 'blue', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    )
    run(db, 'PRAGMA user_version = 10')

    expect(() => applySchema(db)).not.toThrow()
    expect(contentOf(db, 'ok').map((l) => l.indentLevel)).toEqual([0, 1])
    const bad = selectOne(db, 'SELECT content FROM memos WHERE id = ?', ['bad'])
    expect(String(bad!.content)).toBe('{not json')
  })

  it('새로 만든 빈 DB 는 곧바로 최신 버전이 된다', () => {
    const db = new SQL.Database()
    applySchema(db)
    const ver = selectOne(db, 'PRAGMA user_version', [])
    expect(Number(ver!.user_version)).toBe(SCHEMA_VERSION)
    expect(selectAll(db, 'SELECT id FROM memos', [])).toHaveLength(0)
  })
})
