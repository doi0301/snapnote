import { globalShortcut } from 'electron'
import type { Settings } from '@shared/types'

const DEFAULT_TOGGLE = 'CommandOrControl+Shift+M'

/**
 * S4-05: OS 전역 단축키 — 폴디드 패널 표시/숨김 (설정의 `globalShortcut`)
 */
export class GlobalShortcutService {
  constructor(private readonly onToggleFolded: () => void) {}

  /** 설정의 accelerator로 등록. 실패 시 기본값으로 한 번 더 시도 */
  syncFromSettings(settings: Settings): void {
    globalShortcut.unregisterAll()
    const raw = (settings.globalShortcut ?? '').trim() || DEFAULT_TOGGLE
    if (!this.tryRegister(raw)) {
      console.warn(`[SnapNote] globalShortcut register failed: "${raw}", fallback ${DEFAULT_TOGGLE}`)
      if (raw !== DEFAULT_TOGGLE) {
        this.tryRegister(DEFAULT_TOGGLE)
      }
    }
  }

  dispose(): void {
    globalShortcut.unregisterAll()
  }

  private tryRegister(accelerator: string): boolean {
    try {
      if (!accelerator) return false
      return globalShortcut.register(accelerator, () => this.onToggleFolded())
    } catch (err) {
      console.warn('[SnapNote] globalShortcut.register error:', accelerator, err)
      return false
    }
  }
}
