import { Menu, nativeImage, Tray } from 'electron'

export interface TrayManagerActions {
  toggleFolded: () => void
  showFolded: () => void
  newMemo: () => void
  openHistory: () => void
  openSettings: () => void
  quit: () => void
}

/** 시스템 트레이 (S2-03) */
export class TrayManager {
  private tray: Tray | null = null

  constructor(private readonly actions: TrayManagerActions) {}

  init(iconPath: string): void {
    if (this.tray) return
    let img = nativeImage.createFromPath(iconPath)
    if (img.isEmpty()) {
      img = nativeImage.createEmpty()
    } else {
      img = img.resize({ width: 16, height: 16 })
    }
    this.tray = new Tray(img)
    this.tray.setToolTip('SnapNote')

    this.tray.on('click', () => {
      this.actions.toggleFolded()
    })

    const menu = Menu.buildFromTemplate([
      { label: 'Show SnapNote', click: () => this.actions.showFolded() },
      { label: 'New Memo', click: () => this.actions.newMemo() },
      { type: 'separator' },
      { label: 'History', click: () => this.actions.openHistory() },
      { label: 'Settings', click: () => this.actions.openSettings() },
      { type: 'separator' },
      { label: 'Quit', click: () => this.actions.quit() }
    ])
    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
