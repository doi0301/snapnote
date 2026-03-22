import { ElectronAPI } from '@electron-toolkit/preload'
import type { SnapnotePreloadAPI } from '@shared/snapnote-api'

declare global {
  interface Window {
    electron: ElectronAPI
    snapnote: SnapnotePreloadAPI
  }
}

export {}
