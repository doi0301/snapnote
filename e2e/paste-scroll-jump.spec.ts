/**
 * P7-G — 긴 텍스트를 붙여넣은 칸을 만질 때의 스크롤 동작.
 *
 * 붙여넣기는 기본적으로 칸을 쪼개지 않으므로 여러 줄 텍스트는 한 칸을 뷰포트보다
 * 크게 만든다. 예전 보정은 '줄의 바닥'을 화면에 맞췄기 때문에, 칸 앞쪽에 캐럿을 두고
 * 한 글자만 쳐도 스크롤이 내려가 캐럿이 화면 위로 밀려났다.
 *
 * 이제는 캐럿을 기준으로 맞춘다 — 보이면 그대로 두고, 벗어났을 때만 그만큼 따라간다.
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

/** 스크롤이 생기도록 칸을 채운 뒤, index 3 칸에 뷰포트보다 긴 텍스트를 붙여넣는다 */
async function setUpLongPastedCell(page: Page): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('제목')
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.type(`채우기 ${i}`)
  }
  await page.waitForTimeout(300)

  const long = Array.from({ length: 40 }, (_, i) => `붙여넣은 ${i} 번째 줄`).join('\n')
  await page.evaluate((t) => {
    const ta = document.querySelectorAll('.editor-line-textarea')[3] as HTMLTextAreaElement
    ta.focus()
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    ta.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
    )
  }, long)
  await page.waitForTimeout(400)
}

function scrollTop(page: Page): Promise<number> {
  return page.evaluate(() =>
    Math.round((document.querySelector('.editor-scroll') as HTMLElement).scrollTop)
  )
}

test.describe('붙여넣기 후 스크롤', () => {
  test('칸 앞쪽에서 입력해도 스크롤이 내려가지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await setUpLongPastedCell(edit)

      // 사용자는 위쪽을 보고 있다
      await edit.evaluate(() => {
        ;(document.querySelector('.editor-scroll') as HTMLElement).scrollTop = 0
      })
      await edit.waitForTimeout(250)
      const before = await scrollTop(edit)

      await edit.locator('.editor-line-textarea').nth(3).click({ position: { x: 20, y: 10 } })
      await edit.waitForTimeout(300)
      expect(await scrollTop(edit)).toBeLessThan(before + 50)

      await edit.keyboard.type('X')
      await edit.waitForTimeout(400)
      expect(await scrollTop(edit)).toBeLessThan(before + 50)
    } finally {
      await app.close()
    }
  })

  test('칸 맨 끝에서 입력하면 캐럿을 따라 스크롤이 내려간다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await setUpLongPastedCell(edit)

      await edit.evaluate(() => {
        ;(document.querySelector('.editor-scroll') as HTMLElement).scrollTop = 0
      })
      await edit.waitForTimeout(250)

      // 캐럿을 칸 맨 끝으로 — 화면 밖이다
      await edit.evaluate(() => {
        const ta = document.querySelectorAll('.editor-line-textarea')[3] as HTMLTextAreaElement
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      })
      await edit.keyboard.type('끝')
      await edit.waitForTimeout(400)

      // 캐럿이 화면 밖이었으므로 그만큼 따라 내려가야 한다
      expect(await scrollTop(edit)).toBeGreaterThan(200)
    } finally {
      await app.close()
    }
  })
})
