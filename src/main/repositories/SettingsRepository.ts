import type { Database } from 'sql.js'
import type { AppState, Settings, SettingsUpdatePatch } from '@shared/types'
import { run, selectOne, type SqlRow } from './sqlRun'

/** PRD: 폴디드 스택에 최대 3개 메모 */
export const MAX_FOLDED_STACK = 3

function clampFoldedStack(ids: string[]): string[] {
  return ids.slice(0, MAX_FOLDED_STACK)
}

function rowToSettings(row: SqlRow): Settings {
  const notice = row.clipboard_notice_shown
  return {
    launchOnStartup: Number(row.launch_on_startup) === 1,
    clipboardMonitoring: Number(row.clipboard_monitoring) === 1,
    clipboardNoticeShown: notice !== null && notice !== undefined && Number(notice) === 1,
    colorSlot1: String(row.color_slot_1),
    colorSlot2: String(row.color_slot_2),
    colorSlot3: String(row.color_slot_3),
    defaultWindowWidth: Number(row.default_window_width),
    defaultWindowHeight: Number(row.default_window_height),
    globalShortcut: String(row.global_shortcut)
  }
}

function rowToAppState(row: SqlRow): AppState {
  return {
    foldedStack: JSON.parse(String(row.folded_stack)) as string[],
    foldedPanelX: Number(row.folded_panel_x),
    foldedPanelY: Number(row.folded_panel_y)
  }
}

export class SettingsRepository {
  constructor(
    private readonly getDb: () => Database,
    private readonly persistFn: () => void
  ) {}

  private persist(): void {
    this.persistFn()
  }

  getSettings(): Settings {
    const row = selectOne(this.getDb(), 'SELECT * FROM settings WHERE id = ?', ['singleton'])
    if (!row) throw new Error('settings singleton missing')
    return rowToSettings(row)
  }

  updateSettings(patch: SettingsUpdatePatch): Settings {
    const cur = this.getSettings()
    const next: Settings = { ...cur, ...patch }
    run(
      this.getDb(),
      `UPDATE settings SET
        launch_on_startup = ?,
        clipboard_monitoring = ?,
        clipboard_notice_shown = ?,
        color_slot_1 = ?,
        color_slot_2 = ?,
        color_slot_3 = ?,
        default_window_width = ?,
        default_window_height = ?,
        global_shortcut = ?
      WHERE id = 'singleton'`,
      [
        next.launchOnStartup ? 1 : 0,
        next.clipboardMonitoring ? 1 : 0,
        next.clipboardNoticeShown ? 1 : 0,
        next.colorSlot1,
        next.colorSlot2,
        next.colorSlot3,
        next.defaultWindowWidth,
        next.defaultWindowHeight,
        next.globalShortcut
      ]
    )
    this.persist()
    return this.getSettings()
  }

  /** DB 행만 읽기 (클램프·재귀 없음) — `updateAppState` / `getAppState` 내부용 */
  private loadAppStateRow(): AppState {
    const row = selectOne(this.getDb(), 'SELECT * FROM app_state WHERE id = ?', ['singleton'])
    if (!row) throw new Error('app_state singleton missing')
    return rowToAppState(row)
  }

  getAppState(): AppState {
    const state = this.loadAppStateRow()
    const clamped = clampFoldedStack(state.foldedStack)
    if (clamped.length !== state.foldedStack.length) {
      run(
        this.getDb(),
        `UPDATE app_state SET
          folded_stack = ?,
          folded_panel_x = ?,
          folded_panel_y = ?
        WHERE id = 'singleton'`,
        [JSON.stringify(clamped), state.foldedPanelX, state.foldedPanelY]
      )
      this.persist()
      return { ...state, foldedStack: clamped }
    }
    return { ...state, foldedStack: clamped }
  }

  updateAppState(patch: Partial<AppState>): AppState {
    const cur = this.loadAppStateRow()
    const rawStack = patch.foldedStack ?? cur.foldedStack
    const next: AppState = {
      foldedStack: clampFoldedStack(rawStack),
      foldedPanelX: patch.foldedPanelX ?? cur.foldedPanelX,
      foldedPanelY: patch.foldedPanelY ?? cur.foldedPanelY
    }
    run(
      this.getDb(),
      `UPDATE app_state SET
        folded_stack = ?,
        folded_panel_x = ?,
        folded_panel_y = ?
      WHERE id = 'singleton'`,
      [JSON.stringify(next.foldedStack), next.foldedPanelX, next.foldedPanelY]
    )
    this.persist()
    return this.getAppState()
  }

  /** 메모 삭제 시 폴디드 스택에서 id 제거 */
  removeMemoFromFoldedStack(memoId: string): void {
    const { foldedStack } = this.getAppState()
    const next = foldedStack.filter((id) => id !== memoId)
    this.updateAppState({ foldedStack: next })
  }

  /** 새 메모·fold 시 스택 맨 앞에 id (중복 제거 후 선두) */
  prependMemoToFoldedStack(memoId: string): AppState {
    const { foldedStack } = this.getAppState()
    const without = foldedStack.filter((id) => id !== memoId)
    return this.updateAppState({ foldedStack: [memoId, ...without] })
  }
}
