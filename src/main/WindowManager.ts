import { BrowserWindow, screen, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { memoHasTextContent } from '@shared/memoContent'
import type { FoldedPreviewAnchor, MemoId } from '@shared/types'
import { MemoRepository } from './repositories/MemoRepository'
import { SettingsRepository } from './repositories/SettingsRepository'
import { isAppQuitting } from './appLifecycle'
import { loadSnapRenderer } from './rendererLoad'
import {
  computeEditWindowSnapPosition,
  computeSnappedPosition,
  SNAP_SCREEN_EDGE_PX
} from './utils/edgeSnap'
import { editWindowChromeHex } from '@shared/memoChrome'

const FOLDED_WIDTH = 320
/** 최초 생성 시 높이; 이후 렌더러 측정값으로 `setContentSize` */
const FOLDED_HEIGHT = 220
/** `.folded-root` 기준 클라이언트 높이 클램프 (DIP) */
const FOLDED_CONTENT_MIN_H = 132
const FOLDED_CONTENT_MAX_H = 360
const PREVIEW_WIDTH = 300
const PREVIEW_HEIGHT = 200
const EDIT_MIN_W = 300
const EDIT_MIN_H = 350

/**
 * Windows/macOS: `alwaysOnTop`만 쓰면 폴디드·프리뷰·편집이 같은 층이라 포커스에 따라 가려짐.
 * `floating` + `relativeLevel`로 층을 고정한다 (Electron: Windows는 floating에서만 relativeLevel).
 */
const Z_FOLDED_FLOATING = 0
const Z_PREVIEW_FLOATING = 1
/** 고정 편집창은 프리뷰·폴디드보다 위; 여러 개면 pinnedAt 오름차순 = 아래, 최근 고정이 더 큰 relativeLevel */
const Z_PINNED_EDIT_BASE = 10

/** 폴디드 패널 가장자리에 붙일 때 간격(px) */
const PREVIEW_GAP = 4

type WinBounds = { x: number; y: number; width: number; height: number }

function clampPreviewTopLeft(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const wa = screen.getDisplayNearestPoint({ x: Math.floor(x + width / 2), y: Math.floor(y + height / 2) }).workArea
  let nx = x
  let ny = y
  if (nx + width > wa.x + wa.width) nx = wa.x + wa.width - width
  if (ny + height > wa.y + wa.height) ny = wa.y + wa.height - height
  if (nx < wa.x) nx = wa.x
  if (ny < wa.y) ny = wa.y
  return { x: nx, y: ny }
}

export interface WindowManagerDeps {
  memos: MemoRepository
  settings: SettingsRepository
  broadcast: (channel: string, ...args: unknown[]) => void
  /** Ctrl/Cmd+N — 새 메모 + 편집 창 */
  onNewMemoFromShortcut: () => void
  /** Ctrl/Cmd+H — 히스토리 창 */
  onOpenHistoryFromShortcut: () => void
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

export class WindowManager {
  /** `init()` / `registerIpcHandlers` 중복 호출 시 폴디드 이중 생성 방지 */
  private foldedBootstrapDone = false
  private readonly editBoundsDebouncers = new Map<MemoId, ReturnType<typeof debounce>>()
  private foldedPanel: BrowserWindow | null = null
  private readonly editWindows = new Map<MemoId, BrowserWindow>()
  private previewWindow: BrowserWindow | null = null
  private previewMemoId: MemoId | null = null
  private previewHideTimer: ReturnType<typeof setTimeout> | null = null
  private historyWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null

  /**
   * 클립보드 삽입 대상 — 해당 메모의 편집 창 (`pasteClipboardToEdit`에서 사용, TASK-S5-04).
   * TASK 문서의 lastFocusedEditWindowId와 동일 역할(식별자는 memo id).
   */
  lastFocusedEditMemoId: MemoId | null = null

  /** 편집 창 포커스 순서(오래됨 → 최근). 마지막 = MRU — 닫힐 때 삽입 대상을 남은 창으로 넘기기 위함 */
  private editFocusOrder: MemoId[] = []

  private bumpEditFocusOrder(memoId: MemoId): void {
    const i = this.editFocusOrder.indexOf(memoId)
    if (i >= 0) this.editFocusOrder.splice(i, 1)
    this.editFocusOrder.push(memoId)
  }

  private readonly persistFoldedPosition = debounce(() => {
    if (!this.foldedPanel || this.foldedPanel.isDestroyed()) return
    const b = this.foldedPanel.getBounds()
    this.deps.settings.updateAppState({ foldedPanelX: b.x, foldedPanelY: b.y })
  }, 500)

  /** TASK-S5-05: 모니터 분리 직후 모든 창이 남은 데스크톱 안에 오도록 보정 */
  private readonly onDisplayRemoved = (): void => {
    this.ensureWindowOnVisibleDesktop(this.foldedPanel)
    for (const w of this.editWindows.values()) {
      this.ensureWindowOnVisibleDesktop(w)
    }
    this.ensureWindowOnVisibleDesktop(this.previewWindow)
    this.ensureWindowOnVisibleDesktop(this.historyWindow)
    this.ensureWindowOnVisibleDesktop(this.settingsWindow)
  }

  constructor(private readonly deps: WindowManagerDeps) {}

  init(): void {
    if (this.foldedBootstrapDone) return
    this.foldedBootstrapDone = true
    screen.on('display-removed', this.onDisplayRemoved)
    const folded = this.createFoldedPanel()
    this.attachInAppKeyboardShortcuts(folded, { type: 'folded' })
  }

  dispose(): void {
    screen.off('display-removed', this.onDisplayRemoved)
  }

  private clampWindowToDisplays(win: BrowserWindow | null): void {
    if (!win || win.isDestroyed()) return
    const b = win.getBounds()
    const areas = screen.getAllDisplays().map((d) => d.workArea)
    if (!areas.length) return
    const minX = Math.min(...areas.map((a) => a.x))
    const minY = Math.min(...areas.map((a) => a.y))
    const maxR = Math.max(...areas.map((a) => a.x + a.width))
    const maxB = Math.max(...areas.map((a) => a.y + a.height))
    let x = b.x
    let y = b.y
    if (x + b.width < minX + 40) x = minX
    if (y + b.height < minY + 40) y = minY
    if (x > maxR - 40) x = maxR - b.width
    if (y > maxB - 40) y = maxB - b.height
    if (x !== b.x || y !== b.y) {
      win.setPosition(x, y)
    }
  }

  /**
   * 남은 디스플레이 작업 영역과 겹치지 않으면(분리된 모니터에만 있던 창) 주 모니터 작업 영역 안으로 옮김.
   * 그 외에는 `clampWindowToDisplays`로 가장자리만 맞춤.
   */
  private ensureWindowOnVisibleDesktop(win: BrowserWindow | null): void {
    if (!win || win.isDestroyed()) return
    const b = win.getBounds()
    const displays = screen.getAllDisplays()
    if (!displays.length) return

    const MIN_VISIBLE_PX = 72
    const intersectsSomeWorkArea = displays.some((d) => {
      const wa = d.workArea
      const left = Math.max(b.x, wa.x)
      const top = Math.max(b.y, wa.y)
      const right = Math.min(b.x + b.width, wa.x + wa.width)
      const bottom = Math.min(b.y + b.height, wa.y + wa.height)
      return right - left >= MIN_VISIBLE_PX && bottom - top >= MIN_VISIBLE_PX
    })

    if (!intersectsSomeWorkArea) {
      const wa = screen.getPrimaryDisplay().workArea
      let nx = wa.x + Math.max(0, Math.floor((wa.width - b.width) / 2))
      let ny = wa.y + Math.max(0, Math.floor((wa.height - b.height) / 2))
      nx = Math.min(nx, wa.x + Math.max(0, wa.width - b.width))
      ny = Math.min(ny, wa.y + Math.max(0, wa.height - b.height))
      win.setPosition(Math.max(wa.x, nx), Math.max(wa.y, ny))
      return
    }

    this.clampWindowToDisplays(win)
  }

  /**
   * 가장자리 스냅은 `will-move`에서 하면 1px 단위 드래그가 매 프레임 다시 붙어
   * 모서리에서 빠져나오지 못하는 문제가 생김 → 드래그가 잠시 멈춘 뒤에만 스냅.
   */
  /**
   * @param editMemoId 있으면 다른 편집 창과 변 스냅(나란히 붙이기·모서리 정렬) 포함
   */
  private attachEdgeSnap(win: BrowserWindow, editMemoId?: MemoId): void {
    if (process.platform !== 'win32' && process.platform !== 'darwin') return
    const applyEdgeSnapAfterMove = debounce(() => {
      if (win.isDestroyed()) return
      const b = win.getBounds()
      const workAreas = screen.getAllDisplays().map((d) => d.workArea)
      const { x, y } =
        editMemoId !== undefined
          ? computeEditWindowSnapPosition(b, workAreas, this.getOtherEditWindowBounds(editMemoId))
          : computeSnappedPosition(b, workAreas, SNAP_SCREEN_EDGE_PX)
      if (x !== b.x || y !== b.y) {
        win.setPosition(x, y)
      }
    }, 120)
    win.on('moved', () => applyEdgeSnapAfterMove())
  }

  private getOtherEditWindowBounds(excludeMemoId: MemoId): WinBounds[] {
    const out: WinBounds[] = []
    for (const [id, w] of this.editWindows) {
      if (id === excludeMemoId || w.isDestroyed()) continue
      out.push(w.getBounds())
    }
    return out
  }

  /**
   * 편집 창이 열린 채로 폴디드에서 ✕·접기 등으로 닫을 때 React `save()`가 안 타는 경우 대비:
   * textarea DOM 값으로 첫 줄을 갱신해 DB에 반영.
   */
  /** 앱 종료 등: 열린 편집 창마다 textarea → DB 반영 */
  async flushAllOpenEditDraftsFromDom(): Promise<void> {
    const ids = [...this.editWindows.keys()]
    for (const id of ids) {
      await this.flushEditMemoDraftFromDom(id)
    }
  }

  /** 모든 메모 삭제 전: 초안 저장·편집 창 닫기·프리뷰 정리 */
  async prepareWipeAllMemos(): Promise<void> {
    await this.flushAllOpenEditDraftsFromDom()
    this.hidePreview()
    for (const id of [...this.editWindows.keys()]) {
      this.closeEditWindowOnly(id)
    }
    this.editFocusOrder = []
    this.lastFocusedEditMemoId = null
  }

  private async flushEditMemoDraftFromDom(memoId: MemoId): Promise<void> {
    const win = this.editWindows.get(memoId)
    if (!win || win.isDestroyed()) return
    try {
      await win.webContents.executeJavaScript(
        `
        (async () => {
          const id = ${JSON.stringify(memoId)};
          const patch = {};
          const el = document.querySelector('.edit-serialized-content');
          if (el && 'value' in el && el.value) {
            try {
              const parsed = JSON.parse(el.value);
              if (Array.isArray(parsed) && parsed.length) {
                patch.content = parsed;
              }
            } catch (_) { /* ignore */ }
          }
          const tagEl = document.querySelector('.edit-tags-serialized');
          if (tagEl && 'value' in tagEl && typeof tagEl.value === 'string') {
            try {
              const tags = JSON.parse(tagEl.value);
              if (Array.isArray(tags)) {
                patch.tags = tags;
              }
            } catch (_) { /* ignore */ }
          }
          if (!patch.content) {
            const ta = document.querySelector('.editor-line-textarea');
            if (!ta || !('value' in ta)) {
              if (Object.keys(patch).length === 0) return;
              await window.snapnote.memo.update({ id, patch });
              return;
            }
            const text = ta.value;
            const memo = await window.snapnote.memo.get(id);
            if (!memo) {
              if (Object.keys(patch).length === 0) return;
              await window.snapnote.memo.update({ id, patch });
              return;
            }
            const lines = memo.content.length
              ? memo.content.map((line, i) => (i === 0 ? { ...line, text } : line))
              : [{
                  id: crypto.randomUUID(),
                  text,
                  indentLevel: 0,
                  formatting: {}
                }];
            patch.content = lines;
          }
          if (Object.keys(patch).length === 0) return;
          await window.snapnote.memo.update({ id, patch });
        })()
        `,
        true
      )
    } catch (err) {
      console.error('[SnapNote] flushEditMemoDraftFromDom failed:', err)
    }
  }

  private foldedPanelOptions(): BrowserWindowConstructorOptions {
    const st = this.deps.settings.getAppState()
    return {
      width: FOLDED_WIDTH,
      height: FOLDED_HEIGHT,
      x: st.foldedPanelX,
      y: st.foldedPanelY,
      show: false,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      transparent: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    }
  }

  createFoldedPanel(): BrowserWindow {
    if (this.foldedPanel && !this.foldedPanel.isDestroyed()) {
      return this.foldedPanel
    }
    const win = new BrowserWindow(this.foldedPanelOptions())
    this.foldedPanel = win
    win.setAlwaysOnTop(true, 'floating', Z_FOLDED_FLOATING)
    loadSnapRenderer(win, 'folded')

    this.attachEdgeSnap(win)
    win.on('moved', () => this.persistFoldedPosition())
    win.on('close', (e) => {
      if (!isAppQuitting()) {
        e.preventDefault()
        win.hide()
      }
    })

    win.on('ready-to-show', () => {
      win.show()
    })

    return win
  }

  /** 폴디드 전용: 렌더러가 측정한 루트 높이로 클라이언트 영역 맞춤 */
  setFoldedPanelContentHeight(heightPx: number): void {
    const win = this.foldedPanel
    if (!win || win.isDestroyed()) return
    const h = Math.min(
      FOLDED_CONTENT_MAX_H,
      Math.max(FOLDED_CONTENT_MIN_H, Math.round(heightPx))
    )
    try {
      win.setContentSize(FOLDED_WIDTH, h)
    } catch {
      /* ignore */
    }
  }

  toggleFoldedPanel(): void {
    const w = this.createFoldedPanel()
    if (w.isVisible()) {
      this.hideFoldedPanel()
    } else {
      w.show()
      w.focus()
    }
  }

  showFoldedPanel(): void {
    const w = this.createFoldedPanel()
    w.show()
    w.focus()
  }

  /** 헤더 ✕: 패널만 숨김 + 호버 프리뷰 정리 */
  hideFoldedPanel(): void {
    this.hidePreview()
    const w = this.foldedPanel
    if (w && !w.isDestroyed()) {
      w.hide()
    }
  }

  openEditWindow(memoId: MemoId): void {
    const existing = this.editWindows.get(memoId)
    if (existing && !existing.isDestroyed()) {
      existing.show()
      existing.focus()
      return
    }

    if (this.previewMemoId === memoId) {
      this.hidePreview()
    }

    const memo = this.deps.memos.getMemo(memoId)
    if (!memo) return

    const settings = this.deps.settings.getSettings()
    const w = memo.windowWidth || settings.defaultWindowWidth
    const h = memo.windowHeight || settings.defaultWindowHeight
    const x = memo.windowX ?? undefined
    const y = memo.windowY ?? undefined

    const win = new BrowserWindow({
      width: w,
      height: h,
      x: x !== undefined && x !== null ? x : undefined,
      y: y !== undefined && y !== null ? y : undefined,
      minWidth: EDIT_MIN_W,
      minHeight: EDIT_MIN_H,
      show: false,
      frame: false,
      resizable: true,
      thickFrame: true,
      autoHideMenuBar: true,
      /** Win11 라운드 코너·틈에 흰색이 비지 않도록 웹 크롬색과 맞춤 */
      backgroundColor: editWindowChromeHex(memo.color),
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    this.editWindows.set(memoId, win)
    loadSnapRenderer(win, 'edit', memoId)

    this.attachEdgeSnap(win, memoId)

    const scheduleBoundsPersist = this.getEditBoundsPersister(memoId)
    win.on('moved', scheduleBoundsPersist)
    win.on('resized', scheduleBoundsPersist)

    const markEditFocused = (): void => {
      this.bumpEditFocusOrder(memoId)
      this.lastFocusedEditMemoId = memoId
    }
    /** 자동화·일부 환경에서 첫 표시 시 `focus` 없이 `show` 만 올 수 있음 → 클립보드 삽입 대상 추적 */
    win.on('focus', markEditFocused)
    win.on('show', markEditFocused)

    win.on('closed', () => {
      this.editBoundsDebouncers.delete(memoId)
      this.editWindows.delete(memoId)
      const oi = this.editFocusOrder.indexOf(memoId)
      if (oi >= 0) this.editFocusOrder.splice(oi, 1)
      if (this.lastFocusedEditMemoId === memoId) {
        this.lastFocusedEditMemoId = this.editFocusOrder.at(-1) ?? null
      }
    })

    win.on('ready-to-show', () => {
      win.show()
    })

    this.attachInAppKeyboardShortcuts(win, { type: 'edit', memoId })
    this.applyPinnedEditWindowsZOrder()
  }

  /**
   * S4-05: 포커스가 SnapNote 창에 있을 때 Ctrl/Cmd+N·H, 편집 창에서 Esc(접기)
   */
  private attachInAppKeyboardShortcuts(
    win: BrowserWindow,
    ctx: { type: 'folded' | 'history' | 'settings' } | { type: 'edit'; memoId: MemoId }
  ): void {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return

      const cmdOrCtrl = process.platform === 'darwin' ? input.meta : input.control
      if (cmdOrCtrl && !input.alt) {
        const k = input.key.toLowerCase()
        if (k === 'n') {
          event.preventDefault()
          this.deps.onNewMemoFromShortcut()
          return
        }
        if (k === 'h') {
          event.preventDefault()
          this.deps.onOpenHistoryFromShortcut()
          return
        }
      }

      if (
        ctx.type === 'edit' &&
        input.key === 'Escape' &&
        !input.control &&
        !input.meta &&
        !input.alt &&
        !input.shift
      ) {
        event.preventDefault()
        void this.foldEditWindow(ctx.memoId)
      }
    })
  }

  /**
   * 고정되지 않은 편집창은 일반 창으로 두고,
   * 고정된 편집창만 `floating` 상단층에서 pinnedAt 순으로 쌓는다 (최근 고정이 위).
   */
  private applyPinnedEditWindowsZOrder(): void {
    for (const [id, win] of this.editWindows) {
      if (win.isDestroyed()) continue
      const m = this.deps.memos.getMemo(id)
      if (!m?.isPinned) {
        win.setAlwaysOnTop(false)
      }
    }

    const pinned: { memoId: MemoId; pinnedAt: number | null }[] = []
    for (const [memoId, win] of this.editWindows) {
      if (win.isDestroyed()) continue
      const m = this.deps.memos.getMemo(memoId)
      if (m?.isPinned) pinned.push({ memoId, pinnedAt: m.pinnedAt })
    }
    pinned.sort((a, b) => {
      const ta = a.pinnedAt ?? 0
      const tb = b.pinnedAt ?? 0
      if (ta !== tb) return ta - tb
      return a.memoId.localeCompare(b.memoId)
    })
    for (let i = 0; i < pinned.length; i++) {
      const w = this.editWindows.get(pinned[i].memoId)
      if (w && !w.isDestroyed()) {
        w.setAlwaysOnTop(true, 'floating', Z_PINNED_EDIT_BASE + i)
      }
    }
  }

  private getEditBoundsPersister(memoId: MemoId): () => void {
    let fn = this.editBoundsDebouncers.get(memoId)
    if (!fn) {
      fn = debounce(() => {
        const w = this.editWindows.get(memoId)
        if (!w || w.isDestroyed()) return
        const b = w.getBounds()
        try {
          const updated = this.deps.memos.updateMemo(memoId, {
            windowX: b.x,
            windowY: b.y,
            windowWidth: b.width,
            windowHeight: b.height
          })
          this.deps.broadcast(IPC_CHANNELS.MEMO_UPDATED, updated)
        } catch {
          /* 창 닫는 중 등 */
        }
      }, 450)
      this.editBoundsDebouncers.set(memoId, fn)
    }
    return fn
  }

  setEditWindowPinned(memoId: MemoId, pinned: boolean): void {
    const updated = this.deps.memos.updateMemo(memoId, {
      isPinned: pinned,
      pinnedAt: pinned ? Date.now() : null
    })
    this.applyPinnedEditWindowsZOrder()
    this.deps.broadcast(IPC_CHANNELS.MEMO_UPDATED, updated)
  }

  private closeEditWindowOnly(memoId: MemoId): void {
    const win = this.editWindows.get(memoId)
    if (win && !win.isDestroyed()) {
      win.close()
    }
    this.editWindows.delete(memoId)
  }

  /** ━ fold: 편집 닫기 + 스택 선두(본문이 전혀 없으면 DB·스택에서 제거) */
  async foldEditWindow(memoId: MemoId): Promise<void> {
    await this.flushEditMemoDraftFromDom(memoId)
    const memo = this.deps.memos.getMemo(memoId)
    if (!memo) {
      this.closeEditWindowOnly(memoId)
      return
    }
    if (!memoHasTextContent(memo)) {
      this.deps.memos.deleteMemo(memoId)
      this.deps.settings.removeMemoFromFoldedStack(memoId)
      this.closeEditWindowOnly(memoId)
      this.deps.broadcast(IPC_CHANNELS.STACK_CHANGED, this.deps.settings.getAppState().foldedStack)
      this.deps.broadcast(IPC_CHANNELS.MEMO_DELETED, memoId)
      return
    }
    this.deps.settings.prependMemoToFoldedStack(memoId)
    this.closeEditWindowOnly(memoId)
    this.deps.broadcast(IPC_CHANNELS.STACK_CHANGED, this.deps.settings.getAppState().foldedStack)
  }

  /** 폴디드 ✕: 스택에서 제거 + 창 닫기(본문 없으면 메모 자체 삭제) */
  async closeFromStack(memoId: MemoId): Promise<void> {
    await this.flushEditMemoDraftFromDom(memoId)
    this.hidePreview()
    const memo = this.deps.memos.getMemo(memoId)
    if (memo && !memoHasTextContent(memo)) {
      this.deps.memos.deleteMemo(memoId)
      this.closeEditWindowOnly(memoId)
      this.deps.settings.removeMemoFromFoldedStack(memoId)
      this.deps.broadcast(IPC_CHANNELS.STACK_CHANGED, this.deps.settings.getAppState().foldedStack)
      this.deps.broadcast(IPC_CHANNELS.MEMO_DELETED, memoId)
      return
    }
    this.closeEditWindowOnly(memoId)
    this.deps.settings.removeMemoFromFoldedStack(memoId)
    this.deps.broadcast(IPC_CHANNELS.STACK_CHANGED, this.deps.settings.getAppState().foldedStack)
  }

  openPreview(memoId: MemoId, anchor?: FoldedPreviewAnchor): void {
    const edit = this.editWindows.get(memoId)
    if (edit && !edit.isDestroyed()) {
      edit.show()
      edit.focus()
      return
    }

    if (this.previewWindow && !this.previewWindow.isDestroyed() && this.previewMemoId === memoId) {
      return
    }

    this.hidePreview()

    const memo = this.deps.memos.getMemo(memoId)
    if (!memo) return

    const panel = this.foldedPanel
    const panelOk = panel && !panel.isDestroyed()

    let finalBounds: WinBounds

    if (anchor && panelOk) {
      const cb = panel.getContentBounds()
      const sy = cb.y + anchor.top
      const sh = anchor.height
      const cx = Math.floor(cb.x + cb.width / 2)
      const cy = Math.floor(sy + sh / 2)
      const wa = screen.getDisplayNearestPoint({ x: cx, y: cy }).workArea

      const panelRight = cb.x + cb.width
      const panelLeft = cb.x
      let fx = panelRight + PREVIEW_GAP
      if (fx + PREVIEW_WIDTH > wa.x + wa.width - 2) {
        fx = panelLeft - PREVIEW_WIDTH - PREVIEW_GAP
      }
      let fy = sy + Math.round(sh / 2 - PREVIEW_HEIGHT / 2)
      const clamped = clampPreviewTopLeft(fx, fy, PREVIEW_WIDTH, PREVIEW_HEIGHT)
      fx = clamped.x
      fy = clamped.y

      finalBounds = { x: fx, y: fy, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }
    } else {
      const p = panelOk ? panel.getContentBounds() : { x: 100, y: 100, width: FOLDED_WIDTH, height: FOLDED_HEIGHT }
      let fx = p.x + p.width + PREVIEW_GAP
      let fy = p.y
      const clamped = clampPreviewTopLeft(fx, fy, PREVIEW_WIDTH, PREVIEW_HEIGHT)
      finalBounds = { x: clamped.x, y: clamped.y, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }
    }

    const win = new BrowserWindow({
      width: finalBounds.width,
      height: finalBounds.height,
      x: finalBounds.x,
      y: finalBounds.y,
      show: false,
      frame: false,
      focusable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    win.setAlwaysOnTop(true, 'floating', Z_PREVIEW_FLOATING)

    this.previewWindow = win
    this.previewMemoId = memoId
    loadSnapRenderer(win, 'preview', memoId)

    win.on('closed', () => {
      this.previewWindow = null
      this.previewMemoId = null
    })

    win.on('ready-to-show', () => {
      win.setBounds(finalBounds, false)
      win.showInactive()
    })
  }

  /** 슬롯 이탈 후 잠깐 뒤 닫기(프리뷰로 포인터 옮길 틈). `delayMs` 0이면 다음 틱에서 즉시. */
  schedulePreviewHide(delayMs: number): void {
    this.cancelScheduledPreviewHide()
    this.previewHideTimer = setTimeout(
      () => {
        this.previewHideTimer = null
        this.hidePreview()
      },
      Math.max(0, delayMs)
    )
  }

  cancelScheduledPreviewHide(): void {
    if (this.previewHideTimer !== null) {
      clearTimeout(this.previewHideTimer)
      this.previewHideTimer = null
    }
  }

  hidePreview(): void {
    this.cancelScheduledPreviewHide()
    if (this.previewWindow && !this.previewWindow.isDestroyed()) {
      this.previewWindow.close()
    }
    this.previewWindow = null
    this.previewMemoId = null
  }

  openHistoryModal(): void {
    if (this.historyWindow && !this.historyWindow.isDestroyed()) {
      this.historyWindow.show()
      this.historyWindow.focus()
      return
    }
    const win = new BrowserWindow({
      width: 520,
      height: 640,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })
    this.historyWindow = win
    loadSnapRenderer(win, 'history')
    this.attachInAppKeyboardShortcuts(win, { type: 'history' })
    win.on('closed', () => {
      this.historyWindow = null
    })
    win.on('ready-to-show', () => win.show())
  }

  closeHistoryModal(): void {
    if (this.historyWindow && !this.historyWindow.isDestroyed()) {
      this.historyWindow.close()
    }
    this.historyWindow = null
  }

  openSettingsWindow(): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show()
      this.settingsWindow.focus()
      return
    }
    const win = new BrowserWindow({
      width: 640,
      height: 720,
      show: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })
    this.settingsWindow = win
    loadSnapRenderer(win, 'settings')
    this.attachInAppKeyboardShortcuts(win, { type: 'settings' })
    win.on('closed', () => {
      this.settingsWindow = null
    })
    win.on('ready-to-show', () => win.show())
  }

  pasteClipboardToEdit(text: string, targetMemoId?: MemoId | null): void {
    const id = targetMemoId ?? this.lastFocusedEditMemoId
    if (!id) return
    const win = this.editWindows.get(id)
    if (!win || win.isDestroyed()) return
    win.webContents.send(IPC_CHANNELS.CLIPBOARD_PASTE_TEXT, text)
  }

  /** 메모 영구 삭제 시 관련 창 정리 */
  onMemoDeleted(memoId: MemoId): void {
    if (this.previewMemoId === memoId) {
      this.hidePreview()
    }
    this.closeEditWindowOnly(memoId)
  }
}
