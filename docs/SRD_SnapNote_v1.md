# SnapNote — Software Requirements Document (SRD)

> **Version:** 1.0
> **Date:** 2026-03-21
> **Status:** Ready for Review
> **Based on:** PRD_SnapNote_v1.md
> **Platform:** Desktop App (Windows 11 first, macOS later)

---

## 1. Introduction

### 1.1 Purpose

This document defines the software requirements for SnapNote, a desktop memo application. It translates the product-level goals from the PRD into structured, testable software requirements that guide engineering decisions.

### 1.2 Scope

SnapNote v1 is a Windows desktop application that provides:

- A persistent, always-visible folded memo panel that snaps to screen edges
- Structured text editing with tree-style indentation
- Clipboard history capture and management
- Memo history with search and tag filtering
- System tray integration

### 1.3 Definitions

| Term          | Definition                                                          |
| ------------- | ------------------------------------------------------------------- |
| Folded state  | Compact always-visible vertical stack showing up to 3 memo previews |
| Folded stack  | The collection of up to 3 memos in the folded state                 |
| Preview state | Temporary read-only popup triggered by hover                        |
| Edit state    | Full editing window                                                 |
| Slot          | One of the 3 positions in the folded stack                          |
| Tag           | A freeform #hashtag label assigned to a memo                        |
| Indent level  | Line depth (0–3), controlled by Tab/Shift+Tab                       |
| Snap          | Magnetic window attachment to screen edges                          |

---

## 2. Functional Requirements

### FR-01: Folded State (Persistent Panel)

| ID       | Requirement                                                                                                                                                          | Priority |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-01-1  | The folded panel SHALL always remain on top of all other windows.                                                                                                    | Must     |
| FR-01-2  | The folded panel SHALL display up to 3 memos simultaneously, sorted newest-first.                                                                                    | Must     |
| FR-01-3  | Each memo row SHALL display: a color indicator, first 10 characters of content + "...", an edit button (✏️), and a close button (✕).                                 | Must     |
| FR-01-4  | The 3 color indicators SHALL be assigned in rotation from a fixed set of 3 colors (default: coral, green, blue).                                                     | Must     |
| FR-01-5  | Clicking ✏️ SHALL open the corresponding memo in edit state.                                                                                                         | Must     |
| FR-01-6  | Clicking ✕ SHALL remove the memo from the folded stack WITHOUT deleting it from history.                                                                             | Must     |
| FR-01-7  | The folded panel SHALL be draggable to any position on screen.                                                                                                       | Must     |
| FR-01-8  | When all 3 slots are occupied and a new memo is created or opened from history, the oldest memo SHALL be removed from the stack (not deleted).                       | Must     |
| FR-01-9  | When the folded stack is empty, the panel SHALL display a single row with the empty-state copy: "메모가 없습니다." and a prominent "+ 새 메모" action (PRD-aligned). | Must     |
| FR-01-10 | The folded panel SHALL NOT be closable via window controls; only via System Tray → Quit.                                                                             | Must     |
| FR-01-11 | The folded panel width SHALL be fixed at approximately 280px.                                                                                                        | Should   |
| FR-01-12 | The folded panel height SHALL auto-fit to the number of memo rows (1–3).                                                                                             | Should   |

### FR-02: Preview State (Hover)

| ID      | Requirement                                                                                                                                                | Priority |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-02-1 | Hovering over a memo row in the folded panel SHALL open a read-only preview window after a short delay.                                                    | Must     |
| FR-02-2 | The preview window SHALL close automatically 3 seconds after the mouse leaves both the memo row and the preview window.                                    | Must     |
| FR-02-3 | If the user moves the mouse into the preview window within the 3-second timeout, the window SHALL stay open and remain read-only.                          | Must     |
| FR-02-4 | Clicking anywhere inside the preview window SHALL transition it to edit state.                                                                             | Must     |
| FR-02-5 | The preview window SHALL appear adjacent to the folded panel and NOT overlap it.                                                                           | Should   |
| FR-02-6 | The preview window SHALL have a visual indicator (e.g., dimmed appearance or "read-only" badge) to distinguish it from the edit state.                     | Should   |
| FR-02-7 | If an edit window for the same memo is already open, hovering SHALL NOT show a preview window; instead the existing edit window SHALL be brought to front. | Must     |

### FR-03: Edit State (Edit Window)

| ID       | Requirement                                                                                                                           | Priority |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-03-1  | The edit window SHALL contain: top bar, tag input field, text editor area, and bottom toolbar.                                        | Must     |
| FR-03-2  | The top bar SHALL contain: pin toggle (📌), fold button (━), and close button (✕).                                                    | Must     |
| FR-03-3  | The pin toggle SHALL set that window as always-on-top when ON, and normal window behavior when OFF. Default: OFF.                     | Must     |
| FR-03-4  | Pin state SHALL be persisted per memo and restored when the edit window is reopened.                                                  | Must     |
| FR-03-5  | The fold button SHALL close the edit window while keeping the memo in the folded stack.                                               | Must     |
| FR-03-6  | The close button (✕) in the top bar SHALL close the edit window AND remove the memo from the folded stack (memo is saved in history). | Must     |
| FR-03-7  | The edit window default size SHALL be 400px × 500px.                                                                                  | Should   |
| FR-03-8  | The edit window minimum size SHALL be 300px × 350px.                                                                                  | Must     |
| FR-03-9  | The edit window SHALL be resizable by dragging any edge or corner.                                                                    | Must     |
| FR-03-10 | The edit window size and position SHALL be persisted per memo and restored when reopened.                                             | Must     |
| FR-03-11 | Pressing Esc while an edit window is focused SHALL fold it (same as clicking the fold button).                                        | Must     |
| FR-03-12 | Multiple edit windows SHALL be allowed to be open simultaneously.                                                                     | Must     |
| FR-03-13 | Attempting to open an already-open memo SHALL bring the existing window to front instead of opening a duplicate.                      | Must     |

### FR-04: Tag Input

| ID      | Requirement                                                                                                 | Priority |
| ------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| FR-04-1 | The tag input SHALL accept freeform hashtag-style tags (e.g., `#업무 #계획`).                               | Must     |
| FR-04-2 | Tags SHALL be separated by spaces.                                                                          | Must     |
| FR-04-3 | After typing `#`, the input SHALL display a dropdown with previously used tags as autocomplete suggestions. | Should   |
| FR-04-4 | Tags SHALL be saved per memo and used for filtering in History.                                             | Must     |
| FR-04-5 | Tag input placeholder text SHALL be: `ex. #업무 #계획`.                                                     | Should   |

### FR-05: Text Editor

| ID       | Requirement                                                                                                                         | Priority |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-05-1  | The editor SHALL support 4 indentation levels (level 0 = root, levels 1–3 = indented).                                              | Must     |
| FR-05-2  | Pressing Tab SHALL indent the current line by one level (max level 3).                                                              | Must     |
| FR-05-3  | Pressing Shift+Tab SHALL outdent the current line by one level (min level 0).                                                       | Must     |
| FR-05-4  | Pressing Enter SHALL create a new line at the same indentation level as the current line.                                           | Must     |
| FR-05-5  | Indentation SHALL apply to the entire line, not individual words.                                                                   | Must     |
| FR-05-6  | Each indentation level SHALL have a distinct background fill: Level 0: white, Level 1: #F8F8F8, Level 2: #F0F0F0, Level 3: #E8E8E8. | Must     |
| FR-05-7  | The editor SHALL display light gray horizontal grid lines between rows.                                                             | Should   |
| FR-05-8  | The editor SHALL display a thin vertical guide line (1px, light gray) at each indent level boundary.                                | Should   |
| FR-05-9  | Long lines SHALL wrap within the indentation area.                                                                                  | Must     |
| FR-05-10 | Line height SHALL be approximately 1.6× font size for readability.                                                                  | Should   |
| FR-05-11 | The first line of a memo SHALL be used as the preview text in the folded state.                                                     | Must     |
| FR-05-12 | Soft character limit per memo SHALL be approximately 10,000 characters.                                                             | Should   |
| FR-05-13 | Pressing Tab at max indent (level 3) SHALL have no effect.                                                                          | Must     |
| FR-05-14 | Pressing Shift+Tab at root level (level 0) SHALL have no effect.                                                                    | Must     |

### FR-06: Text Formatting

| ID      | Requirement                                                                                                                            | Priority |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-06-1 | Ctrl+B SHALL toggle bold on selected text; if no selection, toggle bold mode for new input from cursor.                                | Must     |
| FR-06-2 | Ctrl+Shift+X SHALL toggle strikethrough on selected text.                                                                              | Must     |
| FR-06-3 | The highlight tool SHALL apply a colored background to selected text. 3 fixed colors (yellow, green, pink).                            | Must     |
| FR-06-4 | Clicking the highlight button SHALL apply the last-used color; right-click or long-press SHALL show a color picker with the 3 options. | Should   |
| FR-06-5 | Highlight with no text selected SHALL have no effect.                                                                                  | Must     |
| FR-06-6 | The checkbox tool SHALL insert a toggleable checkbox at the beginning of the current line (after indentation).                         | Must     |
| FR-06-7 | Clicking a checkbox SHALL toggle done/undone state; done state SHALL apply strikethrough to the line text.                             | Must     |

### FR-07: Emoji Palette

| ID      | Requirement                                                                                                                                             | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-07-1 | Clicking the emoji button (😀) SHALL open a palette popup above the toolbar.                                                                            | Must     |
| FR-07-2 | The palette SHALL contain productivity-focused symbols: colored circles, squares, arrows, bullets, status marks, emphasis symbols, and separator lines. | Must     |
| FR-07-3 | Clicking a symbol SHALL insert it at the current cursor position.                                                                                       | Must     |
| FR-07-4 | The palette SHALL close after insertion or clicking outside.                                                                                            | Must     |
| FR-07-5 | Symbols SHALL be organized in a compact grid (no category tabs).                                                                                        | Should   |

### FR-08: Clipboard History

| ID       | Requirement                                                                                                                 | Priority |
| -------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-08-1  | The app SHALL monitor the system clipboard for text from app launch.                                                        | Must     |
| FR-08-2  | The clipboard history SHALL store up to 30 text items (FIFO — oldest removed when 31st is added).                           | Must     |
| FR-08-3  | Only text entries SHALL be captured; images and files SHALL be ignored.                                                     | Must     |
| FR-08-4  | Clipboard history SHALL be app-wide (shared across all memo windows).                                                       | Must     |
| FR-08-5  | Clicking the clipboard button (📋) SHALL open a popup panel showing recent clipboard items, newest first.                   | Must     |
| FR-08-6  | Each clipboard item SHALL display: text preview (first ~50 chars + "..."), an insert button (📥), and a copy button (📋).   | Must     |
| FR-08-7  | The insert button SHALL insert the full clipboard item text at the current cursor position in the last-focused edit window. | Must     |
| FR-08-8  | The insert button SHALL be disabled (grayed out) if no edit window is currently focused.                                    | Must     |
| FR-08-9  | The copy button SHALL copy the item back to the system clipboard.                                                           | Must     |
| FR-08-10 | The clipboard history panel SHALL remain open after insertion (to allow sequential inserts).                                | Should   |
| FR-08-11 | On first launch, the app SHALL inform the user that clipboard monitoring is active and allow disabling via Settings.        | Must     |
| FR-08-12 | Clipboard text longer than ~500 characters SHALL be stored in full but previewed with first ~50 chars.                      | Should   |

### FR-09: History Modal

| ID       | Requirement                                                                                                                        | Priority |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-09-1  | Clicking the history button (🕐) SHALL open the History modal as a centered overlay.                                               | Must     |
| FR-09-2  | The History modal top bar SHALL contain: a search input and a "+ New Memo" button.                                                 | Must     |
| FR-09-3  | The search input SHALL filter the memo list in real-time by content and tags.                                                      | Must     |
| FR-09-4  | Clicking "+ New Memo" SHALL close the History modal and open a blank edit window.                                                  | Must     |
| FR-09-5  | The History modal SHALL display all used tags as filter chips, with "#전체" (All) always first and selected by default.            | Must     |
| FR-09-6  | Multiple tags SHALL be selectable simultaneously (OR logic).                                                                       | Must     |
| FR-09-7  | Clicking a selected tag SHALL deselect it; deselecting all tags SHALL re-select "#전체".                                           | Must     |
| FR-09-8  | The memo list SHALL be sorted by last edited date, newest first.                                                                   | Must     |
| FR-09-9  | Maximum 50 memos SHALL be stored. When the 51st is created, the oldest SHALL be permanently deleted.                               | Must     |
| FR-09-10 | Each memo row SHALL show: color indicator, text preview (~30 chars), tags, last edited date (YYYY.MM.DD), delete button (🗑️).      | Must     |
| FR-09-11 | Clicking a memo row SHALL close the History modal and open the memo in edit state (added to folded stack).                         | Must     |
| FR-09-12 | Clicking delete (🗑️) SHALL show a confirmation dialog before permanently deleting the memo.                                        | Must     |
| FR-09-13 | Confirmation dialog text SHALL be: "이 메모를 삭제하시겠습니까? 삭제된 메모는 복구할 수 없습니다." with [취소] and [삭제] buttons. | Must     |
| FR-09-14 | Pressing Esc or clicking outside the modal SHALL close it.                                                                         | Must     |
| FR-09-15 | Empty search results SHALL show: "검색 결과가 없습니다".                                                                           | Must     |
| FR-09-16 | Empty history state SHALL show: "저장된 메모가 없습니다" with a prominent "+ New Memo" button.                                     | Must     |
| FR-09-17 | The total memo count SHALL be displayed (e.g., "Showing X of Y memos").                                                            | Should   |

### FR-10: Auto-Save

| ID      | Requirement                                                                            | Priority |
| ------- | -------------------------------------------------------------------------------------- | -------- |
| FR-10-1 | Memo content SHALL be auto-saved after a 1.5-second debounce following each keystroke. | Must     |
| FR-10-2 | Memo content SHALL be saved when the edit window is folded or closed.                  | Must     |
| FR-10-3 | Memo content SHALL be saved when the app is quit.                                      | Must     |
| FR-10-4 | There SHALL be no manual save button or "unsaved changes" warnings.                    | Must     |

### FR-11: Screen Edge Snapping

| ID      | Requirement                                                                                             | Priority |
| ------- | ------------------------------------------------------------------------------------------------------- | -------- |
| FR-11-1 | Both the folded panel and edit windows SHALL snap to screen edges when dragged within 20px of any edge. | Must     |
| FR-11-2 | Snapping SHALL work on all edges: top, bottom, left, right.                                             | Must     |
| FR-11-3 | Corner snapping (e.g., top-right) SHALL be supported when near two edges simultaneously.                | Should   |
| FR-11-4 | Dragging more than 20px away from a snapped edge SHALL release the snap.                                | Must     |
| FR-11-5 | Dual monitor support: each monitor's edges SHALL be independently recognized.                           | Should   |
| FR-11-6 | The folded panel position SHALL be persisted and restored on app restart.                               | Must     |
| FR-11-7 | If a monitor is disconnected, any window on that monitor SHALL be moved to the primary monitor.         | Should   |

### FR-12: System Tray

| ID      | Requirement                                                                                                    | Priority |
| ------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| FR-12-1 | The app SHALL place an icon in the system tray when running.                                                   | Must     |
| FR-12-2 | Left-clicking the tray icon SHALL toggle the folded panel visibility (show/hide).                              | Must     |
| FR-12-3 | Right-clicking the tray icon SHALL open a context menu with: Show SnapNote, New Memo, History, Settings, Quit. | Must     |
| FR-12-4 | "Show SnapNote" SHALL show the folded panel.                                                                   | Must     |
| FR-12-5 | "New Memo" SHALL open a blank edit window.                                                                     | Must     |
| FR-12-6 | "History" SHALL open the History modal.                                                                        | Must     |
| FR-12-7 | "Settings" SHALL open the Settings window.                                                                     | Must     |
| FR-12-8 | "Quit" SHALL exit the app completely (all windows closed, tray icon removed).                                  | Must     |

### FR-13: Settings

| ID      | Requirement                                                                                              | Priority |
| ------- | -------------------------------------------------------------------------------------------------------- | -------- |
| FR-13-1 | Settings SHALL be accessible via System Tray → Settings.                                                 | Must     |
| FR-13-2 | "Launch on startup" setting (default: OFF) SHALL register/deregister the app with the OS startup.        | Should   |
| FR-13-3 | "Clipboard monitoring" setting (default: ON) SHALL enable/disable clipboard history capture.             | Must     |
| FR-13-4 | "Memo slot colors" setting SHALL allow customizing the 3 color indicators (default: coral, green, blue). | Should   |
| FR-13-5 | "Edit window default size" setting SHALL define dimensions for new edit windows (default: 400×500).      | Should   |
| FR-13-6 | Global keyboard shortcut setting SHALL allow changing the show/hide shortcut (default: Ctrl+Shift+M).    | Should   |
| FR-13-7 | "Export memos" SHALL export all memos as a JSON file.                                                    | Should   |
| FR-13-8 | "Import memos" SHALL import memos from a JSON file.                                                      | Should   |
| FR-13-9 | "Clear all data" SHALL delete all memos and settings after confirmation.                                 | Should   |

### FR-14: Keyboard Shortcuts

| ID      | Requirement            | Shortcut       | Scope                |
| ------- | ---------------------- | -------------- | -------------------- |
| FR-14-1 | Show/hide folded panel | `Ctrl+Shift+M` | Global (system-wide) |
| FR-14-2 | Create new memo        | `Ctrl+N`       | App                  |
| FR-14-3 | Open History modal     | `Ctrl+H`       | App                  |
| FR-14-4 | Indent line            | `Tab`          | Text editor          |
| FR-14-5 | Outdent line           | `Shift+Tab`    | Text editor          |
| FR-14-6 | Toggle bold            | `Ctrl+B`       | Text editor          |
| FR-14-7 | Toggle strikethrough   | `Ctrl+Shift+X` | Text editor          |
| FR-14-8 | Fold edit window       | `Esc`          | Edit window          |
| FR-14-9 | Close History modal    | `Esc`          | History modal        |

---

## 3. Non-Functional Requirements

### NFR-01: Performance

| ID       | Requirement                                            |
| -------- | ------------------------------------------------------ |
| NFR-01-1 | App cold start to tray icon visible: < 3 seconds       |
| NFR-01-2 | Folded panel to edit window open: < 200ms              |
| NFR-01-3 | Auto-save write completion: < 100ms                    |
| NFR-01-4 | History modal open (50 memos): < 300ms                 |
| NFR-01-5 | Search/filter response in History: < 100ms (real-time) |
| NFR-01-6 | App idle memory footprint: < 150MB RAM                 |

### NFR-02: Reliability

| ID       | Requirement                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| NFR-02-1 | No data loss on unexpected app crash (last 1.5s debounce tolerance acceptable)                                    |
| NFR-02-2 | Storage file corruption SHALL not cause app startup failure; app SHALL start with a clean state and log the error |
| NFR-02-3 | App SHALL handle monitor disconnection gracefully without crashing                                                |

### NFR-03: Usability

| ID       | Requirement                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------- |
| NFR-03-1 | All UI text SHALL support Korean (primary) and English                                              |
| NFR-03-2 | Folded panel SHALL never obstruct primary workflow (non-intrusive always-on-top)                    |
| NFR-03-3 | Hover → preview delay SHALL be perceptible but not annoying (100–200ms suggested)                   |
| NFR-03-4 | Visual distinction between read-only preview and editable edit window SHALL be immediately apparent |

### NFR-04: Security

| ID       | Requirement                                                               |
| -------- | ------------------------------------------------------------------------- |
| NFR-04-1 | All memo data SHALL be stored locally only; no network transmission in v1 |
| NFR-04-2 | Clipboard data SHALL not be logged or transmitted externally              |
| NFR-04-3 | App SHALL request only necessary OS permissions                           |

### NFR-05: Compatibility

| ID       | Requirement                                                      |
| -------- | ---------------------------------------------------------------- |
| NFR-05-1 | Target OS: Windows 10 (build 1903+) and Windows 11               |
| NFR-05-2 | DPI scaling: Support 100%, 125%, 150%, 200% display scaling      |
| NFR-05-3 | Multi-monitor: Support 2+ monitors with independent DPI settings |

---

## 4. Data Requirements

### DR-01: Memo Object

Each memo SHALL store the following fields:

| Field        | Type         | Description                                               |
| ------------ | ------------ | --------------------------------------------------------- |
| id           | UUID         | Unique identifier                                         |
| content      | JSON         | Structured content with indentation levels and formatting |
| tags         | string[]     | Array of hashtag strings                                  |
| color        | string       | Assigned color indicator                                  |
| isPinned     | boolean      | Always-on-top toggle state                                |
| windowX      | number       | Last window X position                                    |
| windowY      | number       | Last window Y position                                    |
| windowWidth  | number       | Last window width                                         |
| windowHeight | number       | Last window height                                        |
| createdAt    | ISO datetime | Timestamp of creation                                     |
| updatedAt    | ISO datetime | Timestamp of last modification                            |

### DR-02: App State

| Field        | Type     | Description                                                 |
| ------------ | -------- | ----------------------------------------------------------- |
| foldedStack  | UUID[3]  | Ordered list of memo IDs in the folded stack (newest first) |
| foldedPanelX | number   | Folded panel last X position                                |
| foldedPanelY | number   | Folded panel last Y position                                |
| settings     | Settings | User settings object                                        |

### DR-03: Clipboard History

| Field | Type     | Description                                          |
| ----- | -------- | ---------------------------------------------------- |
| items | string[] | Array of clipboard text items (max 30), newest first |

---

## 5. Constraints

- v1 targets Windows only; macOS is out of scope
- No cloud sync, collaboration, or sharing features in v1
- No dark mode in v1
- No drag-and-drop line reordering in v1
- No markdown rendering or export in v1
- Rich text paste is NOT supported in v1 (paste as plain text only)
- No image or file attachments in v1
- Maximum 50 memos in history (hard limit)
- Maximum 3 memos in folded stack (hard limit)
- Maximum 30 clipboard history items (hard limit)

---

## 6. User Stories

| ID    | Story                                                                           | Acceptance Criteria                                                      |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| US-01 | As a user, I want to see my recent memos at a glance without switching windows. | Folded panel shows up to 3 memos at all times, always on top.            |
| US-02 | As a user, I want to quickly peek at a memo by hovering over it.                | Preview opens on hover, closes after 3s of no interaction.               |
| US-03 | As a user, I want to write structured notes with visual hierarchy.              | Tab/Shift+Tab controls indentation levels with visual feedback.          |
| US-04 | As a user, I want to organize memos with tags and find them later.              | Tags are assigned per memo; History modal filters by tag.                |
| US-05 | As a user, I want to paste recent clipboard content directly into a memo.       | Clipboard history shows 30 items with insert-at-cursor action.           |
| US-06 | As a user, I want the app to stay out of my way when I'm not using it.          | Folded panel is compact; snaps to screen edges; system tray integration. |
| US-07 | As a user, I never want to lose my notes.                                       | Auto-save with 1.5s debounce; data persists through crashes.             |
| US-08 | As a user, I want to keep specific memos always visible.                        | Per-window pin toggle keeps edit window always on top.                   |
