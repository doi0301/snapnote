import { createHash } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { clipboard } from 'electron'
import type { ClipboardItem } from '@shared/types'
import { ClipboardRepository } from './repositories/ClipboardRepository'

const POLL_MS = 500

export interface ClipboardServiceOptions {
  repo: ClipboardRepository
  /** 현재 설정 (폴링 틱마다도 확인해 즉시 OFF 반영) */
  getSettings: () => { clipboardMonitoring: boolean }
  onItemAdded: (item: ClipboardItem) => void
  /** PNG 히스토리 파일 저장 디렉터리 */
  getImageDir: () => string
}

/**
 * S4-02: 시스템 클립보드 500ms 폴링
 * - 텍스트: readText() → 히스토리
 * - 이미지: readImage() 비어 있지 않으면 PNG 저장 + 히스토리 (표시용 텍스트는 파일명/클립보드 텍스트)
 */
export class ClipboardService {
  private readonly repo: ClipboardRepository
  private readonly getSettings: () => { clipboardMonitoring: boolean }
  private readonly onItemAdded: (item: ClipboardItem) => void
  private readonly getImageDir: () => string
  private timer: ReturnType<typeof setInterval> | null = null
  private lastTextSnapshot = ''
  private lastImageHash = ''

  constructor(opts: ClipboardServiceOptions) {
    this.repo = opts.repo
    this.getSettings = opts.getSettings
    this.onItemAdded = opts.onItemAdded
    this.getImageDir = opts.getImageDir
  }

  syncWithSettings(): void {
    if (this.getSettings().clipboardMonitoring) {
      this.start()
    } else {
      this.stop()
    }
  }

  start(): void {
    if (this.timer) return
    this.primeSnapshots()
    this.timer = setInterval(() => this.tick(), POLL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private primeSnapshots(): void {
    try {
      this.lastTextSnapshot = clipboard.readText()
    } catch {
      this.lastTextSnapshot = ''
    }
    this.lastImageHash = this.computeClipboardImageHash()
  }

  private computeClipboardImageHash(): string {
    try {
      const img = clipboard.readImage()
      if (img.isEmpty()) return ''
      return createHash('sha256').update(img.toPNG()).digest('hex')
    } catch {
      return ''
    }
  }

  /** 클립보드에 텍스트가 있으면 파일명·설명 후보로 사용 */
  private makeImageDisplayLabel(): string {
    let t = ''
    try {
      t = clipboard.readText().trim()
    } catch {
      return '[이미지]'
    }
    if (t.length > 0 && t.length <= 240) {
      if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(t) || t.includes('\\') || t.includes('/')) {
        const seg = t.split(/[/\\]/).filter(Boolean)
        const base = seg[seg.length - 1] ?? t
        return base.slice(0, 160) || '[이미지]'
      }
      return t.slice(0, 160)
    }
    return '[이미지]'
  }

  private tick(): void {
    if (!this.getSettings().clipboardMonitoring) {
      this.stop()
      return
    }

    let img: Electron.NativeImage | null = null
    try {
      img = clipboard.readImage()
    } catch {
      img = null
    }

    if (img && !img.isEmpty()) {
      const png = img.toPNG()
      const hash = createHash('sha256').update(png).digest('hex')
      if (hash !== this.lastImageHash) {
        this.lastImageHash = hash
        const dir = this.getImageDir()
        try {
          mkdirSync(dir, { recursive: true })
          const fname = `${hash.slice(0, 16)}-${Date.now()}.png`
          writeFileSync(join(dir, fname), png)
          const label = this.makeImageDisplayLabel()
          const item = this.repo.addImageItem(label, fname)
          if (item) this.onItemAdded(item)
        } catch (err) {
          console.error('[SnapNote] Clipboard image save failed:', err)
        }
      }
    }
    /* 이미지가 비어도 lastImageHash 유지 — OS가 텍스트 복사 후에도 비트맵을 남기는 경우 오인 저장 방지 */

    let text: string
    try {
      text = clipboard.readText()
    } catch {
      return
    }
    if (text === this.lastTextSnapshot) return
    this.lastTextSnapshot = text
    if (!text) return
    const item = this.repo.addItem(text)
    if (item) this.onItemAdded(item)
  }
}
