import type { EditorLine } from '@shared/types'

/** 섹션 타이틀이 아래 줄들을 거느리는지 — 미지정은 기존 문서 호환을 위해 'until-next' */
function ownsFollowingLines(line: EditorLine | undefined): boolean {
  return Boolean(line?.formatting?.sectionTitle) && line?.formatting?.sectionScope !== 'self-only'
}

/** 섹션 접힘으로 숨겨져야 하는 줄 인덱스 집합 */
export function computeSectionHiddenIndices(lines: EditorLine[]): Set<number> {
  const hidden = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!ownsFollowingLines(line) || !line?.formatting?.sectionCollapsed) continue
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j]?.formatting?.sectionTitle) break
      hidden.add(j)
    }
  }
  return hidden
}

/**
 * 섹션 타이틀 한 줄이 소유하는 블록 범위 [start, end] (둘 다 포함, 드래그 재정렬용).
 * `self-only` 이거나 섹션 타이틀이 아니면 자기 자신만 반환한다.
 */
export function computeSectionBlockRange(lines: EditorLine[], titleIndex: number): [number, number] {
  const line = lines[titleIndex]
  if (!ownsFollowingLines(line)) return [titleIndex, titleIndex]
  let end = titleIndex
  for (let j = titleIndex + 1; j < lines.length; j++) {
    if (lines[j]?.formatting?.sectionTitle) break
    end = j
  }
  return [titleIndex, end]
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
