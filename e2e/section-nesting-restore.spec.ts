/**
 * P7-F — 상위/하위 섹션 사이에 들여쓰기 없는 칸을 넣었다 지웠을 때 소속 복원.
 *
 * 사용자가 2026-09-10 에 보고한 증상("하위 섹션이 상단 섹션에 속해지지 않는다")은
 * **P6 T1 에서 이미 고쳐졌다.** 같은 시나리오를 P6 이전 커밋(`1e7b743`)에서 돌리면
 * 섹션 A 에 접기 버튼조차 생기지 않는다 — 자식이 하나도 없다는 뜻이고, 범위 판정이
 * 들여쓰기와 무관하게 "다음 섹션 타이틀에서 무조건 끊김"이었기 때문이다.
 * P6 T1 이 이를 "나보다 얕거나 같은 들여쓰기의 헤더에서만 끊김"으로 일반화하면서 해결됐다.
 *
 * 들여쓰기 값 자체는 수정 전후가 같다(`[0,1]` → `[0,0,1]` → `[0,1]`). 달라진 건
 * 그 값을 읽는 `computeSectionBlockRange` 쪽이다. 그래서 이 테스트는 들여쓰기가 아니라
 * **접기 동작**으로 소속을 확인한다.
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

function indentLevels(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.editor-line')).map((el) => {
      const m = Array.from(el.classList)
        .find((c) => c.startsWith('editor-line--level-'))
        ?.replace('editor-line--level-', '')
      return m ? Number(m) : 0
    })
  )
}

function lineValues(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.editor-line-textarea')).map(
      (el) => (el as HTMLTextAreaElement).value
    )
  )
}

/** 첫 줄을 섹션 타이틀로 만든다 (Ctrl+`) */
async function makeSectionTitle(page: Page, text: string): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill(text)
  await page.keyboard.press('Control+`')
  await page.waitForTimeout(200)
}

test.describe('섹션 사이에 칸을 넣었다 지우기 (P7-F)', () => {
  test('섹션 바로 아래 섹션 — 칸을 넣었다 지우면 다시 자식으로 돌아온다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit, '섹션 A')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('섹션 B')
      await edit.keyboard.press('Control+`')
      await edit.waitForTimeout(250)
      expect(await indentLevels(edit)).toEqual([0, 1])

      // 섹션 A 끝에서 칸을 만들고 타이틀 단계까지 내어쓴다 → 이 시점엔 B 가 A 에서 빠진다
      await edit.locator('.editor-line-textarea').nth(0).click()
      await edit.keyboard.press('End')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.press('Shift+Tab')
      await edit.waitForTimeout(250)
      expect(await indentLevels(edit)).toEqual([0, 0, 1])

      // 그 칸 맨 앞에서 Backspace 로 지운다
      await edit.keyboard.press('Home')
      await edit.keyboard.press('Backspace')
      await edit.waitForTimeout(300)
      expect(await indentLevels(edit)).toEqual([0, 1])

      // 섹션 A 를 접으면 자식 섹션 B 가 함께 숨는다
      await edit.locator('.editor-section-fold-btn').first().click()
      await edit.waitForTimeout(250)
      expect(await lineValues(edit)).toEqual(['섹션 A'])
    } finally {
      await app.close()
    }
  })

  test('사이에 본문이 있는 경우에도 칸을 넣었다 지우면 자식으로 돌아온다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await makeSectionTitle(edit, '섹션 A')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 A')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('섹션 B')
      await edit.keyboard.press('Tab')
      await edit.keyboard.press('Control+`')
      await edit.waitForTimeout(250)
      expect(await indentLevels(edit)).toEqual([0, 1, 2])

      await edit.locator('.editor-line-textarea').nth(1).click()
      await edit.keyboard.press('End')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.press('Shift+Tab')
      await edit.waitForTimeout(250)
      expect(await indentLevels(edit)).toEqual([0, 1, 0, 2])

      await edit.keyboard.press('Backspace')
      await edit.waitForTimeout(300)
      expect(await indentLevels(edit)).toEqual([0, 1, 2])

      await edit.locator('.editor-section-fold-btn').first().click()
      await edit.waitForTimeout(250)
      expect(await lineValues(edit)).toEqual(['섹션 A'])
    } finally {
      await app.close()
    }
  })
})
