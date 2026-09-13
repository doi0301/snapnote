/**
 * P7-C — 이미 구조적으로 굵은 줄에 볼드를 걸어도 굵기가 달라지지 않아야 한다.
 *
 * 본문에서 볼드는 `font-weight` 가 아니라 faux-bold(`text-shadow`)로 표현된다.
 * H1·H2 는 줄 자체가 이미 `font-weight: 700` 인데 볼드 span 에 그 그림자까지 덧발려
 * 주변 글자보다 두꺼워졌다. 섹션 타이틀은 반대로 `.inline-bold` 의 기본 400 이 제목의
 * 700 을 덮어 더 얇아졌다.
 *
 * 어느 쪽이든 기준은 같다 — 볼드 span 이 같은 줄의 다른 글자와 똑같이 보여야 한다.
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

type SpanStyle = { weight: string; shadow: string }

/**
 * 첫 줄에 글자를 넣고 앞 4글자만 볼드로 만든 뒤 `apply` 단축키로 위계/섹션을 적용한다.
 * (볼드를 먼저 걸고 위계를 나중에 거는 순서가 이 버그가 나는 경로다)
 */
async function boldThenApply(
  page: Page,
  apply: string | null
): Promise<{ bold: SpanStyle; plain: SpanStyle }> {
  const ta = page.locator('.editor-line-textarea').first()
  await ta.click()
  await ta.fill('굵게볼드 나머지')
  await page.waitForTimeout(150)

  await page.evaluate(() => {
    const t = document.querySelectorAll('.editor-line-textarea')[0] as HTMLTextAreaElement
    t.focus()
    t.setSelectionRange(0, 4)
  })
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(200)

  if (apply) {
    await page.keyboard.press(apply)
    await page.waitForTimeout(250)
  }

  return page.evaluate(() => {
    const mirror = document.querySelectorAll('.editor-line')[0]!.querySelector(
      '.editor-line-mirror'
    ) as HTMLElement
    const boldEl = mirror.querySelector('.inline-bold') as HTMLElement
    const plainEl = Array.from(mirror.querySelectorAll('span')).find(
      (s) => !s.classList.contains('inline-bold')
    ) as HTMLElement
    const read = (el: HTMLElement): { weight: string; shadow: string } => {
      const cs = getComputedStyle(el)
      return { weight: cs.fontWeight, shadow: cs.textShadow }
    }
    return { bold: read(boldEl), plain: read(plainEl) }
  })
}

test.describe('구조적으로 굵은 줄의 볼드 (P7-C)', () => {
  for (const [name, key] of [
    ['H1', 'Control+1'],
    ['H2', 'Control+2'],
    ['섹션 타이틀', 'Control+`']
  ] as [string, string][]) {
    test(`${name} 에서는 볼드 span 이 주변 글자와 똑같이 보인다`, async () => {
      const app = await launchSnapNote()
      try {
        const edit = await newEditWindow(app)
        const { bold, plain } = await boldThenApply(edit, key)
        expect(bold.weight).toBe(plain.weight)
        expect(bold.shadow).toBe(plain.shadow)
      } finally {
        await app.close()
      }
    })
  }

  test('위계 없는 본문에서는 볼드가 그대로 faux-bold 로 보인다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      const { bold, plain } = await boldThenApply(edit, null)
      expect(bold.shadow).not.toBe(plain.shadow)
      expect(bold.shadow).not.toBe('none')
    } finally {
      await app.close()
    }
  })
})
