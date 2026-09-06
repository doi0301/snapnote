import type { EditorLine } from './types'

/**
 * 섹션/클로드 블록 공통 소속 규칙 (들여쓰기 기반): 헤더보다 들여쓰기가 깊은 줄들이
 * 연속되는 동안만 그 헤더에 속한다. 다음 헤더를 만나거나(들여쓰기와 무관하게 항상
 * 끊김 — 중첩 없음), 들여쓰기가 헤더와 같거나 얕아지면(Shift+Tab 등) 그 줄부터는
 * 소속에서 빠진다. "헤더"는 섹션 타이틀(`sectionTitle`)과 클로드 블록(`claudeBlock`)
 * 둘 다를 가리키며, 둘은 완전히 같은 알고리즘을 공유한다.
 */

/** 이 줄이 범위를 소유하는 헤더인지 — 섹션 타이틀과 클로드 블록 모두 인정 */
export function isBlockHeader(line: EditorLine | undefined): boolean {
  return Boolean(line?.formatting?.sectionTitle) || Boolean(line?.formatting?.claudeBlock)
}

/**
 * 헤더 한 줄이 소유하는 블록 범위 [start, end] (둘 다 포함).
 * 헤더가 아니거나 바로 아래에 더 깊게 들여쓴 줄이 없으면 자기 자신만 반환한다.
 */
export function computeSectionBlockRange(lines: EditorLine[], titleIndex: number): [number, number] {
  const title = lines[titleIndex]
  if (!isBlockHeader(title)) return [titleIndex, titleIndex]
  const titleIndent = title!.indentLevel
  let end = titleIndex
  for (let j = titleIndex + 1; j < lines.length; j++) {
    const line = lines[j]
    if (isBlockHeader(line)) break
    if ((line?.indentLevel ?? 0) <= titleIndent) break
    end = j
  }
  return [titleIndex, end]
}

/** 섹션/클로드 블록 접힘으로 숨겨져야 하는 줄 인덱스 집합 */
export function computeSectionHiddenIndices(lines: EditorLine[]): Set<number> {
  const hidden = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!isBlockHeader(line) || !line?.formatting?.sectionCollapsed) continue
    const [, end] = computeSectionBlockRange(lines, i)
    for (let j = i + 1; j <= end; j++) hidden.add(j)
  }
  return hidden
}

/** `index` 가 속한 헤더(섹션/클로드 블록)의 줄 인덱스 — 없으면 null (붙여넣기 들여쓰기 보정용) */
export function findEnclosingSectionTitleIndex(lines: EditorLine[], index: number): number | null {
  for (let k = index - 1; k >= 0; k--) {
    if (isBlockHeader(lines[k])) {
      const [, end] = computeSectionBlockRange(lines, k)
      return index <= end ? k : null
    }
  }
  return null
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
