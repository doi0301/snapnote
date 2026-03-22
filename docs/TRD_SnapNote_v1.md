# SnapNote — Technical Requirements Document (TRD)

> **Version:** 1.0
> **Date:** 2026-03-21
> **Status:** Ready for Review
> **Based on:** PRD_SnapNote_v1.md, SRD_SnapNote_v1.md
> **Platform:** Desktop App (Windows 11 first, macOS later)

---

## 1. Technology Stack

### 1.1 Recommended Stack

| Layer            | Technology                               | Rationale                                                                                                                |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Runtime          | **Electron v29+**                        | Cross-platform (Windows first, macOS later). Native OS APIs for always-on-top, system tray, global shortcuts, clipboard. |
| Language         | **TypeScript 5.x**                       | Type safety, IDE support, maintainability                                                                                |
| UI Framework     | **React 18**                             | Component model fits multi-window architecture; large ecosystem                                                          |
| Styling          | **CSS Modules + CSS Variables**          | Scoped styles; easy theming foundation for future dark mode                                                              |
| State Management | **Zustand**                              | Lightweight, no boilerplate; fits small-to-medium app state                                                              |
| Data Persistence | **sql.js** (WASM SQLite)               | Embedded SQLite 호환; 네이티브 빌드 불필요(Windows/Node 호환). 메모리 DB + 파일 `export`로 `snapnote.db` 유지 (`persistDatabase`) |
| Build Tool       | **Vite + electron-vite**                 | Fast dev server; HMR in renderer; optimized production builds                                                            |
| Packaging        | **electron-builder**                     | NSIS installer for Windows; handles auto-update path                                                                     |
| IPC              | **Electron IPC (contextBridge)**         | Secure preload bridge between main and renderer                                                                          |
| Testing          | **Vitest** (unit) + **Playwright** (E2E) | Vitest integrates with Vite; Playwright supports Electron                                                                |

### 1.2 Key Dependencies

```json
{
  "electron": "^39.x",
  "react": "^19.x",
  "react-dom": "^19.x",
  "typescript": "^5.x",
  "sql.js": "^1.14.x",
  "zustand": "(Sprint 이후)",
  "electron-builder": "^26.x",
  "electron-vite": "^5.x",
  "vite": "^7.x"
}
```

> 실제 버전은 루트 `package.json`을 따른다. DB 레이어는 **`sql.js`** 로 구현한다 (`better-sqlite3` 미사용).

---

## 2. System Architecture

### 2.1 Electron Process Model

```
┌─────────────────────────────────────────────────────┐
│                   MAIN PROCESS                       │
│                                                     │
│  ┌───────────────┐  ┌────────────────────────────┐  │
│  │ WindowManager │  │       DataService          │  │
│  │               │  │  (SQLite via sql.js       │  │
│  │ - FoldedWindow│  │   MemoRepository           │  │
│  │ - EditWindow[]│  │   SettingsRepository       │  │
│  │ - HistoryModal│  │   ClipboardRepository)     │  │
│  │ - TrayManager │  └────────────────────────────┘  │
│  └───────┬───────┘                                  │
│          │ IPC                                      │
└──────────┼──────────────────────────────────────────┘
           │ contextBridge (preload.ts)
┌──────────┼──────────────────────────────────────────┐
│          │        RENDERER PROCESSES                 │
│  ┌───────▼────────┐  ┌─────────────┐  ┌──────────┐  │
│  │  FoldedPanel   │  │ EditWindow  │  │ History  │  │
│  │  React App     │  │ React App   │  │ Modal    │  │
│  │                │  │ (per memo)  │  │ React App│  │
│  └────────────────┘  └─────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.2 Window Architecture

| Window         | BrowserWindow Options                                                                                  | Notes                            |
| -------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| FoldedPanel    | `alwaysOnTop: true`, `frame: false`, `resizable: false`, `skipTaskbar: true`                           | Single instance, persistent      |
| EditWindow     | `alwaysOnTop: false` (togglable), `frame: false`, `resizable: true`, `minWidth: 300`, `minHeight: 350` | Multiple instances, one per memo |
| PreviewWindow  | `alwaysOnTop: true`, `frame: false`, `resizable: false`, `focusable: false`                            | Temporary, one at a time         |
| HistoryModal   | `alwaysOnTop: true`, `frame: false`, `resizable: false`                                                | Single instance                  |
| SettingsWindow | `alwaysOnTop: false`, `frame: true`, `resizable: false`                                                | Single instance                  |

### 2.3 IPC Channel Design

All IPC communication uses named channels defined in a shared `ipc-channels.ts` constant file.

#### Main → Renderer (events)

| Channel                | Payload         | Description                     |
| ---------------------- | --------------- | ------------------------------- |
| `memo:updated`         | `Memo`          | Notify renderer of memo changes |
| `stack:changed`        | `MemoId[]`      | Folded stack updated            |
| `clipboard:item-added` | `ClipboardItem` | New clipboard item captured     |
| `settings:changed`     | `Settings`      | Settings updated                |

#### Renderer → Main (invoke/handle)

| Channel                 | Payload                | Returns           | Description                  |
| ----------------------- | ---------------------- | ----------------- | ---------------------------- |
| `memo:create`           | `void`                 | `Memo`            | Create new blank memo        |
| `memo:update`           | `{id, patch}`          | `Memo`            | Update memo fields           |
| `memo:delete`           | `MemoId`               | `void`            | Permanently delete memo      |
| `memo:get-all`          | `void`                 | `Memo[]`          | Get all memos                |
| `memo:get`              | `MemoId`               | `Memo`            | Get single memo              |
| `memo:open-edit`        | `MemoId`               | `void`            | Open/focus edit window       |
| `memo:fold`             | `MemoId`               | `void`            | Fold edit window to stack    |
| `memo:close-from-stack` | `MemoId`               | `void`            | Remove from folded stack     |
| `clipboard:get-history` | `void`                 | `ClipboardItem[]` | Get clipboard history        |
| `clipboard:insert`      | `{text, targetMemoId}` | `void`            | Insert text into edit window |
| `settings:get`          | `void`                 | `Settings`        | Get current settings         |
| `settings:update`       | `Partial<Settings>`    | `Settings`        | Update settings              |
| `app:export-memos`      | `void`                 | `void`            | Trigger JSON export dialog   |
| `app:import-memos`      | `void`                 | `void`            | Trigger JSON import dialog   |

---

## 3. Data Layer

### 3.1 Database Schema (SQLite)

**런타임 구현:** 메인 프로세스는 **`sql.js`**(WebAssembly SQLite)로 아래 스키마를 생성·조회한다. 파일에는 `userData/snapnote.db`로 저장하며, 쓰기 후 **`persistDatabase()`** 호출로 디스크에 반영한다. (`better-sqlite3`는 사용하지 않음 — Windows에서 네이티브 컴파일/프리빌드 이슈 회피.)

```sql
-- Memos table
CREATE TABLE memos (
  id          TEXT PRIMARY KEY,          -- UUID v4
  content     TEXT NOT NULL DEFAULT '[]',-- JSON: EditorLine[]
  tags        TEXT NOT NULL DEFAULT '[]',-- JSON: string[]
  color       TEXT NOT NULL,             -- e.g. 'coral' | 'green' | 'blue'
  is_pinned   INTEGER NOT NULL DEFAULT 0,-- boolean: 0 | 1
  window_x    INTEGER,
  window_y    INTEGER,
  window_width  INTEGER NOT NULL DEFAULT 400,
  window_height INTEGER NOT NULL DEFAULT 500,
  created_at  TEXT NOT NULL,             -- ISO 8601
  updated_at  TEXT NOT NULL              -- ISO 8601
);

-- App state table (single row, id = 'singleton')
CREATE TABLE app_state (
  id              TEXT PRIMARY KEY DEFAULT 'singleton',
  folded_stack    TEXT NOT NULL DEFAULT '[]', -- JSON: UUID[3]
  folded_panel_x  INTEGER NOT NULL DEFAULT 100,
  folded_panel_y  INTEGER NOT NULL DEFAULT 100
);

-- Settings table (single row, id = 'singleton')
CREATE TABLE settings (
  id                    TEXT PRIMARY KEY DEFAULT 'singleton',
  launch_on_startup     INTEGER NOT NULL DEFAULT 0,
  clipboard_monitoring  INTEGER NOT NULL DEFAULT 1,
  color_slot_1          TEXT NOT NULL DEFAULT '#FF6B6B',
  color_slot_2          TEXT NOT NULL DEFAULT '#51CF66',
  color_slot_3          TEXT NOT NULL DEFAULT '#339AF0',
  default_window_width  INTEGER NOT NULL DEFAULT 400,
  default_window_height INTEGER NOT NULL DEFAULT 500,
  global_shortcut       TEXT NOT NULL DEFAULT 'CommandOrControl+Shift+M'
);

-- Clipboard history table
CREATE TABLE clipboard_history (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  text      TEXT NOT NULL,
  captured_at TEXT NOT NULL               -- ISO 8601
);
```

### 3.2 Content Data Model (EditorLine)

Memo content is stored as a JSON array of line objects:

```typescript
interface EditorLine {
  id: string // unique line ID (UUID)
  text: string // plain text content
  indentLevel: number // 0–3
  formatting: {
    bold?: boolean
    strikethrough?: boolean
    highlight?: 'yellow' | 'green' | 'pink' | null
    hasCheckbox?: boolean
    checkboxChecked?: boolean
  }
  // For inline bold/strikethrough/highlight spans:
  spans?: TextSpan[]
}

interface TextSpan {
  start: number
  end: number
  bold?: boolean
  strikethrough?: boolean
  highlight?: 'yellow' | 'green' | 'pink'
}
```

### 3.3 Storage Location

| OS             | Path                                                 |
| -------------- | ---------------------------------------------------- |
| Windows        | `%APPDATA%\SnapNote\snapnote.db`                     |
| macOS (future) | `~/Library/Application Support/SnapNote/snapnote.db` |

Use `app.getPath('userData')` (Electron API) to resolve path at runtime.

---

## 4. Component Architecture

### 4.1 FoldedPanel

```
FoldedPanel/
├── FoldedPanel.tsx       # Root: drag, snap, always-on-top
├── MemoSlot.tsx          # Single memo row
├── EmptyState.tsx        # "+ 새 메모" empty panel
└── hooks/
    ├── useDragSnap.ts    # Edge snap logic
    └── useFoldedStack.ts # Stack state subscription
```

**Key behaviors:**

- `useDragSnap`: Tracks mouse delta during drag; computes snap position per screen edge. Uses `screen.getAllDisplays()` for multi-monitor bounds.
- `MemoSlot`: Renders color indicator, 10-char truncated preview, edit and close buttons. Hover triggers preview window open via IPC.

### 4.2 EditWindow

```
EditWindow/
├── EditWindow.tsx        # Root: window chrome, resize, position persistence
├── TopBar.tsx            # Pin toggle, fold, close buttons
├── TagInput.tsx          # Hashtag input with autocomplete dropdown
├── Editor.tsx            # Core editor surface
│   ├── EditorLine.tsx    # Single line: indent, background, formatting
│   ├── InlineSpan.tsx    # Bold/strikethrough/highlight spans
│   └── Checkbox.tsx      # Toggleable checkbox at line start
├── Toolbar.tsx           # Bottom toolbar container
│   ├── EmojiPalette.tsx  # Emoji symbol grid popup
│   ├── ClipboardPanel.tsx# Clipboard history popup
│   └── FormatTools.tsx   # Bold, strikethrough, highlight, checkbox buttons
└── hooks/
    ├── useAutoSave.ts    # 1.5s debounce save
    ├── useEditorState.ts # Line array state management
    └── useWindowPersist.ts # Size/position save & restore
```

**Editor key event handling:**

- `Tab` keydown: increment `indentLevel` (max 3), prevent default browser tab behavior
- `Shift+Tab` keydown: decrement `indentLevel` (min 0)
- `Enter` keydown: insert new line with same `indentLevel` as current
- `Ctrl+B`: toggle bold span on selection or cursor mode
- `Ctrl+Shift+X`: toggle strikethrough span on selection

### 4.3 HistoryModal

```
HistoryModal/
├── HistoryModal.tsx      # Root modal: backdrop, Esc handler
├── SearchBar.tsx         # Real-time search input + New Memo button
├── TagFilterBar.tsx      # Scrollable horizontal tag chips
├── MemoList.tsx          # Virtualized list (if >20 items)
├── MemoListItem.tsx      # Single memo row
└── DeleteConfirm.tsx     # Confirmation dialog
```

**Search implementation:**

- Filter runs on the full `Memo[]` array in-memory (max 50 items — no need for DB query on each keystroke).
- Search matches against: **full memo body text** (all lines / serialized content) + tags array (product decision: not first-line only).
- Debounce search input by 150ms to avoid excessive re-renders.

### 4.4 ClipboardService (Main Process)

```typescript
class ClipboardService {
  private pollInterval = 500 // ms
  private lastText = ''

  start(): void // Begin polling clipboard
  stop(): void // Stop polling
  getHistory(): ClipboardItem[]
  private onNewText(text: string): void // Persist + broadcast
}
```

- Uses `setInterval` polling (500ms) since Electron has no native clipboard change event.
- On new text detected: insert into `clipboard_history` table (FIFO, max 30), emit `clipboard:item-added` to all renderer windows.

### 4.5 WindowManager (Main Process)

```typescript
class WindowManager {
  private foldedPanel: BrowserWindow | null
  private editWindows: Map<MemoId, BrowserWindow>
  private previewWindow: BrowserWindow | null
  private historyModal: BrowserWindow | null

  createFoldedPanel(): void
  openEditWindow(memoId: string): void
  closeEditWindow(memoId: string): void
  showPreview(memoId: string): void
  hidePreview(): void
  openHistoryModal(): void
  closeHistoryModal(): void
  toggleFoldedPanel(): void
}
```

---

## 5. Edge Snap Implementation

### Algorithm

```typescript
function computeSnappedPosition(
  x: number,
  y: number,
  windowWidth: number,
  windowHeight: number,
  displays: Display[],
  snapThreshold = 20
): { x: number; y: number } {
  for (const display of displays) {
    const { bounds } = display
    let snappedX = x
    let snappedY = y

    // Snap to left edge
    if (Math.abs(x - bounds.x) < snapThreshold) snappedX = bounds.x
    // Snap to right edge
    if (Math.abs(x + windowWidth - (bounds.x + bounds.width)) < snapThreshold)
      snappedX = bounds.x + bounds.width - windowWidth
    // Snap to top edge
    if (Math.abs(y - bounds.y) < snapThreshold) snappedY = bounds.y
    // Snap to bottom edge
    if (Math.abs(y + windowHeight - (bounds.y + bounds.height)) < snapThreshold)
      snappedY = bounds.y + bounds.height - windowHeight

    if (snappedX !== x || snappedY !== y) {
      return { x: snappedX, y: snappedY }
    }
  }
  return { x, y }
}
```

- Called on `BrowserWindow` `move` event in main process.
- `screen.getAllDisplays()` provides bounds for each connected monitor.

---

## 6. Auto-Save Implementation

```typescript
// useAutoSave.ts
function useAutoSave(memoId: string, content: EditorLine[], delay = 1500) {
  const timerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      window.ipc.invoke('memo:update', { id: memoId, patch: { content } })
    }, delay)

    return () => clearTimeout(timerRef.current)
  }, [content]) // triggers on every content change

  // Force-save on unmount (window close/fold)
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
      window.ipc.invoke('memo:update', { id: memoId, patch: { content } })
    }
  }, [])
}
```

---

## 7. Preview Window State Machine

```
IDLE
  │  (hover enter memo row)
  ▼
HOVER_DELAY  ← 100ms timer
  │  (timer fires)
  ▼
PREVIEW_OPEN ─────────────── mouse enters preview window ──► READING
  │  (mouse leaves row)                                           │
  ▼                                                        (mouse leaves preview)
TIMEOUT_3S                                                        │
  │  (3s elapsed)                                                 ▼
  ▼                                                         TIMEOUT_3S
CLOSED                                                            │
                                                          (3s elapsed)
                                                                  ▼
                                                              CLOSED
```

All state transitions are managed in the main process `WindowManager`. The 3-second timeout uses `setTimeout` per preview window instance.

---

## 8. Global Shortcut

```typescript
// In main process, after app is ready:
globalShortcut.register('CommandOrControl+Shift+M', () => {
  windowManager.toggleFoldedPanel()
})

// On settings change:
globalShortcut.unregisterAll()
globalShortcut.register(newShortcut, () => {
  windowManager.toggleFoldedPanel()
})
```

Uses Electron's `globalShortcut` API which works system-wide even when the app is not in focus.

---

## 9. Data Export/Import Format

```json
{
  "version": "1",
  "exportedAt": "2026-03-21T00:00:00.000Z",
  "memos": [
    {
      "id": "uuid-v4",
      "content": [...],
      "tags": ["#업무", "#계획"],
      "color": "coral",
      "isPinned": false,
      "createdAt": "2026-03-21T00:00:00.000Z",
      "updatedAt": "2026-03-21T00:00:00.000Z"
    }
  ]
}
```

Import merges with existing data (does not replace); duplicate IDs are skipped.

---

## 10. Build & Distribution

### 10.1 Directory Structure

```
snapnote/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # Entry point
│   │   ├── WindowManager.ts
│   │   ├── DataService.ts
│   │   ├── ClipboardService.ts
│   │   ├── TrayManager.ts
│   │   └── repositories/
│   │       ├── MemoRepository.ts
│   │       ├── SettingsRepository.ts
│   │       └── ClipboardRepository.ts
│   ├── preload/
│   │   └── index.ts          # contextBridge IPC bridge
│   ├── renderer/
│   │   ├── folded/           # Folded panel renderer
│   │   ├── edit/             # Edit window renderer
│   │   ├── history/          # History modal renderer
│   │   ├── settings/         # Settings window renderer
│   │   └── shared/           # Shared components, hooks, types
│   └── shared/
│       ├── types.ts           # Shared TypeScript types
│       └── ipc-channels.ts    # IPC channel name constants
├── electron.vite.config.ts
├── electron-builder.config.ts
└── package.json
```

### 10.2 Packaging Config (electron-builder)

```javascript
// electron-builder.config.ts
{
  appId: 'com.snapnote.app',
  productName: 'SnapNote',
  win: {
    target: 'nsis',
    icon: 'build/icon.ico',
    artifactName: 'SnapNote-Setup-${version}.exe'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    runAfterFinish: true
  }
}
```

---

## 11. Security Considerations

- **Context Isolation**: `contextIsolation: true`, `nodeIntegration: false` on all renderer windows.
- **Preload script**: All IPC exposed via `contextBridge.exposeInMainWorld` — renderers have no direct Node.js access.
- **No remote content**: All renderer pages are local HTML; `webSecurity: true` (default).
- **Clipboard data**: Stored in local SQLite only. Never transmitted.
- **No external dependencies at runtime**: All data stays local.

---

## 12. Testing Strategy

### Unit Tests (Vitest)

- `MemoRepository`: CRUD operations, 50-memo limit enforcement
- `ClipboardRepository`: FIFO 30-item limit
- `computeSnappedPosition`: All edge/corner snap scenarios
- `EditorLine` formatting logic: indent/outdent, bold, strikethrough spans

### Integration Tests (Vitest)

- DataService: full memo lifecycle (create → update → delete → history limit)
- Auto-save debounce behavior
- Folded stack rotation logic

### E2E Tests (Playwright for Electron)

- App launch → create first memo → fold → verify in stack
- Hover → preview → click → edit transition
- History modal: search, tag filter, delete with confirmation
- Screen edge snap behavior
- Clipboard history insert workflow

---

## 13. Performance Optimizations

| Concern                                       | Solution                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Multiple edit windows rendering independently | Each window is a separate BrowserWindow with its own renderer process — isolation is free |
| History modal with 50 memos                   | In-memory filter (no DB query on search); consider `react-window` virtual list if needed  |
| Clipboard polling (500ms)                     | Low CPU; only writes to DB on text change                                                 |
| Auto-save frequency                           | 1.5s debounce prevents excessive DB writes                                                |
| Editor re-renders                             | Zustand per-window store; `React.memo` on `EditorLine` components                         |
| Startup time                                  | Lazy-load History and Settings windows (create only on first open)                        |
