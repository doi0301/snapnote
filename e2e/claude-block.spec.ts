/**
 * P5 — 클로드 블록 회귀 테스트.
 *
 * `/클로드` 로 블록을 삽입하고, 템플릿을 고르고(또는 Esc로 빈 블록), 슬롯을
 * 채우고, 접기/펼치기, 진행상태 배지 전환(+followup 자동 슬롯 추가), [복사]
 * (클립보드 기록 + draft→sent 전환)까지 기능정의서 v1.0 범위를 검증한다.
 * 소속 판정·접기는 섹션과 완전히 같은 들여쓰기 기반 알고리즘을 공유한다.
 */
import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { launchSnapNote, mainScript, waitForPage } from './helpers'

test.beforeAll(() => {
  if (!existsSync(mainScript)) {
    throw new Error(
      '빌드 산출물이 없습니다. E2E 전에 `npm run build` 를 실행하세요. (기대 경로: out/main/index.js)'
    )
  }
})

async function newEditWindow(app): Promise<Page> {
  const folded = await waitForPage(app, 'folded.html')
  await folded.getByTestId('folded-new-memo').click()
  return waitForPage(app, 'edit.html')
}

/** 제목 줄 다음에 빈 칸을 만들고 그 칸에 `/클로드` 를 입력한다 (헤더는 index 1) */
async function triggerClaudeBlock(page: Page): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('메모')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('/클로드')
  await page.waitForTimeout(200)
}

function lineValues(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.editor-line-textarea')).map(
      (el) => (el as HTMLTextAreaElement).value
    )
  )
}

test.describe('클로드 블록 삽입', () => {
  test('/클로드 입력 시 템플릿 드롭다운이 열리고, 템플릿을 고르면 슬롯이 깔린다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)

      await expect(edit.locator('.editor-claude-template-popover')).toBeVisible()
      await edit.locator('.editor-claude-template-option', { hasText: '원문 요약' }).click()
      await edit.waitForTimeout(200)

      expect(await lineValues(edit)).toEqual(['메모', '', '{첨부}', '', '{명령}', ''])
      await expect(edit.locator('.editor-claude-template-popover')).toHaveCount(0)
    } finally {
      await app.close()
    }
  })

  test('Esc 로 드롭다운을 닫으면 빈 블록({첨부}{명령})이 그대로 남는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)
      await edit.keyboard.press('Escape')
      await edit.waitForTimeout(200)

      await expect(edit.locator('.editor-claude-template-popover')).toHaveCount(0)
      expect(await lineValues(edit)).toEqual(['메모', '', '{첨부}', '', '{명령}', ''])
    } finally {
      await app.close()
    }
  })

  test('블록 안에서 다시 /클로드 를 입력해도 중첩 생성되지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)
      await edit.keyboard.press('Escape')
      await edit.waitForTimeout(150)

      // 첨부 슬롯의 내용 줄(index 3)에 /클로드 를 입력 — 이미 블록 범위 안이라 무시돼야 함
      await edit.locator('.editor-line-textarea').nth(3).click()
      await edit.keyboard.type('/클로드')
      await edit.waitForTimeout(200)

      await expect(edit.locator('.editor-claude-template-popover')).toHaveCount(0)
      await expect(edit.locator('.editor-claude-block-icon')).toHaveCount(1)
      expect(await lineValues(edit)).toEqual(['메모', '', '{첨부}', '/클로드', '{명령}', ''])
    } finally {
      await app.close()
    }
  })
})

test.describe('클로드 블록 접기', () => {
  test('접기 버튼을 누르면 슬롯·내용이 숨고, 다시 누르면 펼쳐진다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)
      await edit.keyboard.press('Escape')
      await edit.waitForTimeout(150)

      expect(await edit.locator('.editor-line-textarea').count()).toBe(6)
      await edit.locator('.editor-section-fold-btn').click()
      await edit.waitForTimeout(200)
      expect(await edit.locator('.editor-line-textarea').count()).toBe(2)

      await edit.locator('.editor-section-fold-btn').click()
      await edit.waitForTimeout(200)
      expect(await edit.locator('.editor-line-textarea').count()).toBe(6)
    } finally {
      await app.close()
    }
  })

  test('접힌 헤더에서 Shift+Enter 시 숨은 내용이 아니라 블록 밖 다음 칸으로 이동한다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)
      await edit.keyboard.press('Escape')
      await edit.waitForTimeout(150)

      await edit.locator('.editor-section-fold-btn').click()
      await edit.waitForTimeout(200)
      expect(await edit.locator('.editor-line-textarea').count()).toBe(2)

      await edit.locator('.editor-line-textarea').nth(1).click()
      await edit.keyboard.press('Shift+Enter')
      await edit.waitForTimeout(200)

      expect(await edit.locator('.editor-line-textarea').count()).toBe(3)
      expect(await lineValues(edit)).toEqual(['메모', '', ''])
      const focusedIsLast = await edit.evaluate(() => {
        const areas = Array.from(document.querySelectorAll('.editor-line-textarea'))
        return document.activeElement === areas[areas.length - 1]
      })
      expect(focusedIsLast).toBe(true)
    } finally {
      await app.close()
    }
  })
})

test.describe('진행상태', () => {
  test('배지를 클릭해 5개 상태 중 자유롭게 전환할 수 있다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)
      await edit.keyboard.press('Escape')
      await edit.waitForTimeout(150)

      await expect(edit.locator('.editor-claude-status-btn')).toContainText('작성중')

      await edit.locator('.editor-claude-status-btn').click()
      await edit.locator('.editor-claude-status-option', { hasText: '답변검토' }).click()
      await edit.waitForTimeout(150)
      await expect(edit.locator('.editor-claude-status-btn')).toContainText('답변검토')

      // 순서 강제 없이 바로 종료로도 전환 가능
      await edit.locator('.editor-claude-status-btn').click()
      await edit.locator('.editor-claude-status-option', { hasText: '종료' }).click()
      await edit.waitForTimeout(150)
      await expect(edit.locator('.editor-claude-status-btn')).toContainText('종료')
    } finally {
      await app.close()
    }
  })

  test('추가질문으로 전환하면 블록 끝에 {추가질문} 슬롯이 자동으로 붙는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)
      await edit.keyboard.press('Escape')
      await edit.waitForTimeout(150)

      await edit.locator('.editor-claude-status-btn').click()
      await edit.locator('.editor-claude-status-option', { hasText: '추가질문' }).click()
      await edit.waitForTimeout(200)

      expect(await lineValues(edit)).toEqual([
        '메모',
        '',
        '{첨부}',
        '',
        '{명령}',
        '',
        '{추가질문}',
        ''
      ])
      // 새 블록이 아니라 기존 블록 하나에 그대로 쌓여야 한다
      await expect(edit.locator('.editor-claude-block-icon')).toHaveCount(1)
    } finally {
      await app.close()
    }
  })
})

test.describe('[복사]', () => {
  test('클립보드에 기능정의서 형식으로 기록되고, draft 상태였다면 sent 로 전환된다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)
      await edit.locator('.editor-claude-template-option', { hasText: '수정가이드 요청' }).click()
      await edit.waitForTimeout(150)

      const ta = (i: number) => edit.locator('.editor-line-textarea').nth(i)
      // 1: 헤더 / 2: {프로젝트} / 3: 내용 / 4: {첨부} / 5: 내용 / 6: {명령} / 7: 내용 / 8: {산출물형식} / 9: 내용
      await ta(3).click()
      await ta(3).fill('KT로컬문서 연결 프로젝트')
      await ta(5).click()
      await ta(5).fill('최신 기획안 ppt')
      await ta(7).click()
      await ta(7).fill('9/2 미팅 수정사항 정리')
      await edit.waitForTimeout(150)

      await expect(edit.locator('.editor-claude-status-btn')).toContainText('작성중')
      await edit.locator('.editor-claude-copy-btn').click()
      await edit.waitForTimeout(300)

      const clip = await edit.evaluate(() => navigator.clipboard.readText())
      expect(clip).toBe(
        [
          '{프로젝트}',
          'KT로컬문서 연결 프로젝트',
          '',
          '{첨부}',
          '최신 기획안 ppt',
          '',
          '{명령}',
          '9/2 미팅 수정사항 정리'
        ].join('\n')
      )
      await expect(edit.locator('.editor-claude-status-btn')).toContainText('질문완료')
    } finally {
      await app.close()
    }
  })

  test('draft 가 아닌 상태에서 다시 복사해도 상태를 되돌리지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)
      await edit.keyboard.press('Escape')
      await edit.waitForTimeout(150)

      await edit.locator('.editor-claude-status-btn').click()
      await edit.locator('.editor-claude-status-option', { hasText: '종료' }).click()
      await edit.waitForTimeout(150)

      await edit.locator('.editor-claude-copy-btn').click()
      await edit.waitForTimeout(300)

      await expect(edit.locator('.editor-claude-status-btn')).toContainText('종료')
    } finally {
      await app.close()
    }
  })
})

test.describe('블록 삭제', () => {
  test('헤더 줄을 지우면 하위 줄은 남되 더 이상 블록으로 취급되지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await triggerClaudeBlock(edit)
      await edit.keyboard.press('Escape')
      await edit.waitForTimeout(150)

      // 헤더(index 1) 맨 앞에서 Backspace — 이전 줄(메모)과 병합돼 헤더 자체가 사라진다
      const header = edit.locator('.editor-line-textarea').nth(1)
      await header.click()
      await edit.keyboard.press('Home')
      await edit.keyboard.press('Backspace')
      await edit.waitForTimeout(200)

      await expect(edit.locator('.editor-claude-block-icon')).toHaveCount(0)
      await expect(edit.locator('.editor-section-fold-btn')).toHaveCount(0)
      // 하위 줄(슬롯·내용)은 텍스트 그대로 남아있다
      expect(await lineValues(edit)).toEqual(['메모', '{첨부}', '', '{명령}', ''])
    } finally {
      await app.close()
    }
  })
})
