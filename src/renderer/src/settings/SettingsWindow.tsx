import { useCallback, useEffect, useState } from 'react'
import type { Settings, SettingsUpdatePatch } from '@shared/types'
import './settings-window.css'

const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+M'

export function SettingsWindow(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [shortcutDraft, setShortcutDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const s = await window.snapnote.settings.get()
    setSettings(s)
    setShortcutDraft(s.globalShortcut || DEFAULT_SHORTCUT)
  }, [])

  useEffect(() => {
    void refresh()
    return window.snapnote.on.settingsChanged((s) => {
      setSettings(s)
      setShortcutDraft(s.globalShortcut || DEFAULT_SHORTCUT)
    })
  }, [refresh])

  const patch = useCallback(async (p: SettingsUpdatePatch): Promise<void> => {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    try {
      const next = await window.snapnote.settings.update(p)
      setSettings(next)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }, [settings])

  const applyShortcut = useCallback(async (): Promise<void> => {
    const v = shortcutDraft.trim() || DEFAULT_SHORTCUT
    await patch({ globalShortcut: v })
    setMessage('전역 단축키를 저장했습니다. 다른 앱과 겹치면 등록에 실패할 수 있습니다.')
  }, [patch, shortcutDraft])

  const onClearAll = useCallback(async (): Promise<void> => {
    const ok = window.confirm(
      '모든 메모와 클립보드 히스토리를 지우고 폴디드 스택을 비웁니다.\n앱 설정(색·단축키 등)은 유지됩니다.\n\n계속할까요?'
    )
    if (!ok) return
    setSaving(true)
    try {
      await window.snapnote.app.clearAllData()
      setMessage('모든 메모 데이터를 삭제했습니다.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!settings) {
    return (
      <div className="settings-root">
        <p className="settings-loading">불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="settings-root">
      <header className="settings-header">
        <h1 className="settings-title">설정</h1>
        <button type="button" className="settings-close" onClick={() => window.close()} aria-label="닫기">
          닫기
        </button>
      </header>

      {message ? (
        <p className="settings-message" role="status">
          {message}
        </p>
      ) : null}

      <section className="settings-section" aria-labelledby="settings-gen">
        <h2 id="settings-gen" className="settings-section-title">
          일반
        </h2>
        <label className="settings-row">
          <input
            type="checkbox"
            checked={settings.launchOnStartup}
            disabled={saving}
            onChange={(e) => void patch({ launchOnStartup: e.target.checked })}
          />
          <span>시작 프로그램에 등록 (Windows / macOS)</span>
        </label>
        <label className="settings-row">
          <input
            type="checkbox"
            checked={settings.clipboardMonitoring}
            disabled={saving}
            aria-describedby="settings-clipboard-hint"
            onChange={(e) => void patch({ clipboardMonitoring: e.target.checked })}
          />
          <span>클립보드 모니터링 (텍스트·이미지 히스토리)</span>
        </label>
        <p className="settings-hint" id="settings-clipboard-hint">
          끄면 시스템 클립보드를 읽지 않으며 히스토리에 쌓이지 않습니다. 최초 실행 시 안내 창은 한 번만 표시됩니다.
        </p>
      </section>

      <section className="settings-section" aria-labelledby="settings-appearance">
        <h2 id="settings-appearance" className="settings-section-title">
          모양
        </h2>
        <p className="settings-hint">폴디드 슬롯 왼쪽 색(메모 색상 슬롯 1·2·3에 대응)</p>
        <div className="settings-color-row">
          <label className="settings-color-label">
            슬롯 1
            <input
              type="color"
              value={normalizeHex(settings.colorSlot1)}
              disabled={saving}
              onChange={(e) => void patch({ colorSlot1: e.target.value })}
            />
          </label>
          <label className="settings-color-label">
            슬롯 2
            <input
              type="color"
              value={normalizeHex(settings.colorSlot2)}
              disabled={saving}
              onChange={(e) => void patch({ colorSlot2: e.target.value })}
            />
          </label>
          <label className="settings-color-label">
            슬롯 3
            <input
              type="color"
              value={normalizeHex(settings.colorSlot3)}
              disabled={saving}
              onChange={(e) => void patch({ colorSlot3: e.target.value })}
            />
          </label>
        </div>
        <div className="settings-dimensions">
          <label>
            새 메모 기본 창 너비
            <input
              key={`dw-${settings.defaultWindowWidth}`}
              type="number"
              min={300}
              max={1600}
              step={10}
              defaultValue={settings.defaultWindowWidth}
              disabled={saving}
              onBlur={(e) => {
                const n = Number(e.currentTarget.value)
                if (Number.isFinite(n)) void patch({ defaultWindowWidth: clamp(n, 300, 1600) })
              }}
            />
          </label>
          <label>
            새 메모 기본 창 높이
            <input
              key={`dh-${settings.defaultWindowHeight}`}
              type="number"
              min={350}
              max={1200}
              step={10}
              defaultValue={settings.defaultWindowHeight}
              disabled={saving}
              onBlur={(e) => {
                const n = Number(e.currentTarget.value)
                if (Number.isFinite(n)) void patch({ defaultWindowHeight: clamp(n, 350, 1200) })
              }}
            />
          </label>
        </div>
        <div className="settings-opacity-row">
          <label htmlFor="settings-window-opacity">창 투명도</label>
          <div className="settings-opacity-control">
            <input
              id="settings-window-opacity"
              type="range"
              min={60}
              max={100}
              step={1}
              value={Math.round((settings.windowOpacity ?? 1) * 100)}
              disabled={saving}
              onChange={(e) => {
                const pct = clamp(Number(e.currentTarget.value), 60, 100)
                void patch({ windowOpacity: pct / 100 })
              }}
            />
            <span>{Math.round((settings.windowOpacity ?? 1) * 100)}%</span>
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-shortcuts">
        <h2 id="settings-shortcuts" className="settings-section-title">
          단축키
        </h2>
        <p className="settings-hint">Electron accelerator 문법 (예: CommandOrControl+Shift+M, Alt+Shift+S)</p>
        <div className="settings-shortcut-row">
          <input
            type="text"
            className="settings-shortcut-input"
            value={shortcutDraft}
            disabled={saving}
            onChange={(e) => setShortcutDraft(e.target.value)}
            placeholder={DEFAULT_SHORTCUT}
            spellCheck={false}
            aria-label="전역 단축키"
          />
          <button type="button" className="settings-btn" disabled={saving} onClick={() => void applyShortcut()}>
            적용
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-data">
        <h2 id="settings-data" className="settings-section-title">
          데이터
        </h2>
        <p className="settings-hint">
          다른 PC로 옮기려면 내보내기로 JSON 파일을 저장한 뒤, USB·클라우드 등으로 복사해 그 PC의 SnapNote 설정에서 가져오기를 실행하세요.
        </p>
        <p className="settings-hint">
          가져오기는 이미 있는 메모 id와 겹치면 건너뛰고, 없는 메모만 추가합니다(기존 히스토리는 유지). 메모는 최대 50개까지이며, 한도를 넘기면 오래된 항목이 정리될 수 있습니다.
        </p>
        <div className="settings-data-actions">
          <button type="button" className="settings-btn" disabled={saving} onClick={() => void window.snapnote.app.exportMemos()}>
            내보내기 (JSON)
          </button>
          <button type="button" className="settings-btn" disabled={saving} onClick={() => void window.snapnote.app.importMemos()}>
            가져오기 (JSON)
          </button>
          <button type="button" className="settings-btn settings-btn--danger" disabled={saving} onClick={() => void onClearAll()}>
            모든 메모·클립보드 기록 삭제…
          </button>
        </div>
      </section>

      {saving ? <p className="settings-saving">처리 중…</p> : null}
    </div>
  )
}

function normalizeHex(hex: string): string {
  const h = hex.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h
  return '#888888'
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
