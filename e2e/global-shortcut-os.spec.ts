import { existsSync } from 'node:fs'
import { test } from '@playwright/test'
import {
  e2eToggleFoldedFromMain,
  expectFoldedVisibility,
  launchSnapNote,
  mainScript,
  waitForPage
} from './helpers'

/**
 * OS 전역 단축키(Ctrl+Shift+M) 실동작 시험. 합성 키가 OS에 전달되지 않으면 실패할 수 있음.
 *
 * 로컬 Windows:
 *   npm run build
 *   $env:SNAPNOTE_RUN_OS_SHORTCUT_E2E='1'; npx playwright test e2e/global-shortcut-os.spec.ts
 */
test.describe('OS 전역 단축키 (선택)', () => {
  test('Ctrl+Shift+M 로 폴디드 토글 + 메인 훅으로 복귀', async ({}, testInfo) => {
    testInfo.skip(
      process.env.SNAPNOTE_RUN_OS_SHORTCUT_E2E !== '1',
      'SNAPNOTE_RUN_OS_SHORTCUT_E2E=1 일 때만 실행'
    )
    if (!existsSync(mainScript)) {
      throw new Error('먼저 npm run build 로 out/main/index.js 를 만드세요.')
    }

    const app = await launchSnapNote()
    try {
      await waitForPage(app, 'folded.html')
      await expectFoldedVisibility(app, true)

      const folded = await waitForPage(app, 'folded.html')
      await folded.bringToFront()
      await folded.focus()
      await folded.press('Control+Shift+M')
      await expectFoldedVisibility(app, false)

      await folded.bringToFront()
      await folded.focus()
      await folded.press('Control+Shift+M')
      await expectFoldedVisibility(app, true)

      await e2eToggleFoldedFromMain(app)
      await expectFoldedVisibility(app, false)
    } finally {
      await app.close()
    }
  })
})
