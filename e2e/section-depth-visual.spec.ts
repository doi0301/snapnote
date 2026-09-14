/**
 * P7-E — 하위 섹션은 화면에서도 하위로 보여야 한다.
 *
 * 중첩 섹션은 P6 T1 이후 데이터 모델에서 가능해졌지만 화면에는 표시가 없었다.
 * 섹션 타이틀 배경이 행 전체에 깔리고 거터는 `transparent` 라, 들여쓴 섹션도 색 바가
 * 똑같이 맨 왼쪽부터 시작해 깊이가 보이지 않았다.
 *
 * 기준 세 가지다.
 *  - 색 바는 들여쓴 만큼(거터 폭만큼) 안쪽에서 시작한다
 *  - 드러난 거터에는 본문 줄과 같은 들여쓰기 음영이 보인다 — 그래야 '부모 안'으로 읽힌다
 *  - 타이틀 글자는 깊이마다 한 단계 작아지되 본문 크기(14px)에서 멈춘다
 *
 * 주의: **첫 줄은 sticky 타이틀이라 배경 규칙이 다르다.** `editor.css` 의
 * `.editor-line--sticky-title` 이 같은 특이도로 더 나중에 로드돼 섹션 배경을 덮는다
 * (이 스펙의 변경과 무관한 기존 동작이다). 그래서 섹션 사다리는 둘째 줄부터 쌓는다.
 */
import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { launchSnapNote, mainScript, waitForPage } from './helpers'

/** `EditorLine.tsx` 의 `INDENT_PX` 와 같은 값 */
const INDENT_PX = 20

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

/** 첫 줄에 평범한 제목을 넣는다 (sticky 타이틀 자리를 비켜 주려고) */
async function typeFirstLine(page: Page): Promise<void> {
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('메모 제목')
  await expect(page.locator('.editor-line')).toHaveCount(1)
}

/**
 * 둘째 줄부터 섹션을 한 단씩 깊게 쌓는다 — 섹션 타이틀 뒤에서 Shift+Enter 를 누르면
 * 새 칸이 한 단 깊게 들어가므로 추가 Tab 없이 Ctrl+` 만 눌러도 사다리가 된다.
 *
 * 줄 수를 단계마다 기다려, 타이핑이 밀려 엉뚱한 줄에 섹션이 걸리는 걸 막는다.
 */
async function buildSectionLadder(page: Page, names: string[]): Promise<void> {
  await typeFirstLine(page)
  for (const [i, name] of names.entries()) {
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.type(name)
    await page.keyboard.press('Control+`')
    await expect(page.locator('.editor-line')).toHaveCount(i + 2)
    await page.waitForTimeout(150)
  }
}

type RowVisual = {
  level: number
  fontSize: string
  gutterBackground: string
  backgroundImage: string
}

function rowVisuals(page: Page): Promise<RowVisual[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.editor-line')).map((row) => {
      const ta = row.querySelector('.editor-line-textarea') as HTMLElement
      const gutter = row.querySelector('.editor-line-gutter') as HTMLElement
      const levelClass = Array.from(row.classList).find((c) => c.startsWith('editor-line--level-'))
      return {
        level: levelClass ? Number(levelClass.replace('editor-line--level-', '')) : 0,
        fontSize: getComputedStyle(ta).fontSize,
        gutterBackground: getComputedStyle(gutter).backgroundColor,
        backgroundImage: getComputedStyle(row).backgroundImage
      }
    })
  )
}

/** `calc(1 * 20px)` 처럼 미해결 calc 로 직렬화돼도 px 로 읽는다 */
function toPx(token: string): number {
  const trimmed = token.trim()
  const calc = trimmed.match(/^calc\(\s*([\d.]+)\s*\*\s*([\d.]+)px\s*\)$/)
  if (calc) return Number(calc[1]) * Number(calc[2])
  const plain = trimmed.match(/^([\d.]+)px$/)
  if (plain) return Number(plain[1])
  throw new Error(`색 정지점을 px 로 해석할 수 없습니다: ${JSON.stringify(token)}`)
}

/**
 * 섹션 색이 어디서 시작하는지 — 투명 정지점 뒤에 오는 오프셋.
 * 투명은 `rgba(0, 0, 0, 0)` 으로 직렬화된다.
 */
function colorStartPx(backgroundImage: string): number {
  const m = backgroundImage.match(/rgba\(0,\s*0,\s*0,\s*0\)\s+([^,)]+)[,)]/)
  if (!m) {
    throw new Error(
      `섹션 배경이 인셋 그라디언트가 아닙니다 — 색 바가 행 전체를 채우고 있습니다: ${backgroundImage}`
    )
  }
  return toPx(m[1])
}

test.describe('하위 섹션 위계 시각화 (P7-E)', () => {
  test('색 바가 들여쓴 만큼 안쪽에서 시작한다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await buildSectionLadder(edit, ['섹션 A', '섹션 B', '섹션 C', '섹션 D'])

      const sections = (await rowVisuals(edit)).slice(1)
      expect(sections.map((r) => r.level)).toEqual([0, 1, 2, 3])

      for (const row of sections) {
        expect(colorStartPx(row.backgroundImage)).toBe(row.level * INDENT_PX)
      }
    } finally {
      await app.close()
    }
  })

  test('깊어질 때마다 타이틀 글자가 한 단계 작아지고 본문 크기에서 멈춘다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await buildSectionLadder(edit, ['섹션 A', '섹션 B', '섹션 C', '섹션 D'])

      const sections = (await rowVisuals(edit)).slice(1)
      expect(sections.map((r) => r.fontSize)).toEqual(['16px', '15px', '14px', '14px'])
    } finally {
      await app.close()
    }
  })

  test('하위 섹션에서는 드러난 거터에 들여쓰기 음영이 보인다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await buildSectionLadder(edit, ['섹션 A', '섹션 B'])

      const sections = (await rowVisuals(edit)).slice(1)
      expect(sections.map((r) => r.level)).toEqual([0, 1])
      // 하위 섹션의 거터는 본문 줄과 같은 음영을 받는다 (예전엔 transparent 로 눌려 있었다)
      expect(sections[1].gutterBackground).not.toBe('rgba(0, 0, 0, 0)')
    } finally {
      await app.close()
    }
  })

  test('최상위 섹션은 이전과 똑같이 행 전체를 채운다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await buildSectionLadder(edit, ['섹션 A'])

      const [section] = (await rowVisuals(edit)).slice(1)
      expect(section.level).toBe(0)
      expect(colorStartPx(section.backgroundImage)).toBe(0)
      expect(section.fontSize).toBe('16px')
    } finally {
      await app.close()
    }
  })

  test('색을 고른 하위 섹션도 안쪽에서 시작한다', async () => {
    const app = await launchSnapNote()
    try {
      const edit = await newEditWindow(app)
      await buildSectionLadder(edit, ['섹션 A', '섹션 B'])

      const child = edit.locator('.editor-line').nth(2)
      await child.locator('.editor-section-color-btn').click()
      await child.locator('.format-hl-swatch--green').click()
      await edit.waitForTimeout(250)

      const sections = (await rowVisuals(edit)).slice(1)
      expect(sections[1].level).toBe(1)
      expect(colorStartPx(sections[1].backgroundImage)).toBe(INDENT_PX)
    } finally {
      await app.close()
    }
  })
})
