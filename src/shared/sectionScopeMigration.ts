import type { EditorLine } from './types'

const MAX_INDENT = 6

/**
 * 구버전 섹션 범위(항상 "다음 타이틀 전까지", `sectionScope: 'self-only'` 는 예외) 를
 * 새 들여쓰기 기반 규칙(타이틀보다 깊게 들여쓴 줄만 소속)으로 변환한다.
 *
 * **로드 경로에서 부르면 안 된다.** 구버전 문서와 "섹션을 의도적으로 빠져나온 줄"은
 * 내용만으로 구분되지 않아서, 매 로드마다 돌리면 섹션 밖 최상위 줄을 계속 섹션 안으로
 * 끌어들인다(P6 에서 고친 버그). `sectionScope` 는 도입 때부터 선택 필드였고 미지정이
 * 곧 'until-next' 라서, 그 필드의 유무로 구버전 문서를 가려낼 수도 없다.
 * 그래서 이 변환은 DB 마이그레이션(`schema.ts`, user_version 11)에서 딱 한 번만 돈다.
 */
export function migrateSectionScopeToIndent(content: EditorLine[]): EditorLine[] {
  const next = content.map((l) => ({ ...l }))
  for (let i = 0; i < next.length; i++) {
    const title = next[i]!
    if (!title.formatting?.sectionTitle) continue
    const legacyScope = (title.formatting as Record<string, unknown>).sectionScope
    if (legacyScope === 'self-only') continue
    const titleIndent = Math.max(0, Math.min(MAX_INDENT, title.indentLevel ?? 0))
    const targetIndent = Math.min(MAX_INDENT, titleIndent + 1)
    for (let j = i + 1; j < next.length; j++) {
      const body = next[j]!
      if (body.formatting?.sectionTitle) break
      if ((body.indentLevel ?? 0) <= titleIndent) {
        next[j] = { ...body, indentLevel: targetIndent }
      }
    }
  }
  return next
}
