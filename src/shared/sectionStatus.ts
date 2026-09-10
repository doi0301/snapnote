/**
 * 섹션 진행상태 (P6) — 클로드 블록 상태와 값 집합이 다르다.
 * 클로드 블록은 대화 사이클(질문완료·답변검토)을 추적하지만, 섹션은 일반 작업
 * 진행 단계를 추적한다. `undefined` = 미지정이 기본이고, 그때는 배지를 그리지 않는다.
 */
export type SectionStatus = 'todo' | 'doing' | 'hold' | 'done'

export const SECTION_STATUS_ORDER: SectionStatus[] = ['todo', 'doing', 'hold', 'done']

export const SECTION_STATUS_META: Record<SectionStatus, { emoji: string; label: string }> = {
  todo: { emoji: '⚪', label: '할일' },
  doing: { emoji: '🔵', label: '진행중' },
  hold: { emoji: '🟡', label: '보류' },
  done: { emoji: '✅', label: '완료' }
}
