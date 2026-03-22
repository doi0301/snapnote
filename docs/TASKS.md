# SnapNote — Development Tasks

> **Version:** 1.0
> **Date:** 2026-03-21
> **Based on:** SRD_SnapNote_v1.md, TRD_SnapNote_v1.md

---

## Overview

총 6개 스프린트로 구성. 각 스프린트는 독립적으로 동작 가능한 기능 단위로 묶음.

| Sprint | Focus                                  | 예상 작업량 |
| ------ | -------------------------------------- | ----------- |
| S0     | 프로젝트 세팅 & 인프라                 | 기반 작업   |
| S1     | 데이터 레이어 & 코어 IPC               | 핵심 데이터 |
| S2     | Folded Panel & Window 관리             | 메인 UI     |
| S3     | Edit Window & 텍스트 에디터            | 에디터      |
| S4     | 보조 기능 (클립보드, 이모지, 히스토리) | 기능 완성   |
| S5     | 시스템 통합 & 마무리                   | 배포 준비   |

---

## Sprint 0: 프로젝트 세팅 & 인프라

### TASK-S0-01: 프로젝트 초기화

- **설명**: electron-vite + React + TypeScript 기반 프로젝트 scaffolding
- **체크리스트**:
  - [x] 공식 Quick Start: `npm create @quick-start/electron@latest snapnote -- --template react-ts --skip` 후 루트로 이동 — **productName / appId = SnapNote / com.snapnote.app**
  - [x] TypeScript `strict: true` (`tsconfig.node.json`, `tsconfig.web.json`)
  - [x] ESLint + Prettier (템플릿 기본)
  - [x] Git 저장소 초기화 + `.gitignore` (템플릿)
  - [x] `src/shared` 생성 및 `@shared` 별칭 (`electron.vite.config.ts` + tsconfig paths)
- **완료 기준**: `npm run dev` 실행 시 빈 Electron 창 뜨는 것 확인

### TASK-S0-02: 공유 타입 & IPC 채널 정의

- **설명**: 모든 프로세스에서 공유하는 TypeScript 타입 및 IPC 채널 상수 파일 작성
- **체크리스트**:
  - [x] `src/shared/types.ts` 작성: `Memo`, `EditorLine`, `TextSpan`, `ClipboardItem`, `Settings`, `AppState` 인터페이스
  - [x] `src/shared/ipc-channels.ts` 작성: 모든 IPC 채널명을 상수로 정의
  - [x] `src/preload/index.ts` 작성: contextBridge로 IPC invoke/on 노출 — **`window.snapnote` 단일 네임스페이스** (`docs/STUDY.md` 결정)
- **완료 기준**: 타입 오류 없이 컴파일

### TASK-S0-03: SQLite 데이터베이스 초기화

- **설명**: SQLite 스키마 초기화 (구현: **`sql.js`** — 네이티브 빌드 없이 Windows/Node 24 호환)
- **체크리스트**:
  - [x] **`sql.js`(WASM SQLite)** 사용 — Windows에서 Node 24 + VS Build Tools 없이 동작 (better-sqlite3 네이티브 빌드 실패 회피). 변경 후 `persistDatabase()`로 파일 반영
  - [x] `src/main/database/schema.ts`: CREATE TABLE (memos, app_state, settings, clipboard_history) + singleton 시드 + `user_version`
  - [x] `src/main/database/db.ts`: `app.setName('SnapNote')` 후 `userData/snapnote.db`, `initDatabase()`(async) / `before-quit` 시 `closeDatabase()` + `persistDatabase()` (sql.js는 WAL 파일 핸들 없음)
  - [x] Windows 경로: `%APPDATA%\SnapNote\` 아래 `snapnote.db` (Electron `getPath('userData')`)
- **완료 기준**: 앱 최초 실행 시 DB 파일 자동 생성 및 테이블 생성 확인 — 개발 시 콘솔 `[SnapNote] SQLite: ...` 로그

### TASK-S0-04: electron-builder 배포 설정

- **설명**: Windows NSIS 인스톨러 빌드 설정
- **체크리스트**:
  - [x] `electron-builder.yml` — appId / productName / NSIS (템플릿 기반 유지, `win.icon: build/icon.ico`)
  - [x] 임시 아이콘: `resources/icon.png` → `npm run icons:build` 로 `build/icon.png` + `build/icon.ico` 생성
  - [x] `npm run build` / `npm run build:win` 로 산출물 검증 (본인 PC에서 실행)
- **완료 기준**: `npm run build:win` 성공 후 `.exe` 인스톨러 생성 확인

---

## Sprint 1: 데이터 레이어 & 코어 IPC

### TASK-S1-01: MemoRepository 구현

- **설명**: 메모 CRUD, 50개 제한, 폴디드 스택은 `SettingsRepository` + `app_state`
- **체크리스트**:
  - [x] `src/main/repositories/MemoRepository.ts` 구현
  - [x] `createMemo()`: UUID 생성, 색상 할당(로테이션), DB 삽입
  - [x] `getMemo(id)`, `getAllMemos()`: 조회 (최신순 정렬)
  - [x] `updateMemo(id, patch)`: 부분 업데이트, `updatedAt` 갱신
  - [x] `deleteMemo(id)`: 영구 삭제
  - [x] 51번째 메모 생성 시 가장 오래된 메모 자동 삭제 처리
  - [x] 폴디드 스택: `SettingsRepository` / `removeMemoFromFoldedStack` (메모 삭제 시 `DataService`에서 호출)
- **완료 기준**: Vitest 단위 테스트 통과 (CRUD + 50개 제한 테스트)

### TASK-S1-02: SettingsRepository 구현

- **설명**: 앱 설정 읽기/쓰기
- **체크리스트**:
  - [x] `src/main/repositories/SettingsRepository.ts` 구현
  - [x] `getSettings()`: 기본값 fallback 포함
  - [x] `updateSettings(patch)`: 부분 업데이트
  - [x] `getAppState()`, `updateAppState(patch)`: 폴디드 패널 위치 등
- **완료 기준**: 설정 읽기/쓰기 정상 동작 확인

### TASK-S1-03: ClipboardRepository 구현

- **설명**: 클립보드 히스토리 저장소 (FIFO 30개)
- **체크리스트**:
  - [x] `src/main/repositories/ClipboardRepository.ts` 구현
  - [x] `addItem(text)`: 삽입 + 30개 초과 시 oldest 삭제
  - [x] `getItems()`: 최신순 30개 반환
  - [x] 중복 텍스트는 최신으로 이동 (선택적 개선)
- **완료 기준**: FIFO 30개 제한 단위 테스트 통과 (`ClipboardRepository.test.ts`)

### TASK-S1-04: IPC 핸들러 등록 (DataService)

- **설명**: 모든 `memo:*`, `settings:*`, `clipboard:*` IPC 채널 핸들러를 메인 프로세스에 등록
- **체크리스트**:
  - [x] `src/main/DataService.ts` 구현
  - [x] `memo:create`, `memo:update`, `memo:delete`, `memo:get`, `memo:get-all` 핸들러
  - [x] `settings:get`, `settings:update` 핸들러
  - [x] `clipboard:get-history` 핸들러
  - [x] `app:export-memos`, `app:import-memos` 핸들러 (dialog.showSaveDialog / showOpenDialog 사용)
- **완료 기준**: 렌더러에서 IPC invoke 호출 시 정상 응답 확인

---

## Sprint 2: Folded Panel & Window 관리

### TASK-S2-01: WindowManager 구현

- **설명**: 모든 BrowserWindow 생성/관리 로직 중앙화
- **체크리스트**:
  - [x] `src/main/WindowManager.ts` 구현
  - [x] `createFoldedPanel()`: frame:false, alwaysOnTop:true, resizable:false, skipTaskbar:true
  - [x] `openEditWindow(memoId)`: 이미 열린 경우 focus만, 아니면 새 창 생성
  - [x] 스택 반영: `closeFromStack` / `foldEditWindow` + 내부 `closeEditWindowOnly`
  - [x] `foldEditWindow(memoId)`: 편집 닫기 + 스택 선두 유지 (`prependMemoToFoldedStack`)
  - [x] `openPreview(memoId)` / `hidePreview()`: 프리뷰 창 (S2-06 기본 버전)
  - [x] `openHistoryModal()`, `closeHistoryModal()`: 단일 인스턴스
  - [x] `toggleFoldedPanel()`: show/hide (닫기는 hide로 트레이 상주)
- **완료 기준**: 각 창이 올바른 옵션으로 생성되는 것 확인

### TASK-S2-02: 화면 에지 스냅 구현

- **설명**: 드래그 중 20px 범위 내 접근 시 자동 스냅
- **체크리스트**:
  - [x] `src/main/utils/edgeSnap.ts`: `computeSnappedPosition()` 함수 구현
  - [x] 멀티모니터: 메인에서 `screen.getAllDisplays()` → `workArea` 배열로 전달
  - [x] 4방향 + 코너 스냅 지원
  - [x] 20px 밖이면 원 좌표 유지 (스냅 해제)
  - [x] 히스테리시스: `snapIn` 20px / `release` 28px 래치 (`computeSnappedPositionWithLatch`)
  - [x] FoldedPanel·EditWindow: `moved` 디바운스 후 스냅 (`will-move` 연속 스냅은 모서리 탈출 불가 이슈)
- **완료 기준**: 단위 테스트: 모든 엣지/코너 케이스 검증 (`edgeSnap.test.ts`)

### TASK-S2-03: TrayManager 구현

- **설명**: 시스템 트레이 아이콘 및 컨텍스트 메뉴
- **체크리스트**:
  - [x] `src/main/TrayManager.ts` 구현
  - [x] 트레이 아이콘: `resources/icon.png` → `nativeImage.resize` 16×16 (Windows에서 .ico 전용 아님)
  - [x] 클릭: 폴디드 패널 토글
  - [x] 컨텍스트 메뉴: Show SnapNote, New Memo, History, Settings, Quit
  - [x] Quit: `app.quit()` 호출
- **완료 기준**: 모든 컨텍스트 메뉴 항목 동작 확인

### TASK-S2-04: Folded Panel UI 구현 (React)

- **설명**: `src/renderer/folded/` 컴포넌트 구현
- **체크리스트**:
  - [x] `FoldedPanel.tsx`: 드래그 핸들 (`-webkit-app-region`), 위치는 메인 `moved`에서 저장 (S2-05)
  - [x] `MemoSlot.tsx`: 색상 인디케이터, 10자 프리뷰, 편집/제거 버튼
  - [x] `EmptyState.tsx`: "메모가 없습니다. + 새 메모" 표시
  - [x] hover → 지연 후 `memo:open-preview` / 슬롯 이탈 시 즉시 `memo:close-preview`
  - [x] 편집 클릭 → `memo:open-edit`
  - [x] 제거 클릭 → `memo:close-from-stack`
  - [x] 스택 구독: `stack:changed` + 초기 `app.getState()` (`app-state:get` IPC)
- **완료 기준**: 3개 메모 슬롯 렌더링, 버튼 동작 확인

### TASK-S2-05: 위치 퍼시스턴스 (Folded Panel)

- **설명**: 폴디드 패널 마지막 위치를 DB에 저장하고 앱 재시작 시 복원
- **체크리스트**:
  - [x] `moved` 이벤트에서 디바운스(500ms) 후 `app_state` 저장
  - [x] 앱 시작 시 `foldedPanelX` / `foldedPanelY` 로 창 생성
  - [x] `display-removed` 시 열린 창 위치 클램프 (화면 밖 방지)
- **완료 기준**: 앱 재시작 후 패널이 마지막 위치에 표시되는 것 확인

### TASK-S2-06: Preview State 구현

- **설명**: 메모 슬롯 Hover 시 read-only 프리뷰 창 (슬롯 이탈 시 즉시 닫힘)
- **체크리스트**:
  - [x] PreviewWindow BrowserWindow 생성 (frame:false, focusable:false, alwaysOnTop:true)
  - [x] 렌더러에서 ~150ms 지연 후 `memo:open-preview`
  - [x] 행 이탈 시 ~120ms 내 `memo:close-preview` 예약(프리뷰로 포인터 이동 시 취소 → 클릭 편집 가능)
  - [x] (구) 프리뷰 창 위 호버 시 닫기 취소 — 현재 UX에서는 미적용
  - [x] 편집 창이 포커스면 동일 메모 프리뷰 생략 (WindowManager)
  - [x] 프리뷰 창 클릭 → EditWindow로 전환 (`preview-main` → `memo:open-edit`, WindowManager에서 프리뷰 정리)
  - [x] read-only 뱃지 (`preview.html` PREVIEW 라벨)
- **완료 기준**: 상태 머신 시나리오 전체 동작 확인 (부분 완료 → 후속 스프린트)

---

## Sprint 3: Edit Window & 텍스트 에디터

### TASK-S3-01: Edit Window 프레임 구현

- **설명**: 커스텀 타이틀바 포함 Edit Window 기본 레이아웃
- **체크리스트**:
  - [x] `EditWindow.tsx`: frameless + 타이틀바 드래그 영역 (`edit/edit.css`)
  - [x] `TopBar.tsx`: 핀 / fold / close 버튼
  - [x] 핀 → `memo:set-pinned` IPC → `setAlwaysOnTop` + DB `is_pinned`
  - [x] fold → `memo:fold` (스택 유지)
  - [x] close → `memo:close-from-stack`
  - [x] `resizable: true`, `thickFrame: true`, min 300×350 (OS 가장자리 리사이즈)
  - [x] 위치·크기: 메인 `moved`/`resized` 디바운스 → `memo:update` + `useWindowPersist`로 `memo:updated` 동기화
- **완료 기준**: 창 조절, 핀 토글, fold/close 동작 확인

### TASK-S3-02: Tag Input 구현

- **설명**: 해시태그 방식 태그 입력 + 자동완성
- **체크리스트**:
  - [x] `TagInput.tsx`: 스페이스 구분 해시태그 파싱 (`tagUtils.parseTagString`)
  - [x] Placeholder: `카테고리를 설정하세요. 예: #업무 #계획` (문구 갱신)
  - [x] `#` 입력 후 기존 태그 드롭다운 표시 (자동완성)
  - [x] 태그 저장: `memo:update` IPC (`EditWindow` 자동 저장 + `WindowManager` DOM 플러시)
  - [x] 히스토리 모달 연동: 태그 필터에 반영 (`history-main.tsx` 메모 목록 + `#전체` / 태그 칩)
- **완료 기준**: 태그 입력/저장 + 자동완성 드롭다운 동작 확인

### TASK-S3-03: 텍스트 에디터 코어 — 인덴테이션

- **설명**: `EditorLine[]` 기반 커스텀 에디터 인덴테이션 시스템
- **체크리스트**:
  - [x] `Editor.tsx`: `EditorLine[]` 상태 관리
  - [x] `EditorLine.tsx`: 인덴트 레벨에 따른 배경 색상 렌더링
    - Level 0: white, Level 1: #F8F8F8, Level 2: #F0F0F0, Level 3: #E8E8E8
  - [x] 가로 그리드 라인 (행간 light gray)
  - [x] 인덴트 가이드 라인 (세로 1px, 레벨 경계)
  - [x] `Tab` keydown: 인덴트 +1 (max 3)
  - [x] `Shift+Tab` keydown: 인덴트 -1 (min 0)
  - [x] `Enter`: 동일 인덴트 레벨로 새 줄 생성
  - [x] 줄 내 긴 텍스트 wrap (인덴트 영역 내)
  - [x] 첫 번째 줄을 폴디드 패널 프리뷰로 사용 (DB `content[0]` + 타이틀바 `onHeadLineChange`)
- **완료 기준**: Tab/Shift+Tab 인덴트, 배경 색상, 그리드 라인 렌더링 확인

### TASK-S3-04: 텍스트 포맷팅 — Bold & Strikethrough

- **설명**: 선택 텍스트에 bold/strikethrough 인라인 서식 적용
- **체크리스트**:
  - [x] `InlineSpan.tsx` (`SpannedLineMirror`): TextSpan 기반 인라인 렌더링 + 미러 레이어
  - [x] `Ctrl+B`: 선택 영역에 bold 토글 (`spanFormat.toggleSpanProperty`)
  - [x] `Ctrl+Shift+X`: 선택 영역에 strikethrough 토글
  - [x] 선택 없을 때 Bold: 줄별 입력 모드 토글 (`pendingBoldLineIds` + 다음 글자 `addBoldOnRange`)
  - [x] `FormatToolbar`: Bold(B), Strikethrough(취소선 S) 버튼 연동
- **완료 기준**: 텍스트 선택 후 Ctrl+B/Ctrl+Shift+X 동작 확인

### TASK-S3-05: 텍스트 포맷팅 — Highlight & Checkbox

- **설명**: 하이라이트 3색 및 체크박스 기능
- **체크리스트**:
  - [x] Highlight: 선택 텍스트에 yellow/green/pink 배경 적용 (`TextSpan.highlight` + `SpannedLineMirror`)
  - [x] 하이라이트 버튼 클릭: 마지막 사용 색상 적용 (`lastHighlightColor`)
  - [x] 하이라이트 버튼 우클릭/long-press: 3색 색상 선택 팝업 (`FormatToolbar`)
  - [x] 선택 없을 때 하이라이트: 아무 동작 없음 (`applyHighlightToSelection` 가드)
  - [x] `Checkbox.tsx`: 줄 앞에 체크박스 삽입 (인덴트 이후, `EditorLine` + 툴바 `☐`)
  - [x] 체크박스 클릭: done/undone 토글 + 줄 텍스트 strikethrough 연동 (`formatting.checkboxChecked` + 미러 `lineStrike`)
- **완료 기준**: 하이라이트 색상 적용, 체크박스 토글 + strikethrough 연동 확인

### TASK-S3-06: Auto-Save 구현

- **설명**: 1.5초 디바운스 자동 저장
- **체크리스트**:
  - [x] `useAutoSave.ts` 훅 구현 (1.5s debounce)
  - [x] 컨텐츠 변경 시마다 타이머 리셋
  - [x] EditWindow 닫힐 때 (unmount) 즉시 강제 저장
  - [x] 앱 종료(`before-quit` 이벤트) 시 열린 모든 EditWindow 강제 저장 (`flushAllOpenEditDraftsFromDom` + `preventDefault`/`app.quit()` 재진입)
- **완료 기준**: 타이핑 후 1.5초 뒤 저장 확인, 창 닫을 때 즉시 저장 확인

---

## Sprint 4: 보조 기능 완성

### TASK-S4-01: 이모지 팔레트 구현

- **설명**: 프로덕티비티 심볼 팔레트 팝업
- **체크리스트**:
  - [x] `EmojiPalette.tsx`: 팝업 컴포넌트 (툴바 상단 `editor-toolbar-stack` / `bottom: 100%`)
  - [x] 심볼 목록 정의: `emojiPaletteItems.ts` (색 원·사각형, 화살표, 점, 상태, 강조, 구분선)
  - [x] 그리드 레이아웃 (탭 없는 단일 그리드, 8열)
  - [x] 심볼 클릭 → `Editor.insertTextAtCursor` + 팔레트 닫기
  - [x] 팔레트 바깥 `mousedown` 시 닫기
- **완료 기준**: 팔레트 열기/닫기 + 커서 위치 삽입 동작 확인

### TASK-S4-02: ClipboardService 구현 (메인 프로세스)

- **설명**: 500ms 폴링으로 시스템 클립보드 텍스트 모니터링
- **체크리스트**:
  - [x] `src/main/ClipboardService.ts` 구현
  - [x] `setInterval(500ms)` 폴링, 텍스트 변경 감지
  - [x] 이미지/파일 무시 (텍스트만 — `readText()` 빈 값)
  - [x] 새 텍스트 감지 시: ClipboardRepository에 저장 + `clipboard:item-added` 이벤트 브로드캐스트
  - [x] Settings에서 클립보드 모니터링 OFF 시 폴링 중단 (`SETTINGS_UPDATE` + `syncWithSettings`)
  - [x] 앱 최초 실행 시 클립보드 모니터링 안내 1회 (`settings.clipboard_notice_shown` + `dialog`)
- **완료 기준**: 텍스트 복사 → DB 히스토리 반영 + `clipboard:item-added` 수신 (S4-03 패널에서 목록 확인)

### TASK-S4-03: Clipboard History 패널 UI 구현

- **설명**: `ClipboardPanel.tsx` 팝업 컴포넌트
- **체크리스트**:
  - [x] `ClipboardPanel.tsx`: toolbar 위에 표시되는 팝업 (`createPortal` + 앵커 기준 `fixed`, `clipboard-panel.css`)
  - [x] 아이템 목록: 텍스트 50자 프리뷰, 📥 insert 버튼, 📋 copy 버튼
  - [x] 📥 클릭: `clipboard:insert` (target 없음 → 메인 `lastFocusedEditMemoId` 기준 삽입)
  - [x] EditWindow 포커스 없을 때 📥 비활성화 (`clipboard:has-edit-target` + 400ms 폴링)
  - [x] 📋 클릭: `clipboard:write-system` → Electron `clipboard.writeText`
  - [x] Insert 후 패널 유지
  - [x] 패널 바깥 클릭 시 닫기; `clipboard:item-added` 시 목록 갱신
- **완료 기준**: Insert 동작(포커스 있을 때/없을 때), Copy 동작 확인

### TASK-S4-04: History Modal UI 구현

- **설명**: 전체 메모 이력 모달 (전용 `history.html` 창 + 중앙 시트 UI)
- **체크리스트**:
  - [x] `HistoryModal.tsx`: 반투명 오버레이, 배경 클릭/`Esc`로 `window.close()`
  - [x] `SearchBar.tsx`: 실시간 150ms 디바운스 검색 (본문 전 줄 + 태그 문자열)
  - [x] `+ 새 메모`: `memo.create` → `openEdit` → 창 닫기
  - [x] `TagFilterBar.tsx`: 수평 스크롤, `#전체` 디폴트, 멀티 태그 **OR** 필터
  - [x] `MemoList.tsx`: `getAll` 정렬(최신 `updated_at`) 유지, 목록 **최대 50건** 슬라이스
  - [x] `MemoListItem.tsx`: 색 점(`memoHue`), 30자 프리뷰, 태그, `YYYY.MM.DD`, `TrashIcon` 삭제
  - [x] 행 클릭: `openEdit` + 창 닫기
  - [x] 휴지통: `confirm` 후 `memo.delete` + 목록 갱신
  - [x] 빈 상태: "저장된 메모가 없습니다" + `+ 새 메모`
  - [x] 필터/검색 결과 없음: "검색 결과가 없습니다." 등
  - [x] 개수 표시: `표시 N개 / 일치 M개 · 전체 K개`
- **완료 기준**: 검색, 태그 필터, 삭제 확인 다이얼로그 동작 확인

### TASK-S4-05: Global Keyboard Shortcuts 구현

- **설명**: 시스템 전역 + 앱 내 키보드 단축키
- **체크리스트**:
  - [x] `globalShortcutService.ts`: 설정의 `globalShortcut`(기본 `CommandOrControl+Shift+M`)으로 폴디드 패널 토글 — 실패 시 동일 기본값으로 폴백
  - [x] `Ctrl+N` / macOS `Cmd+N`: `before-input-event`(폴디드·편집·히스토리·설정 창) → 새 메모 + 편집 창
  - [x] `Ctrl+H` / `Cmd+H`: 동일 → 히스토리 창 열기
  - [x] 편집 창 `Esc`(수식키 없음): `foldEditWindow` — TopBar ━ 접기와 동일
  - [x] 히스토리 창 `Esc`: `HistoryModal`에서 `window.close()` (기존)
  - [x] `SETTINGS_UPDATE`에 `globalShortcut` 포함 시 `unregisterAll` 후 `syncFromSettings` 재등록; 종료 시 `shutdownGlobalShortcuts`
- **완료 기준**: 각 단축키 동작 확인 (앱 포커스 없는 상태에서도 Ctrl+Shift+M 동작)

---

## Sprint 5: 시스템 통합 & 마무리

### TASK-S5-01: Settings Window 구현

- **설명**: 설정 창 UI 및 각 설정 적용 로직 (`settings.html` / `SettingsWindow.tsx`)
- **체크리스트**:
  - [x] `SettingsWindow.tsx`: 카테고리별 설정 UI
  - [x] General: "Launch on startup" 토글 → `app.setLoginItemSettings()` 연동
  - [x] General: "Clipboard monitoring" 토글 → ClipboardService start/stop
  - [x] Appearance: 3개 색상 커스터마이즈 (컬러 피커) → 폴디드 `MemoSlot`에 반영
  - [x] Appearance: 기본 창 크기 설정 (새 메모 생성 시 적용)
  - [x] Shortcuts: 전역 단축키 변경 입력
  - [x] Data: Export JSON (모든 메모)
  - [x] Data: Import JSON (메모 병합, 중복 ID 스킵)
  - [x] Data: Clear all data (확인 다이얼로그)
- **완료 기준**: 모든 설정 항목 저장/적용 확인

### TASK-S5-02: 앱 시작 플로우 구현

- **설명**: 앱 초기화 전체 흐름 (`src/main/index.ts` 주석 참고)
- **체크리스트**:
  - [x] `src/main/index.ts`: 앱 초기화 순서 정립
  - [x] DB 초기화 → DataService → `registerIpcHandlers` 말미 `windowManager.init()` → `runPostStartupTasks` → TrayManager
  - [x] 저장된 폴디드 스택 복원 (`app_state.folded_stack` → 렌더러 `app.getState` / `STACK_CHANGED`)
  - [x] 저장된 패널 위치 복원 (`foldedPanelX`/`Y` → `WindowManager.foldedPanelOptions`)
  - [x] ClipboardService 시작 (`runPostStartupTasks` → `clipboardService.syncWithSettings`, 모니터링 ON 시 폴링)
  - [x] 글로벌 단축키 등록 (`globalShortcutService.syncFromSettings`)
  - [x] `window-all-closed`: quit 호출 없음 — 트레이 상주 (macOS 포함 동일)
  - [x] `before-quit`: `flushAllOpenEditDraftsFromDom` → 클립보드·단축키 중지 → `closeDatabase` 후 quit
- **완료 기준**: 앱 재시작 후 마지막 상태(패널 위치, 스택 메모) 복원 확인

### TASK-S5-03: 클립보드 모니터링 최초 실행 안내

- **설명**: 최초 실행 시 클립보드 모니터링 동의 안내
- **체크리스트**:
  - [x] DB `settings.clipboard_notice_shown` 플래그 (`Settings.clipboardNoticeShown`, 마이그레이션 v3)
  - [x] 최초 1회 `dialog.showMessageBox()` (`DataService.maybeShowClipboardMonitoringNotice`, 모니터링 ON일 때만)
  - [x] 다이얼로그·설정(일반)에 비활성화 경로 안내
- **완료 기준**: 최초 실행 시 1회만 표시, 이후 미표시 확인

### TASK-S5-04: 멀티 EditWindow 포커스 추적

- **설명**: 여러 EditWindow 중 마지막 포커스된 창 추적 (클립보드 Insert 대상)
- **체크리스트**:
  - [x] `WindowManager.lastFocusedEditMemoId` + `editFocusOrder`(MRU 스택) 유지
  - [x] 각 EditWindow `focus` → MRU 갱신 + `lastFocusedEditMemoId` 설정
  - [x] EditWindow `closed` → 닫힌 창이 삽입 대상이었으면 남은 창 중 MRU로 이전
  - [x] `CLIPBOARD_INSERT` / `pasteClipboardToEdit` → `targetMemoId` 없을 때 `lastFocusedEditMemoId`로 전달 (`CLIPBOARD_PASTE_TEXT`)
- **완료 기준**: 2개 EditWindow 열린 상태에서 Insert 클릭 시 마지막 포커스 창에 삽입 확인

### TASK-S5-05: 모니터 연결 해제 핸들링

- **설명**: 모니터 분리 시 창 위치 보정
- **체크리스트**:
  - [x] `screen.on('display-removed', ...)` — `WindowManager.init()` 등록 / `dispose()` 해제
  - [x] 남은 작업 영역과 72px 이상 겹치지 않으면 **주 모니터** 작업 영역 중앙(클램프)으로 이동
  - [x] 그 외 창은 `clampWindowToDisplays`로 가장자리 보정 — 폴디드·편집·프리뷰·히스토리·설정
- **완료 기준**: 모니터 분리 시 창이 주 모니터로 이동 확인

### TASK-S5-06: 전체 E2E 테스트 작성

- **설명**: 핵심 사용자 플로우 E2E 테스트 (Playwright for Electron)
- **실행**: `npm run build` 후 `npm run e2e` (필요 시 `npm run e2e:install`). E2E 시 `SNAPNOTE_E2E=1` 로 임시 userData·클립보드 안내 다이얼로그 생략.
- **체크리스트**:
  - [x] 앱 실행 → 첫 메모 생성 → fold → 폴디드 스택 확인 (`e2e/core-flows.spec.ts`)
  - [x] Hover → Preview → 슬롯 이탈 후 닫힘 확인 (구현은 ~120ms 지연 닫힘, PRD 3초와 다를 수 있음)
  - [x] Hover → Preview 클릭 → Edit 전환 확인
  - [x] 히스토리 모달: 검색, 태그 필터, 삭제 확인
  - [x] 클립보드 히스토리: 복사 → 패널에 표시 → Insert 확인
  - [x] 전역 단축키와 동일 경로 확인 — `toggleFoldedPanel` 메인 훅 E2E (`e2e/core-flows.spec.ts`). **실제 OS 단축키(Ctrl+Shift+M 등)** 는 기기별로 수동 확인 권장
- **완료 기준**: 자동화 E2E 통과 + 배포 전 실제 단축키 수동 확인

### TASK-S5-07: 성능 검증

- **설명**: NFR 성능 요구사항 달성 확인
- **자동화**: `docs/PERF_S5-07.md` — `npm run build && npm run perf`, 검색 연산은 `npm run test` (`historyFilter.test.ts`). 엄격 한계는 `SNAPNOTE_PERF_STRICT=1 npm run perf`.
- **체크리스트**:
  - [x] 앱 콜드 스타트 < 3초 측정 (Playwright, 완화/엄격 모드)
  - [x] EditWindow 열기 < 200ms 측정 (자동화는 창 생성 포함 → 엄격 모드에서 200ms 목표, 기본은 완화)
  - [x] 히스토리 모달 열기 (50개) < 300ms 측정 (`SNAPNOTE_PERF_SEED=50`)
  - [x] 유휴 메모리 < 150MB 측정 (`getAppMetrics` 합, 엄격 150MB)
  - [x] 검색 응답 < 100ms 측정 (50개 단일 필터 패스, Vitest)
- **완료 기준**: 기본 `npm run perf` + 단위 테스트 통과; 릴리스 전 `SNAPNOTE_PERF_STRICT=1` 로 NFR에 최대한 맞춰 재확인

### TASK-S5-08: Windows 인스톨러 최종 빌드 검증

- **설명**: 실제 Windows 환경에서 인스톨러 설치 테스트
- **절차서**: `docs/INSTALL_VERIFY_WIN_S5-08.md`
- **체크리스트**:
  - [x] NSIS `.exe` 생성 — `npm run build:win` → `dist/snapnote-<version>-setup.exe` (`npm run verify:win-installer` 로 검증)
  - [ ] 클린 Windows 환경에서 설치 테스트 — **수동** (VM/별도 PC 권장)
  - [ ] 설치 후 앱 실행, smoke test — **수동**
  - [ ] 설정/제어판에서 프로그램 제거 테스트 — **수동**
- **완료 기준**: 자동 검증 통과 + 위 수동 3항을 클린 환경에서 확인

---

## Task 의존성 맵

```
S0-01 (프로젝트 초기화)
  └─► S0-02 (타입 & IPC 채널)
  └─► S0-03 (SQLite 초기화)
        └─► S1-01 (MemoRepository)
        └─► S1-02 (SettingsRepository)
        └─► S1-03 (ClipboardRepository)
              └─► S1-04 (IPC 핸들러)
                    └─► S2-01 (WindowManager)
                          ├─► S2-02 (에지 스냅)
                          ├─► S2-03 (TrayManager)
                          ├─► S2-04 (Folded Panel UI)
                          │     └─► S2-05 (위치 퍼시스턴스)
                          └─► S2-06 (Preview State)
                                └─► S3-01 (Edit Window)
                                      ├─► S3-02 (Tag Input)
                                      ├─► S3-03 (에디터 인덴테이션)
                                      │     ├─► S3-04 (Bold/Strikethrough)
                                      │     └─► S3-05 (Highlight/Checkbox)
                                      └─► S3-06 (Auto-Save)
                                            └─► S4-01 (이모지 팔레트)
                                            └─► S4-02 (ClipboardService)
                                                  └─► S4-03 (클립보드 패널 UI)
                                            └─► S4-04 (히스토리 모달)
                                            └─► S4-05 (키보드 단축키)
                                                  └─► S5-01 (Settings Window)
                                                  └─► S5-02 (앱 시작 플로우)
                                                        └─► S5-03 ~ S5-08
```

---

## 완료 기준 체크리스트 (MVP v1)

> 스프린트 S0~S5 TASK 및 E2E·단위 테스트와 정합. Preview 자동 닫힘은 구현이 ~120ms 지연인 경우 있음(SRD 3초와 문서 차이).

- [x] 폴디드 패널: 3개 슬롯, 색상 인디케이터, always-on-top, 드래그, 에지 스냅
- [x] Preview on hover: read-only, 클릭으로 edit 전환 (자동 닫힘 타이밍은 구현 기준)
- [x] Edit window: pin 토글, fold, close, 리사이즈, 위치/크기 퍼시스턴스
- [x] Tag input: 자유형 해시태그, 자동완성
- [x] 텍스트 에디터: 4레벨 인덴테이션, 그리드, 레벨 배경색, 줄 wrapping
- [x] 이모지 팔레트: 프로덕티비티 심볼
- [x] 클립보드 히스토리: 30개, 커서 위치 insert, 클립보드 복사
- [x] 텍스트 포맷팅: bold, strikethrough, 3색 highlight, 체크박스
- [x] 히스토리 모달: 검색, 멀티 태그 필터(OR), 삭제 확인, 최대 50개
- [x] 시스템 트레이: 왼쪽 클릭 토글, 오른쪽 클릭 메뉴
- [x] Auto-save: 1.5초 디바운스 + 닫기/종료 시 저장
- [x] Settings: 시작프로그램, 클립보드 토글, 색상 커스터마이즈, 단축키, 데이터 export/import
- [x] 키보드 단축키: 전역 show/hide, 새 메모, 히스토리, 인덴트, bold, strikethrough, esc
- [x] 듀얼 모니터 에지 스냅
