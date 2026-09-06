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

/**
 * `[blockStart, blockEnd]` 블록을 통째로 들어내 `dropIndex` 앞에 다시 끼워 넣는다.
 * `dropIndex` 는 원본 배열 기준 인덱스. 블록 자기 자신의 범위(`blockStart`~`blockEnd+1`)로
 * 떨어지면 이동 없이 원본을 그대로 반환한다.
 */
export function moveSectionBlock<T>(
  lines: T[],
  blockStart: number,
  blockEnd: number,
  dropIndex: number
): T[] {
  if (dropIndex >= blockStart && dropIndex <= blockEnd + 1) return lines
  const block = lines.slice(blockStart, blockEnd + 1)
  const rest = [...lines.slice(0, blockStart), ...lines.slice(blockEnd + 1)]
  const adjustedDropIndex = dropIndex > blockEnd ? dropIndex - block.length : dropIndex
  return [...rest.slice(0, adjustedDropIndex), ...block, ...rest.slice(adjustedDropIndex)]
}

/** 드롭 목표 인덱스가 블록 내부(이동 없음)에 해당하면, 더 가까운 경계로 스냅한다 */
export function clampDropIndexOutsideBlock(
  dropIndex: number,
  blockStart: number,
  blockEnd: number
): number {
  if (dropIndex <= blockStart || dropIndex > blockEnd) return dropIndex
  const distToStart = dropIndex - blockStart
  const distToEnd = blockEnd + 1 - dropIndex
  return distToStart <= distToEnd ? blockStart : blockEnd + 1
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
