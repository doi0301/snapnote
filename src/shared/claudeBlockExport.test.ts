import { describe, expect, it } from 'vitest'
import type { EditorLine } from './types'
import { exportClaudeBlockToText } from './claudeBlockExport'

function line(
  id: string,
  text: string,
  formatting: EditorLine['formatting'] = {},
  indentLevel = 0
): EditorLine {
  return { id, text, indentLevel, formatting }
}

function header(id: string, text: string, indentLevel = 0): EditorLine {
  return line(id, text, { claudeBlock: { templateId: 'blank', status: 'draft' } }, indentLevel)
}

function slot(id: string, name: string, indentLevel: number): EditorLine {
  return line(id, `{${name}}`, { claudeSlot: name }, indentLevel)
}

describe('exportClaudeBlockToText', () => {
  it('matches the exact spec example (기능정의서 6번)', () => {
    const lines = [
      header('h', '클로드 블록 · 수정가이드 요청', 0),
      slot('s1', '프로젝트', 1),
      line('c1', 'KT로컬문서 연결 프로젝트', {}, 2),
      slot('s2', '첨부', 1),
      line('c2', '- 최신 실시처분보상 기획안 ppt', {}, 2),
      line('c3', '- 임서현 과장님 검토 ppt 메모', {}, 2),
      slot('s3', '명령', 1),
      line('c4', '9/2 미팅 수정사항을 기획안 수정가이드로 정리해줘', {}, 2)
    ]
    const expected = [
      '{프로젝트}',
      'KT로컬문서 연결 프로젝트',
      '',
      '{첨부}',
      '- 최신 실시처분보상 기획안 ppt',
      '- 임서현 과장님 검토 ppt 메모',
      '',
      '{명령}',
      '9/2 미팅 수정사항을 기획안 수정가이드로 정리해줘'
    ].join('\n')
    expect(exportClaudeBlockToText(lines, 0)).toBe(expected)
  })

  it('내용이 빈 슬롯은 라벨째 생략한다', () => {
    const lines = [
      header('h', '블록', 0),
      slot('s1', '첨부', 1),
      line('c1', '', {}, 2),
      slot('s2', '명령', 1),
      line('c2', '요약해줘', {}, 2)
    ]
    expect(exportClaudeBlockToText(lines, 0)).toBe('{명령}\n요약해줘')
  })

  it('취소선 처리된 내용 줄은 생략한다', () => {
    const lines = [
      header('h', '블록', 0),
      slot('s1', '첨부', 1),
      line('c1', '이건 뺀다', { strikethrough: true }, 2),
      line('c2', '이건 남긴다', {}, 2)
    ]
    expect(exportClaudeBlockToText(lines, 0)).toBe('{첨부}\n이건 남긴다')
  })

  it('취소선 처리된 슬롯 라벨은 슬롯째 생략한다', () => {
    const lines = [
      header('h', '블록', 0),
      slot('s1', '첨부', 1),
      line('c1', '파일 A', {}, 2),
      { ...slot('s2', '명령', 1), formatting: { claudeSlot: '명령', strikethrough: true } },
      line('c2', '이건 안 나와야 함', {}, 2)
    ]
    expect(exportClaudeBlockToText(lines, 0)).toBe('{첨부}\n파일 A')
  })

  it('내용 줄의 들여쓰기 계층을 공백 2칸으로 변환한다', () => {
    const lines = [
      header('h', '블록', 0),
      slot('s1', '첨부', 1),
      line('c1', '최상위 항목', {}, 2),
      line('c2', '하위 항목', {}, 3),
      line('c3', '더 깊은 항목', {}, 4)
    ]
    expect(exportClaudeBlockToText(lines, 0)).toBe(
      ['{첨부}', '최상위 항목', '  하위 항목', '    더 깊은 항목'].join('\n')
    )
  })

  it('한 칸 안 줄바꿈(\\n)도 각 줄마다 상대 들여쓰기를 적용한다', () => {
    const lines = [
      header('h', '블록', 0),
      slot('s1', '명령', 1),
      line('c1', '첫 줄\n둘째 줄', {}, 2)
    ]
    expect(exportClaudeBlockToText(lines, 0)).toBe('{명령}\n첫 줄\n둘째 줄')
  })

  it('블록 헤더 자체(제목·배지)는 출력에서 제외된다', () => {
    const lines = [header('h', '이 제목은 안 나온다', 0), slot('s1', '명령', 1), line('c1', '본문', {}, 2)]
    const out = exportClaudeBlockToText(lines, 0)
    expect(out).not.toContain('이 제목은 안 나온다')
    expect(out).toBe('{명령}\n본문')
  })

  it('다음 헤더(섹션 타이틀 포함) 이후 내용은 포함하지 않는다', () => {
    const lines = [
      header('h', '블록', 0),
      slot('s1', '명령', 1),
      line('c1', '포함됨', {}, 2),
      line('sec', 'Sec B', { sectionTitle: true }, 0),
      line('c2', '포함 안 됨', {}, 1)
    ]
    expect(exportClaudeBlockToText(lines, 0)).toBe('{명령}\n포함됨')
  })

  it('슬롯이 하나도 없거나 전부 비어 있으면 빈 문자열을 반환한다', () => {
    const lines = [header('h', '블록', 0)]
    expect(exportClaudeBlockToText(lines, 0)).toBe('')
  })
})
