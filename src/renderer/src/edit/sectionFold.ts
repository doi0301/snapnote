import type { EditorLine } from '@shared/types'

/** 섹션 접힘으로 숨겨져야 하는 줄 인덱스 집합 */
export function computeSectionHiddenIndices(lines: EditorLine[]): Set<number> {
  const hidden = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line?.formatting?.sectionTitle || !line.formatting.sectionCollapsed) continue
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j]?.formatting?.sectionTitle) break
      hidden.add(j)
    }
  }
  return hidden
}

/** 숨겨진 줄을 건너뛰며 위/아래로 이동할 다음 인덱스 */
export function nextVisibleLineIndex(
  from: number,
  direction: -1 | 1,
  lineCount: number,
  hidden: Set<number>
): number | null {
  let i = from + direction
  while (i >= 0 && i < lineCount) {
    if (!hidden.has(i)) return i
    i += direction
  }
  return null
}
