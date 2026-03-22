import path from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { _electron as electron } from 'playwright'

const rootDir = process.cwd()
export const mainScript = path.join(rootDir, 'out/main/index.js')

export async function launchSnapNote(
  envOverrides: Record<string, string> = {}
): Promise<ElectronApplication> {
  return electron.launch({
    args: [mainScript],
    cwd: rootDir,
    env: {
      ...process.env,
      SNAPNOTE_E2E: '1',
      SNAPNOTE_DISABLE_AUTO_UPDATE: '1',
      ...envOverrides
    }
  })
}

function urlLooksLike(page: Page, part: string): boolean {
  try {
    return page.url().includes(part)
  } catch {
    return false
  }
}

export async function waitForPage(
  app: ElectronApplication,
  urlPart: string,
  timeoutMs = 45_000
): Promise<Page> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      if (urlLooksLike(w, urlPart)) return w
    }
    await new Promise((r) => setTimeout(r, 120))
  }
  throw new Error(`Timed out waiting for window containing "${urlPart}"`)
}

export function countWindowsMatching(app: ElectronApplication, urlPart: string): number {
  return app.windows().filter((w) => urlLooksLike(w, urlPart)).length
}

/** 폴디드 `BrowserWindow` 가 OS 기준 보이는지 (전역 단축키 토글 검증용) */
export async function isFoldedPanelBrowserVisible(app: ElectronApplication): Promise<boolean> {
  return app.evaluate(({ BrowserWindow }) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      try {
        const u = win.webContents.getURL()
        if (u.includes('folded.html')) {
          return win.isVisible()
        }
      } catch {
        /* URL 미준비 */
      }
    }
    return false
  })
}

export async function e2eToggleFoldedFromMain(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    const g = globalThis as unknown as { __snapnoteE2E?: { toggleFolded: () => void } }
    g.__snapnoteE2E?.toggleFolded()
  })
}

/** 토글 후 `visible` 이 될 때까지 폴링 */
export async function expectFoldedVisibility(
  app: ElectronApplication,
  visible: boolean,
  timeoutMs = 10_000
): Promise<void> {
  await expect
    .poll(async () => isFoldedPanelBrowserVisible(app), { timeout: timeoutMs })
    .toBe(visible)
}
