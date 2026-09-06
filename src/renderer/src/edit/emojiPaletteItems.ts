/**
 * TASK-S4-01: 프로덕티비티 심볼 — 색 원/사각형, 화살표, 점, 상태, 강조, 구분선
 * 그리드에서 `sep` 행은 시각적 구분선(전체 너비)
 */

import { keycapStorageChar } from '@shared/keycapChar'

export type EmojiPaletteEntry =
  | { kind: 'sym'; char: string; label: string }
  | {
      kind: 'keycap'
      digit: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
      label: string
      insertChar: string
    }
  | { kind: 'sep' }

const KEYCAP_ITEMS: EmojiPaletteEntry[] = ([0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((digit) => ({
  kind: 'keycap' as const,
  digit,
  label: `숫자 ${digit}`,
  insertChar: keycapStorageChar(digit)
}))

export const EMOJI_PALETTE_ITEMS: EmojiPaletteEntry[] = [
  { kind: 'sym', char: '🔴', label: '빨강 원' },
  { kind: 'sym', char: '🟠', label: '주황 원' },
  { kind: 'sym', char: '🟡', label: '노랑 원' },
  { kind: 'sym', char: '🟢', label: '초록 원' },
  { kind: 'sym', char: '🔵', label: '파랑 원' },
  { kind: 'sym', char: '🟣', label: '보라 원' },
  { kind: 'sym', char: '⚫', label: '검정 원' },
  { kind: 'sym', char: '⚪', label: '흰 원' },
  { kind: 'sep' },
  { kind: 'sym', char: '🟥', label: '빨강 사각형' },
  { kind: 'sym', char: '🟧', label: '주황 사각형' },
  { kind: 'sym', char: '🟨', label: '노랑 사각형' },
  { kind: 'sym', char: '🟩', label: '초록 사각형' },
  { kind: 'sym', char: '🟦', label: '파랑 사각형' },
  { kind: 'sym', char: '🟪', label: '보라 사각형' },
  { kind: 'sym', char: '⬛', label: '검정 사각형' },
  { kind: 'sym', char: '⬜', label: '흰 사각형' },
  { kind: 'sep' },
  ...KEYCAP_ITEMS,
  { kind: 'sep' },
  { kind: 'sym', char: '→', label: '오른쪽 화살표' },
  { kind: 'sym', char: '←', label: '왼쪽 화살표' },
  { kind: 'sym', char: '↑', label: '위 화살표' },
  { kind: 'sym', char: '↓', label: '아래 화살표' },
  { kind: 'sym', char: '↔', label: '좌우' },
  { kind: 'sym', char: '↕', label: '상하' },
  { kind: 'sym', char: '⇄', label: '양방향' },
  { kind: 'sym', char: '⇒', label: '이중 화살표' },
  { kind: 'sym', char: '⟹', label: '굵은 이중 화살표' },
  { kind: 'sym', char: '🤖', label: '로봇' },
  { kind: 'sym', char: '🕐', label: '시계' },
  { kind: 'sep' },
  { kind: 'sym', char: '•', label: '점' },
  { kind: 'sym', char: '○', label: '빈 원' },
  { kind: 'sym', char: '●', label: '검은 원' },
  { kind: 'sym', char: '◆', label: '다이아' },
  { kind: 'sym', char: '▪', label: '작은 사각' },
  { kind: 'sym', char: '▫', label: '빈 작은 사각' },
  { kind: 'sym', char: '·', label: '가운뎃점' },
  { kind: 'sym', char: '⋯', label: '가로 말줄임' },
  { kind: 'sep' },
  { kind: 'sym', char: '✅', label: '완료' },
  { kind: 'sym', char: '❌', label: '취소' },
  { kind: 'sym', char: '👀', label: '진행중' },
  { kind: 'sym', char: '⭐', label: '별' },
  { kind: 'sym', char: '⚠', label: '주의' },
  { kind: 'sym', char: '⚡', label: '번개' },
  { kind: 'sym', char: '🔹', label: '작은 다이아' },
  { kind: 'sep' },
  { kind: 'sym', char: '❗', label: '느낌표' },
  { kind: 'sym', char: '❓', label: '물음표' },
  { kind: 'sym', char: '❔', label: '흰 물음표' },
  { kind: 'sym', char: '⁉', label: '물음느낌표' },
  { kind: 'sym', char: '※', label: '참고' },
  { kind: 'sep' },
  { kind: 'sym', char: '①', label: '원 숫자 1' },
  { kind: 'sym', char: '②', label: '원 숫자 2' },
  { kind: 'sym', char: '③', label: '원 숫자 3' },
  { kind: 'sym', char: '④', label: '원 숫자 4' },
  { kind: 'sym', char: '⑤', label: '원 숫자 5' },
  { kind: 'sym', char: '⑥', label: '원 숫자 6' },
  { kind: 'sym', char: '⑦', label: '원 숫자 7' },
  { kind: 'sym', char: '⑧', label: '원 숫자 8' },
  { kind: 'sym', char: '⑨', label: '원 숫자 9' },
  { kind: 'sym', char: '⑩', label: '원 숫자 10' },
  { kind: 'sep' },
  { kind: 'sym', char: '—', label: '대시' },
  { kind: 'sym', char: '–', label: '엔 대시' },
  { kind: 'sym', char: '|', label: '세로줄' },
  { kind: 'sym', char: '‖', label: '이중 세로줄' },
  { kind: 'sym', char: '❘', label: '라이트 버티컬 바' },
  { kind: 'sym', char: '❙', label: '미디엄 버티컬 바' },
  { kind: 'sym', char: '❚', label: '헤비 버티컬 바' },
  { kind: 'sym', char: '▏', label: '좌측 블록 바' },
  { kind: 'sym', char: '/', label: '슬래시' },
  { kind: 'sym', char: '\\', label: '역슬래시' },
  { kind: 'sym', char: '⁄', label: '분수 슬래시' }
]
