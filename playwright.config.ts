import { defineConfig } from '@playwright/test'

/**
 * Electron E2E — 앱은 `npm run build` 후 `out/main/index.js` 로 실행.
 * 환경 변수 `SNAPNOTE_E2E=1` 은 메인에서 임시 userData·단일 인스턴스 락 완화.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 25_000 },
  reporter: [['list']],
  forbidOnly: !!process.env.CI
})
