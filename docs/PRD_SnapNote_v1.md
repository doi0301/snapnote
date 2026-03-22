# SnapNote — Desktop Memo App PRD

> **Version:** 1.0  
> **Date:** 2026-03-21  
> **Status:** Ready for Development  
> **Platform:** Desktop App (Windows first, macOS later)

---

## 1. Product Overview

### 1.1 One-liner

A desktop memo app that snaps to screen edges, stays out of your way when folded, and lets you write structured notes with tree-style indentation.

### 1.2 Core Use Cases

| Case                | Description                                                                           |
| ------------------- | ------------------------------------------------------------------------------------- |
| Task breakdown      | Write today's tasks and sub-steps in a structured tree, reference while working       |
| LLM prompt drafting | Draft and iterate on prompts with clear visual hierarchy                              |
| Research synthesis  | Gather content from multiple sources via clipboard history, organize with indentation |

### 1.3 Key Principles

- **Non-intrusive**: folded state takes minimal space, never blocks work
- **Instant access**: hover to preview, click to edit — no hunting for windows
- **Structured writing**: 4-level indentation with visual hierarchy, not a plain text box

---

## 2. Window States

The app has **3 window states**. The folded state is the persistent anchor; edit windows open from it.

### 2.1 Folded State (Default)

The folded state is the app's home. It's always visible and always shows the most recent memos.

**Layout:**

```
┌──────────────────────────────────┐
│ 🔴 메모 내용 10자까지...  [✏️][✕] │  ← memo 1 (newest)
├──────────────────────────────────┤
│ 🟢 다른 메모 내용이...    [✏️][✕] │  ← memo 2
├──────────────────────────────────┤
│ 🔵 세번째 메모 텍스...    [✏️][✕] │  ← memo 3 (oldest)
└──────────────────────────────────┘
```

**Behavior:**

- Displays the **3 most recently edited** memos in a vertical stack, newest on top
- Each memo is assigned a **unique color indicator** (from a fixed set of 3 colors) for visual distinction
- Always on top (folded state is always pinned above other windows)
- Snaps to screen edges (see Section 3)
- When a **new memo is created** and there are already 3 in the stack, the **oldest one is removed** from the folded view (but remains accessible in History)

**Each memo row contains:**

| Element         | Spec                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| Color indicator | Left-side color bar or dot. 3 fixed colors assigned in rotation (e.g. coral, green, blue) |
| Text preview    | First 10 characters of memo content + "..." truncation                                    |
| Edit button     | Icon button (pencil). Click → opens edit window for this memo                             |
| Close button    | Icon button (×). Click → removes from folded stack. Memo remains in History               |

**Interactions:**

- The entire folded panel can be **dragged** to reposition
- Clicking ✏️ opens the corresponding memo in edit state
- Clicking ✕ removes that memo from the folded stack (does NOT delete from history)
- Folded state cannot be closed entirely — it's the app's persistent UI (close via system tray > Quit)

> **Design note:** The close (✕) behavior needs to be clearly distinguished from deletion. Closing a memo from the folded stack simply "puts it away" — the memo is still saved and accessible from History. Actual deletion only happens inside the History modal.

### 2.2 Preview State (Hover)

A temporary view triggered by hovering over a folded memo row.

**Behavior:**

- When the user **hovers** over any memo row in the folded state, the **edit window for that memo appears** after a short delay
- The preview window is displayed for **3 seconds** after the mouse leaves the hover area
- The preview window is **read-only** — user cannot edit in this state
- If the user **moves the mouse into the preview window** within the 3-second timeout, the window stays open (does not auto-close) and remains read-only
- If the user **clicks** anywhere inside the preview window, it transitions to **Edit state** (becomes editable)
- If the mouse leaves both the folded row and preview window, the 3-second countdown begins; after timeout, the preview window closes

**Preview window appearance:**

- Same layout as the edit window (Section 2.3) but with a subtle visual difference (e.g. slightly dimmed or a "read-only" badge) to indicate it's not editable
- Appears adjacent to the folded state (positioned next to the folded stack, not overlapping it)

> **Design note:** The 3-second timeout prevents flickering when the user accidentally hovers. The "mouse into preview keeps it open" rule prevents frustration when the user is reading a longer memo.

### 2.3 Edit State

The full editing window. Opens when the user clicks the ✏️ button on a folded memo or clicks inside a preview window.

**Overall layout:**

```
┌──────────────────────────────────────────┐
│ [📌 on/off]              [━ fold] [✕ close] │  ← a. Top bar
├──────────────────────────────────────────┤
│ #업무 #계획                               │  ← b. Tag input
├──────────────────────────────────────────┤
│ ┃ 프로젝트 A 진행상황                     │
│ ┃   ┃ API 설계 완료                       │
│ ┃   ┃   ┃ 엔드포인트 목록 작성            │  ← c. Text input area
│ ┃   ┃ 테스트 코드 작성중                  │     (grid + indentation)
│ ┃ 내일 할일                               │
│ ┃   ┃ 코드리뷰 요청                       │
│                                          │
├──────────────────────────────────────────┤
│ [😀] [📋] [B] [S̶] [🖍️] [☑️]    [🕐]    │  ← d. Bottom toolbar
└──────────────────────────────────────────┘
```

#### a. Top bar

| Element          | Behavior                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pin toggle (📌)  | **ON**: this edit window stays always-on-top. **OFF**: edit window behaves as a normal window (can be covered by other apps). Default: OFF. Toggle state is per-memo and remembered. |
| Fold button (━)  | Closes the edit window. The memo remains in the **folded stack**. Equivalent to minimizing back to folded state.                                                                     |
| Close button (✕) | Closes the edit window AND removes the memo from the **folded stack**. The memo is saved and accessible from History.                                                                |

> **Clarification on always-on-top logic:**
>
> - The **folded state** is ALWAYS on top (not toggleable)
> - The **edit window's** always-on-top is toggleable via the pin button
> - This means: folded stack = always visible, edit windows = user's choice

#### b. Tag input

- Text input field for hashtag-style tags
- Placeholder text: `ex. #업무 #계획`
- User types tags separated by spaces (e.g. `#업무 #개인 #프로젝트A`)
- Tags are saved per memo and used for filtering in History
- Tag autocomplete: after typing `#`, suggest previously used tags in a dropdown
- Tags are **freeform** — no predefined categories, user creates as needed

#### c. Text input area

The main editing surface. This is where structured writing happens.

**Grid appearance:**

- Light gray horizontal grid lines between each row (like an Excel sheet)
- Creates a subtle lined-notebook feel for readability
- Grid lines are cosmetic only (no cell selection, no column concept)

**Indentation (core feature):**

| Action                 | Key         | Result                                              |
| ---------------------- | ----------- | --------------------------------------------------- |
| Indent                 | `Tab`       | Move current line one level deeper (max 4 levels)   |
| Outdent                | `Shift+Tab` | Move current line one level shallower (min level 0) |
| New line at same level | `Enter`     | Create new line at same indentation level           |

- **Max depth: 4 levels** (level 0 = root, level 1~3 = indented)
- **Visual hierarchy**: each indentation level has a progressively **lighter gray background fill**
  - Level 0: white (no fill)
  - Level 1: #F8F8F8
  - Level 2: #F0F0F0
  - Level 3: #E8E8E8
- **Indentation guide**: vertical thin line (1px, light gray) at each indent level boundary
- The indentation applies to the **entire line**, not individual words

**Text behavior:**

- Single-line wrapping: long lines wrap within the indentation area
- No separate "title" field — the first line of the memo is treated as the preview text in folded state
- Line height should be comfortable for readability (approximately 1.6× font size)

#### d. Bottom toolbar

Left-aligned tools, right-aligned utility:

**(1) Emoji favorites button (😀)**

- Click → opens an emoji palette popup above the toolbar
- The palette contains **productivity-focused colored symbols**, not a full emoji keyboard:
  - Colored circles: 🔴🟠🟡🟢🔵🟣
  - Colored squares: 🟥🟧🟨🟩🟦🟪
  - Arrows: ➡️⬅️⬆️⬇️↗️↘️
  - Bullets/dots: ⚫◾▪️●○◆
  - Status marks: ✅✔️❌⭕
  - Emphasis: ⭐🔥💡❗❓
  - Separators: ━━━ ─── ═══
- Organized in a compact grid layout (no category tabs)
- Click an emoji → inserts at cursor position in text area
- Palette closes after insertion (or click outside)

**(2) Clipboard history button (📋)**

- Click → opens a clipboard history panel (popup above toolbar)
- Shows a list of **recently copied text items**, newest first
- **Max 30 items** stored
- Each item shows:
  - Text preview (first ~50 characters, truncated with "...")
  - Insert button (📥) → inserts the full text at the **current cursor position** in the active edit window. If no edit window is focused, this button is disabled (grayed out)
  - Copy button (📋) → copies that item back to system clipboard (for use in other apps)
- After clicking Insert, the clipboard history panel **stays open** (user may want to insert multiple items sequentially)
- Clipboard history is **app-wide** (shared across all memo windows)
- Clipboard monitoring starts when the app launches and runs in background
- Items older than 30 entries are automatically removed (FIFO)

> **Design note:** Clipboard history monitors the system clipboard. On first launch, inform the user that the app will monitor clipboard for productivity features, and allow disabling in settings.

**(3) Text formatting tools:**

| Tool          | Icon  | Behavior                                                                                                                                                                                               |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bold          | **B** | Toggle bold on selected text. If no selection, toggle bold mode for new text from cursor.                                                                                                              |
| Strikethrough | ~~S~~ | Toggle strikethrough on selected text.                                                                                                                                                                 |
| Highlight     | 🖍️    | Apply colored background highlight to selected text. **3 fixed colors** (e.g. yellow, green, pink). Click to apply last-used color. Long-press or right-click to show color picker with the 3 options. |
| Checkbox      | ☑️    | Insert a toggleable checkbox at the beginning of the current line. Click the checkbox to toggle done/undone. Done state applies strikethrough to the line text.                                        |

**(4) History button (🕐)**

- Positioned at the **right end** of the toolbar (visually separated from editing tools)
- Click → opens the History modal (Section 2.4)

### 2.4 History Modal

A centered modal overlay that shows all previously saved memos.

**Layout:**

```
┌──────────────────────────────────────────────┐
│                    History                     │
├──────────────────────────────────────────────┤
│ [🔍 Search memos...          ] [+ New Memo]  │  ← a. Top bar
├──────────────────────────────────────────────┤
│ [#전체] [#업무] [#개인] [#계획] [#프롬프트]   │  ← b. Tag filters
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ 🔴 프로젝트A 진행상황 정리...             │ │
│ │ #업무 #계획          2026.03.21    [🗑️]  │ │  ← c. Memo list
│ ├──────────────────────────────────────────┤ │
│ │ 🟢 LLM 프롬프트 초안 작성중...           │ │
│ │ #프롬프트             2026.03.20    [🗑️]  │ │
│ ├──────────────────────────────────────────┤ │
│ │ 🔵 주간 회의 안건 정리하기...             │ │
│ │ #업무               2026.03.19    [🗑️]  │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│              Showing 3 of 48 memos           │
└──────────────────────────────────────────────┘
```

#### a. Top bar

| Element             | Behavior                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search input        | Keyword search across memo content and tags. Filters list in real-time as user types.                                                               |
| New Memo button (+) | Click → closes History modal and opens a **blank edit window**. The new memo appears in the folded stack (oldest in stack is removed if already 3). |

#### b. Tag category filter

- Displays all tags that have been used across all saved memos
- First item is always `#전체` (All) — shows all memos, selected by default
- Click a tag to filter. **Multiple tags selectable** (OR logic: shows memos that have ANY of the selected tags)
- Selected tags are visually highlighted (filled background)
- Click a selected tag again to deselect
- Selecting any specific tag deselects `#전체`; deselecting all specific tags re-selects `#전체`
- Tag list scrolls horizontally if there are many tags

#### c. Memo preview list

- Sorted by **last edited date**, newest first
- **Maximum 50 memos** stored. When the 51st memo is created, the oldest is permanently deleted
- The list scrolls vertically

**Each memo row shows:**

| Element            | Detail                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| Color indicator    | Matching the color assigned when it was in folded stack (or a neutral gray if it was never in a slot) |
| Text preview       | First ~30 characters of memo content + "..."                                                          |
| Tags               | All tags assigned to this memo                                                                        |
| Last edited date   | Format: YYYY.MM.DD                                                                                    |
| Delete button (🗑️) | Permanently deletes the memo                                                                          |

**Interactions:**

- **Click a memo row** → closes History modal and opens that memo in edit state. Memo is added to the folded stack (replacing the oldest if stack is full)
- **Click delete (🗑️)** → confirmation alert: "이 메모를 삭제하시겠습니까? 삭제된 메모는 복구할 수 없습니다." with [취소] and [삭제] buttons. On confirm → permanently deleted.
- **Click outside the modal** or press **Esc** → closes the History modal

---

## 3. Screen Edge Snapping

### 3.1 Behavior

- **Applies to**: folded state panel AND edit windows
- **Snap trigger**: when dragging a window within **20px** of any screen edge, it snaps flush to that edge
- **Snap edges**: top, bottom, left, right of each monitor
- **Dual monitor support**: each monitor's edges are independently recognized. A window near the left edge of monitor 2 snaps to monitor 2's left edge, not to monitor 1's right edge
- **Corner snapping**: when near two edges simultaneously (e.g. top-right corner), snaps to the corner
- **Snap release**: dragging away from the edge by more than 20px releases the snap

### 3.2 Position persistence

- The folded state remembers its last position and restores on app restart
- Each edit window remembers its position per memo
- If a monitor is disconnected, windows on that monitor are moved to the primary monitor

---

## 4. Window Sizing

### 4.1 Folded state

- **Width**: fixed (approximately 280px — enough for 10 characters + 2 icon buttons + color indicator)
- **Height**: determined by number of visible memos (1~3 rows). Empty state shows a single row with "+ New Memo" prompt
- **Not user-resizable**

### 4.2 Edit window

- **Default size**: 400px × 500px
- **Minimum size**: 300px × 350px
- **Maximum size**: no limit (up to screen size)
- **Resizable**: by dragging any edge or corner
- **Size persistence**: each memo remembers its last window size and restores when reopened

---

## 5. Data & Auto-save

### 5.1 Auto-save behavior

- Memo content is **auto-saved** continuously:
  - On every pause in typing (**1.5 second debounce** after last keystroke)
  - When the edit window is closed (fold or close)
  - When the app is quit
- No manual save button — saving is always automatic
- No "unsaved changes" warnings needed

### 5.2 Storage limits

| Data type               | Limit                         | Overflow behavior                               |
| ----------------------- | ----------------------------- | ----------------------------------------------- |
| Memos in folded stack   | 3                             | Oldest removed from stack (stays in history)    |
| Memos in history        | 50                            | Oldest permanently deleted when 51st is created |
| Clipboard history items | 30                            | Oldest removed (FIFO)                           |
| Tags                    | No limit                      | —                                               |
| Single memo text length | Soft limit ~10,000 characters | —                                               |

### 5.3 What is saved per memo

| Field            | Description                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Content          | Full text with formatting (bold, strikethrough, highlights, checkboxes, indentation levels) |
| Tags             | All assigned hashtags                                                                       |
| Color            | Assigned color indicator                                                                    |
| Pin state        | Whether always-on-top was enabled                                                           |
| Window position  | Last X, Y coordinates                                                                       |
| Window size      | Last width, height                                                                          |
| Created date     | Timestamp of first creation                                                                 |
| Last edited date | Timestamp of last modification                                                              |

---

## 6. System Tray

The app lives in the system tray when all windows are minimized or closed.

### 6.1 Tray icon behavior

| Action      | Result                                     |
| ----------- | ------------------------------------------ |
| Left-click  | Toggle folded panel visibility (show/hide) |
| Right-click | Open context menu                          |

### 6.2 Context menu

| Menu item     | Action                                                         |
| ------------- | -------------------------------------------------------------- |
| Show SnapNote | Show the folded panel                                          |
| New Memo      | Open a blank edit window                                       |
| History       | Open History modal                                             |
| Settings      | Open settings window                                           |
| Quit          | Exit the app completely (all windows close, tray icon removed) |

---

## 7. Settings

Accessible from system tray context menu → Settings.

| Category       | Setting                  | Default              | Description                              |
| -------------- | ------------------------ | -------------------- | ---------------------------------------- |
| **General**    | Launch on startup        | OFF                  | Start app when OS boots                  |
|                | Clipboard monitoring     | ON                   | Enable/disable clipboard history capture |
| **Appearance** | Memo slot colors         | Coral / Green / Blue | Customize the 3 color indicators         |
|                | Edit window default size | 400×500              | Default dimensions for new edit windows  |
| **Shortcuts**  | Global show/hide         | `Ctrl+Shift+M`       | System-wide shortcut to toggle app       |
| **Data**       | Export memos             | —                    | Export all memos as JSON                 |
|                | Import memos             | —                    | Import memos from JSON file              |
|                | Clear all data           | —                    | Delete everything (with confirmation)    |

---

## 8. Keyboard Shortcuts

| Shortcut       | Scope                | Action                             |
| -------------- | -------------------- | ---------------------------------- |
| `Ctrl+Shift+M` | Global (system-wide) | Show/hide folded panel             |
| `Ctrl+N`       | App                  | Create new memo                    |
| `Ctrl+H`       | App                  | Open History modal                 |
| `Tab`          | Text editor          | Indent current line (max 4 levels) |
| `Shift+Tab`    | Text editor          | Outdent current line               |
| `Ctrl+B`       | Text editor          | Toggle bold                        |
| `Ctrl+Shift+X` | Text editor          | Toggle strikethrough               |
| `Esc`          | Edit window          | Fold current edit window           |
| `Esc`          | History modal        | Close History modal                |

---

## 9. User Flow Diagrams

### 9.1 App launch → first memo

```
App Launch
    │
    ▼
System Tray icon appears + Folded panel shown
    │
    ▼
Folded panel is empty → shows "+ New Memo" prompt
    │
    ▼
User clicks [+ New Memo] or presses Ctrl+N
    │
    ▼
Blank edit window opens
    │
    ▼
User types content, adds tags → auto-saved continuously
    │
    ▼
User clicks [fold] button or presses Esc
    │
    ▼
Edit window closes → memo appears in folded stack as row 1
```

### 9.2 Folded → Preview → Edit flow

```
Folded state (up to 3 memos visible)
    │
    ├─ User hovers over a memo row
    │       │
    │       ▼
    │   Preview window appears (read-only, beside folded panel)
    │       │
    │       ├─ Mouse leaves both areas → 3s timer → preview closes
    │       ├─ Mouse enters preview window → stays open (read-only)
    │       │       └─ Mouse leaves → 3s timer → closes
    │       └─ User clicks inside preview → transitions to Edit state
    │
    ├─ User clicks ✏️ button → Edit window opens directly
    │
    └─ User clicks ✕ button → memo removed from stack (saved in History)
```

### 9.3 Memo lifecycle

```
                    ┌────────────┐
         Ctrl+N or  │            │
         + button   │  Created   │
                    │            │
                    └─────┬──────┘
                          │
                          ▼
                    ┌────────────┐
                    │  In Folded │ ◄──── Reopened from History
                    │   Stack    │
                    │  (1 of 3)  │
                    └──┬─────┬───┘
                       │     │
          Closed (✕)   │     │  Pushed out by newer memo
          from stack   │     │
                       ▼     ▼
                    ┌────────────┐
                    │ In History │
                    │ (up to 50) │
                    └──┬─────┬───┘
                       │     │
          User deletes │     │  51st memo pushes oldest out
                       ▼     ▼
                    ┌────────────┐
                    │ Permanently│
                    │  Deleted   │
                    └────────────┘
```

---

## 10. Edge Cases & Decisions

| Situation                                                | Decision                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| User opens edit for a memo already open in edit          | Bring existing edit window to front (no duplicate windows)                                          |
| User creates 4th memo while 3 in stack                   | Oldest memo leaves the folded stack, saved to History                                               |
| App crash during edit                                    | Auto-saved content (last 1.5s debounce) is preserved                                                |
| Monitor disconnected while folded panel on it            | Move folded panel to primary monitor                                                                |
| Clipboard content is image/file (not text)               | Ignored — only text entries are captured                                                            |
| Clipboard text is very long (>500 chars)                 | Show first ~50 chars in clipboard history preview; full text is copied when user clicks copy button |
| History search returns no results                        | Show "검색 결과가 없습니다" empty state                                                             |
| History is completely empty                              | Show "저장된 메모가 없습니다" with prominent [+ New Memo] button                                    |
| Multiple edit windows open at once                       | Allowed. Each memo gets its own edit window. Pin state is per-window                                |
| Highlight applied with no text selected                  | No effect — highlight requires text selection                                                       |
| Checkbox on indented line                                | Checkbox appears after the indentation, at the beginning of the text                                |
| User presses Tab at max indent (level 3)                 | No further indentation; line stays at level 3                                                       |
| User presses Shift+Tab at root level (level 0)           | No effect; already at minimum indentation                                                           |
| Empty folded stack (all memos closed)                    | Folded panel shows single row: "메모가 없습니다. + 새 메모"                                         |
| Preview hover while an edit window for same memo is open | No preview shown — edit window is already open                                                      |
| Clipboard insert clicked with no edit window focused     | Insert button is disabled (grayed out). Only copy button is available                               |
| Clipboard insert clicked with multiple edit windows open | Inserts into the **last-focused** edit window at its cursor position                                |

---

## 11. MVP Scope

### Included in v1

- Folded state: 3 memo slots, color indicators, always-on-top, draggable, edge snap
- Preview on hover: 3-second timeout, read-only, click to edit
- Edit window: pin toggle, fold, close, resizable, position/size persistence
- Tag input: freeform hashtags, autocomplete from history
- Text editor: 4-level indentation (Tab/Shift+Tab), grid lines, level background colors, line wrapping
- Emoji palette: productivity-focused symbols
- Clipboard history: 30 items, insert at cursor position, copy back to clipboard
- Text formatting: bold, strikethrough, 3-color highlight, checkbox with strikethrough
- History modal: search, multi-tag filter (OR), delete with confirmation, max 50 memos
- System tray: left-click toggle, right-click menu
- Auto-save: 1.5s debounce + on close/quit
- Settings: startup, clipboard toggle, color customization, shortcuts, data export/import
- Keyboard shortcuts: global show/hide, new memo, history, indent/outdent, bold, strikethrough, esc to fold
- Dual monitor edge snapping

### Not in v1 (future)

- Dark mode
- Cloud sync / multi-device
- Drag-and-drop line reordering within the editor
- Markdown rendering or export
- macOS support
- Image or file attachments
- Collaboration or sharing features
- Rich text paste (paste as plain text only in v1)

---

## 12. Glossary

| Term              | Definition                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Folded state      | The compact, always-visible vertical stack showing up to 3 memo previews                      |
| Folded stack      | The collection of up to 3 memos displayed in the folded state                                 |
| Preview state     | Temporary read-only popup triggered by hovering over a folded memo row                        |
| Edit state        | The full editing window where memos are written and modified                                  |
| Pin               | Per-window always-on-top toggle (📌) in the edit window top bar                               |
| History           | The persistent storage of all memos (up to 50), browsable via the History modal               |
| Clipboard history | Separate feature that captures system clipboard text and stores recent copies (up to 30)      |
| Snap              | Window behavior that magnetically attaches the app to screen edges when dragged nearby        |
| Slot              | One of the 3 positions in the folded stack                                                    |
| Tag               | A freeform #hashtag label assigned to a memo for categorization and filtering                 |
| Indent level      | The depth of a text line (0–3), controlled by Tab/Shift+Tab, visualized with background color |
