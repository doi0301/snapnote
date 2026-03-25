import { Menu, app } from 'electron'

/**
 * 메뉴바는 autoHide이지만, Edit 역할(undo/redo/cut/copy/paste)을 등록해야
 * Windows 등에서 Ctrl+Z/X/C/V가 렌더러 입력에 안정적으로 전달된다.
 */
export function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin'

  const editSubmenu: Electron.MenuItemConstructorOptions[] = [
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { role: 'pasteAndMatchStyle' },
    { type: 'separator' },
    { role: 'selectAll' }
  ]

  const template: Electron.MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        },
        {
          label: 'Edit',
          submenu: editSubmenu
        }
      ]
    : [
        {
          label: 'Edit',
          submenu: editSubmenu
        }
      ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
