/**
 * P7-H — 위계(텍스트 유형)를 적용해도 본문의 괄호가 살아남는지.
 *
 * 예전 Editor.tsx 는 레벨을 모르는 자체 `stripAllHeadingMarkers` 로 `[` `<` `(` 를
 * 닥치는 대로 벗겼다. 그래서 `(참고) 확인 필요` 에 위계를 걸면 앞의 `(` 가 먹히고,
 * 저장된 텍스트는 마커가 감싸 줘서 에디터에서는 멀쩡해 보였다. 손실은 복사해서
 * 다른 앱에 붙여넣을 때에야 드러났다.
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

/** 첫 줄에 `body` 를 넣고 H`level` 을 적용한 뒤, 그 줄을 복사해 클립보드 내용을 돌려준다 */
async function typeApplyHeadingAndCopy(page: Page, body: string, level: number): Promise<string> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill(body)
  await page.waitForTimeout(120)

  await page.keyboard.press(`Control+${level}`)
  await page.waitForTimeout(200)

  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+c')
  await page.waitForTimeout(250)

  return page.evaluate(() => navigator.clipboard.readText())
}

test.describe('위계 적용 후 복사', () => {
  test('본문 앞의 괄호를 마커로 오인해 먹지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      expect(await typeApplyHeadingAndCopy(edit, '(참고) 확인 필요', 3)).toBe('(참고) 확인 필요')
    } finally {
      await app.close()
    }
  })

  test('본문 앞의 대괄호를 마커로 오인해 먹지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      expect(await typeApplyHeadingAndCopy(edit, '[긴급] 배포 건', 1)).toBe('[긴급] 배포 건')
    } finally {
      await app.close()
    }
  })

  test('여는 짝이 없는 끝의 닫는 괄호도 남긴다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      expect(await typeApplyHeadingAndCopy(edit, '함수 호출(인자)', 1)).toBe('함수 호출(인자)')
    } finally {
      await app.close()
    }
  })
})
