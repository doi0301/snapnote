/**
 * P3 (2/2) — 섹션 블록 드래그 재정렬 회귀 테스트.
 *
 * 섹션 타이틀 hover 손잡이(`.editor-section-drag-handle`)에서 드래그를 시작해
 * 섹션 블록(타이틀 + 타이틀보다 깊게 들여쓴 하위 줄) 전체를 다른 위치로 옮긴다.
 * 텍스트 선택 드래그와 겹치지 않도록 손잡이에서만 시작된다.
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

async function lineValues(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.editor-line-textarea')).map(
      (el) => (el as HTMLTextAreaElement).value
    )
  )
}

/** 제목 + 섹션 A(본문 2줄) + 섹션 B(본문 1줄) 문서를 만든다 */
async function setupTwoSections(page: Page): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('제목')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('섹션 A')
  await page.keyboard.press('Control+`')
  await page.waitForTimeout(150)
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('A 본문 1')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('A 본문 2')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('섹션 B')
  await page.keyboard.press('Control+`')
  await page.waitForTimeout(150)
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('B 본문 1')
  await page.waitForTimeout(300)
}

async function dragHandleTo(
  page: Page,
  handleIndex: number,
  targetBox: { x: number; y: number; width: number; height: number }
): Promise<void> {
  const handle = page.locator('.editor-section-drag-handle').nth(handleIndex)
  const box = await handle.boundingBox()
  if (!box) throw new Error('drag handle not found')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(80)
  await page.mouse.move(targetBox.x + 10, targetBox.y + targetBox.height + 5, { steps: 10 })
  await page.waitForTimeout(120)
  await page.mouse.up()
  await page.waitForTimeout(300)
}

test.describe('섹션 드래그 재정렬', () => {
  test('섹션 A(타이틀+본문 2줄)를 섹션 B 아래로 끌면 블록 전체가 옮겨진다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await setupTwoSections(edit)
      expect(await lineValues(edit)).toEqual([
        '제목',
        '섹션 A',
        'A 본문 1',
        'A 본문 2',
        '섹션 B',
        'B 본문 1'
      ])

      const lastLineBox = await edit.locator('.editor-line-textarea').last().boundingBox()
      if (!lastLineBox) throw new Error('no box')
      await dragHandleTo(edit, 0, lastLineBox)

      expect(await lineValues(edit)).toEqual([
        '제목',
        '섹션 B',
        'B 본문 1',
        '섹션 A',
        'A 본문 1',
        'A 본문 2'
      ])
    } finally {
      await app.close()
    }
  })

  test('섹션 B를 섹션 A 위로 끌어올리면 블록 순서가 바뀐다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await setupTwoSections(edit)

      const titleBox = await edit.locator('.editor-line-textarea').first().boundingBox()
      if (!titleBox) throw new Error('no box')
      // 섹션 B 손잡이(index 1)를 제목 바로 아래로 드래그
      await dragHandleTo(edit, 1, titleBox)

      expect(await lineValues(edit)).toEqual([
        '제목',
        '섹션 B',
        'B 본문 1',
        '섹션 A',
        'A 본문 1',
        'A 본문 2'
      ])
    } finally {
      await app.close()
    }
  })

  test('들여쓰지 않은(본문 없는) 섹션은 그 줄만 옮겨지고 아래 내용은 남는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      const first = edit.locator('.editor-line-textarea').first()
      await first.click()
      await first.fill('제목')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('배너')
      await edit.keyboard.press('Control+`')
      await edit.waitForTimeout(150)
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 1')
      // 타이틀에서 Shift+Enter 로 만든 줄은 자동으로 들여써지므로, 섹션에 포함되지
      // 않게 하려면 Shift+Tab 으로 다시 타이틀 레벨까지 내어쓴다
      await edit.keyboard.press('Shift+Tab')
      await edit.keyboard.press('Shift+Enter')
      await edit.keyboard.type('본문 2')
      await edit.waitForTimeout(300)
      expect(await lineValues(edit)).toEqual(['제목', '배너', '본문 1', '본문 2'])

      const lastLineBox = await edit.locator('.editor-line-textarea').last().boundingBox()
      if (!lastLineBox) throw new Error('no box')
      await dragHandleTo(edit, 0, lastLineBox)

      expect(await lineValues(edit)).toEqual(['제목', '본문 1', '본문 2', '배너'])
    } finally {
      await app.close()
    }
  })

  test('자기 자신 범위 안으로 드롭하면 이동하지 않는다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await setupTwoSections(edit)
      const before = await lineValues(edit)

      const bodyLineBox = await edit.locator('.editor-line-textarea').nth(2).boundingBox()
      if (!bodyLineBox) throw new Error('no box')
      // 섹션 A(index 0) 손잡이를 자기 본문(A 본문 1) 위로 드래그 — 자기 범위 안이라 이동 없음
      await dragHandleTo(edit, 0, bodyLineBox)

      expect(await lineValues(edit)).toEqual(before)
    } finally {
      await app.close()
    }
  })
})
