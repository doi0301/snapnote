/**
 * 구분선 회귀 테스트.
 *
 * `.editor-line` 은 가로 flex 행이고 `.editor-line-divider` 는 그 행의 형제다.
 * 구분선이 `width: 100%` 를 요구하면 같은 행의 편집 영역이 폭 0 으로 짓눌려
 * 글자마다 줄바꿈되는(=세로로 입력되는) 것처럼 보인다.
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

/** 제목 줄 아래에 본문 줄을 만들고 그 줄에 텍스트를 넣는다 (index 1) */
async function bodyLineWithText(page: Page, text: string): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('제목')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(text)
  await page.waitForTimeout(300)
}

/** 좁은 창에서는 구분선 버튼이 "더보기" 안으로 접힌다 */
async function toggleDivider(page: Page): Promise<void> {
  if ((await page.locator('.format-toolbar-btn--divider').count()) === 0) {
    await page.locator('.format-toolbar-btn--more-tools').click()
    await page.waitForTimeout(300)
  }
  await page.locator('.format-toolbar-btn--divider').click()
  await page.waitForTimeout(400)
}

function widthOf(page: Page, index: number): Promise<number> {
  return page.evaluate((i) => {
    const ta = document.querySelectorAll('.editor-line-textarea')[i] as HTMLTextAreaElement
    return ta ? ta.getBoundingClientRect().width : -1
  }, index)
}

test.describe('구분선', () => {
  test('텍스트가 있는 줄에 구분선을 달아도 입력 영역 폭이 줄지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await bodyLineWithText(edit, '가로로 입력되어야 합니다')
      const before = await widthOf(edit, 1)

      await toggleDivider(edit)

      const after = await widthOf(edit, 1)
      expect(after).toBeGreaterThan(before * 0.9)
    } finally {
      await app.close()
    }
  })

  test('구분선은 그 줄의 아래에 그려진다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await bodyLineWithText(edit, '윗줄 내용')
      await toggleDivider(edit)

      const box = await edit.evaluate(() => {
        const ta = document.querySelectorAll('.editor-line-textarea')[1] as HTMLTextAreaElement
        const dv = document.querySelector('.editor-line-divider') as HTMLElement
        return {
          textBottom: ta.getBoundingClientRect().bottom,
          dividerTop: dv.getBoundingClientRect().top
        }
      })
      expect(box.dividerTop).toBeGreaterThanOrEqual(box.textBottom - 2)
    } finally {
      await app.close()
    }
  })

  test('구분선 아래 칸도 가로로 입력된다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await bodyLineWithText(edit, '윗줄 내용')
      await toggleDivider(edit)

      await edit.keyboard.press('End')
      await edit.keyboard.press('Enter')
      await edit.keyboard.type('아랫줄 내용')
      await edit.waitForTimeout(400)

      expect(await edit.locator('.editor-line-textarea').nth(2).inputValue()).toBe('아랫줄 내용')
      expect(await widthOf(edit, 2)).toBeGreaterThan(await widthOf(edit, 0) * 0.9)
    } finally {
      await app.close()
    }
  })

  test('구분선이 가로 스크롤을 만들지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await bodyLineWithText(edit, '윗줄 내용')
      const overflowX = (): Promise<number> =>
        edit.evaluate(() => {
          const sc = document.querySelector('.editor-scroll') as HTMLElement
          return sc.scrollWidth - sc.clientWidth
        })
      expect(await overflowX()).toBe(0)

      await toggleDivider(edit)

      // flex-basis 100% 에 좌우 margin 이 더해지면 줄이 컨테이너보다 넓어진다
      expect(await overflowX()).toBe(0)
    } finally {
      await app.close()
    }
  })

  test('구분선 아래 칸 맨 앞에서 Backspace 하면 구분선이 지워진다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await bodyLineWithText(edit, '윗줄 내용')
      await toggleDivider(edit)

      await edit.keyboard.press('End')
      await edit.keyboard.press('Enter')
      await edit.keyboard.type('아랫줄 내용')
      await edit.waitForTimeout(300)
      await expect(edit.locator('.editor-line-divider')).toHaveCount(1)

      await edit.keyboard.press('Home')
      await edit.keyboard.press('Backspace')
      await edit.waitForTimeout(400)

      await expect(edit.locator('.editor-line-divider')).toHaveCount(0)
      // 구분선만 지워지고 두 줄의 내용은 그대로여야 한다
      expect(await edit.locator('.editor-line-textarea').nth(1).inputValue()).toBe('윗줄 내용')
      expect(await edit.locator('.editor-line-textarea').nth(2).inputValue()).toBe('아랫줄 내용')
    } finally {
      await app.close()
    }
  })
})
