import { join } from 'path'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

export type SnapRendererPage = 'index' | 'folded' | 'edit' | 'preview' | 'history' | 'settings'

/**
 * electron-vite dev: `ELECTRON_RENDERER_URL` + `/page.html`
 * prod: `out/renderer/page.html` + optional `loadFile` hash
 */
export function loadSnapRenderer(win: BrowserWindow, page: SnapRendererPage, hash = ''): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl) {
    const base = devUrl.replace(/\/$/, '')
    const frag = hash ? `#${hash}` : ''
    void win.loadURL(`${base}/${page}.html${frag}`)
    return
  }
  const file = join(__dirname, `../renderer/${page}.html`)
  if (hash) {
    void win.loadFile(file, { hash })
  } else {
    void win.loadFile(file)
  }
}
