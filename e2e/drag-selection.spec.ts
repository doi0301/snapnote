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

/** 각 줄 mirror 에서 선택 표시(.inline-selected)된 텍스트를 줄 순서대로 수집 */
async function selectedTextPerLine(edit: Page): Promise<string[]> {
  return edit.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.editor-line'))
    return rows.map((row) =>
      Array.from(row.querySelectorAll('.editor-line-mirror .inline-selected'))
        .map((el) => el.textContent ?? '')
        .join('')
    )
  })
}

async function setupThreeLines(edit: Page): Promise<void> {
  const first = edit.locator('.editor-line-textarea').first()
  await first.click()
  await edit.keyboard.type('alpha bravo charlie delta')
  await edit.keyboard.press('Shift+Enter')
  await edit.keyboard.type('echo foxtrot golf hotel')
  await edit.keyboard.press('Shift+Enter')
  await edit.keyboard.type('india juliet kilo lima')
  await expect(edit.locator('.editor-line-textarea')).toHaveCount(3)
}

test.describe('드래그 선택 정밀도', () => {
  test('아래 방향 드래그: 선택 끝이 커서가 있는 줄까지 도달한다', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      await setupThreeLines(edit)

      const boxA = await edit.locator('.editor-line-textarea').nth(0).boundingBox()
      const boxC = await edit.locator('.editor-line-textarea').nth(2).boundingBox()
      if (!boxA || !boxC) throw new Error('bounding box 없음')

      // 줄0 중간 → 줄2 중앙까지 아래로 드래그 (버튼 누른 채)
      const startX = boxA.x + 40
      const startY = boxA.y + boxA.height / 2
      const endX = boxC.x + boxC.width / 2
      const endY = boxC.y + boxC.height / 2
      await edit.mouse.move(startX, startY)
      await edit.mouse.down()
      for (let i = 1; i <= 10; i++) {
        await edit.mouse.move(
          startX + ((endX - startX) * i) / 10,
          startY + ((endY - startY) * i) / 10
        )
        await edit.waitForTimeout(30)
      }
      await edit.waitForTimeout(150)

      const during = await selectedTextPerLine(edit)
      // 커서가 줄2 중앙에 있으므로 줄2에도 선택이 있어야 하고 줄1은 전체 선택
      expect(during[1]).toBe('echo foxtrot golf hotel')
      expect((during[2] ?? '').length).toBeGreaterThan(0)

      await edit.mouse.up()
      await edit.waitForTimeout(150)
      const after = await selectedTextPerLine(edit)
      expect(after[1]).toBe('echo foxtrot golf hotel')
      expect((after[2] ?? '').length).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })

  test('위 방향 드래그: 선택 끝이 커서가 있는 줄까지 도달한다', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      await setupThreeLines(edit)

      const boxA = await edit.locator('.editor-line-textarea').nth(0).boundingBox()
      const boxC = await edit.locator('.editor-line-textarea').nth(2).boundingBox()
      if (!boxA || !boxC) throw new Error('bounding box 없음')

      const startX = boxC.x + 60
      const startY = boxC.y + boxC.height / 2
      // 줄0 텍스트("alpha bravo charlie delta")의 안쪽을 가리켜야 함 — 끝보다 오른쪽이면 줄 끝 스냅이 정답
      const endX = boxA.x + 100
      const endY = boxA.y + boxA.height / 2
      await edit.mouse.move(startX, startY)
      await edit.mouse.down()
      for (let i = 1; i <= 10; i++) {
        await edit.mouse.move(
          startX + ((endX - startX) * i) / 10,
          startY + ((endY - startY) * i) / 10
        )
        await edit.waitForTimeout(30)
      }
      await edit.waitForTimeout(150)

      const during = await selectedTextPerLine(edit)
      expect(during[1]).toBe('echo foxtrot golf hotel')
      expect((during[0] ?? '').length).toBeGreaterThan(0)

      await edit.mouse.up()
      await edit.waitForTimeout(150)
      const after = await selectedTextPerLine(edit)
      expect(after[1]).toBe('echo foxtrot golf hotel')
      expect((after[0] ?? '').length).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })

  test('아래 방향 드래그 정밀도: 포인터 X 위치와 선택 끝 오프셋이 일치한다', async () => {
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      await setupThreeLines(edit)

      const boxA = await edit.locator('.editor-line-textarea').nth(0).boundingBox()
      const boxC = await edit.locator('.editor-line-textarea').nth(2).boundingBox()
      if (!boxA || !boxC) throw new Error('bounding box 없음')

      // 줄2의 "kilo" 시작 글자 위치를 mirror rect 로 구해 그 지점까지 드래그
      const target = await edit.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.editor-line'))
        const mirror = rows[2]?.querySelector('.editor-line-mirror')
        if (!mirror) return null
        const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT)
        let acc = ''
        let node: Text | null = null
        while (walker.nextNode()) {
          node = walker.currentNode as Text
          acc += node.nodeValue ?? ''
        }
        const full = 'india juliet kilo lima'
        const idx = full.indexOf('kilo')
        // 오프셋 idx 위치의 caret rect
        let remaining = idx
        const walker2 = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT)
        while (walker2.nextNode()) {
          const n = walker2.currentNode as Text
          const len = n.nodeValue?.length ?? 0
          if (remaining <= len) {
            const r = document.createRange()
            r.setStart(n, remaining)
            r.setEnd(n, Math.min(remaining + 1, len))
            const rect = r.getBoundingClientRect()
            return { x: rect.left, y: rect.top + rect.height / 2, idx, acc }
          }
          remaining -= len
        }
        return null
      })
      if (!target) throw new Error('타깃 좌표 계산 실패')

      const startX = boxA.x + 40
      const startY = boxA.y + boxA.height / 2
      await edit.mouse.move(startX, startY)
      await edit.mouse.down()
      for (let i = 1; i <= 10; i++) {
        await edit.mouse.move(
          startX + ((target.x - startX) * i) / 10,
          startY + ((target.y - startY) * i) / 10
        )
        await edit.waitForTimeout(30)
      }
      await edit.waitForTimeout(150)
      await edit.mouse.up()
      await edit.waitForTimeout(150)

      const after = await selectedTextPerLine(edit)
      // 선택 끝은 "kilo" 직전(±1 글자 허용)
      const sel2 = after[2] ?? ''
      expect(sel2.length).toBeGreaterThanOrEqual(target.idx - 1)
      expect(sel2.length).toBeLessThanOrEqual(target.idx + 1)
      expect('india juliet kilo lima'.startsWith(sel2)).toBe(true)
    } finally {
      await app.close()
    }
  })
})
