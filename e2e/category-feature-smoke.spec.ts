import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { e2eOpenSettingsFromMain, launchSnapNote, mainScript, waitForPage } from './helpers'

test.beforeAll(() => {
  if (!existsSync(mainScript)) {
    throw new Error(
      '빌드 산출물이 없습니다. E2E 전에 `npm run build` 를 실행하세요. (기대 경로: out/main/index.js)'
    )
  }
})

test.describe('카테고리 기능', () => {
  test('설정에서 카테고리 추가 → 편집창 드롭다운 선택 → 히스토리 필터 적용', async () => {
    const categoryName = `e2e카테고리${Date.now()}`
    const app = await launchSnapNote()
    try {
      const folded = await waitForPage(app, 'folded.html')
      await folded.getByTestId('folded-new-memo').click()
      const edit = await waitForPage(app, 'edit.html')
      const ta = edit.locator('.editor-line-textarea').first()
      await ta.click()
      await ta.fill('e2e-category-memo')

      // 초기: 카테고리 드롭다운은 "카테고리 없음" 단일 옵션
      const picker = edit.locator('.category-picker')
      await expect(picker).toBeVisible()
      await expect(picker).toHaveValue('')

      // 설정 창 열고 카테고리 추가
      await e2eOpenSettingsFromMain(app)
      const settings = await waitForPage(app, 'settings.html')
      await expect(settings.getByRole('heading', { name: '설정' })).toBeVisible()
      await settings.getByLabel('새 카테고리 이름').fill(categoryName)
      await settings.getByRole('button', { name: '추가' }).click()
      await expect(settings.getByLabel(`${categoryName} 카테고리 이름`)).toHaveValue(categoryName)

      // 편집창으로 돌아가 드롭다운에 새 카테고리가 반영됐는지 확인 후 선택
      await edit.bringToFront()
      await expect(picker.getByRole('option', { name: categoryName })).toBeAttached({
        timeout: 10_000
      })
      await picker.selectOption({ label: categoryName })
      await expect(picker).not.toHaveValue('')

      // 히스토리에서 카테고리 필터 칩이 보이고 선택 시 목록이 유지되는지 확인
      await folded.bringToFront()
      await folded.getByTestId('folded-history').click()
      const history = await waitForPage(app, 'history.html')
      await expect(history.getByText('e2e-category-memo')).toBeVisible()
      const categoryFilterGroup = history.getByRole('group', { name: '카테고리 선택' })
      await expect(categoryFilterGroup).toBeVisible()
      await categoryFilterGroup.getByRole('button', { name: categoryName, exact: true }).click()
      await expect(history.getByText('e2e-category-memo')).toBeVisible()

      // 다른 카테고리로 필터링하면(존재하지 않는 상태) 목록에서 사라져야 함 — 전체로 되돌려 확인
      await categoryFilterGroup.getByRole('button', { name: '전체', exact: true }).click()
      await expect(history.getByText('e2e-category-memo')).toBeVisible()
    } finally {
      await app.close()
    }
  })
})
