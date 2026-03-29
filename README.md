# SnapNote

Windows 우선 데스크톱 메모 앱 — Electron + React + TypeScript + electron-vite.

- 제품/설치 표시명: **SnapNote** (`appId`: `com.snapnote.app`)
- npm 패키지명: `snapnote` (소문자)
- 요구사항·디자인 문서: [`docs/`](./docs/)
- **GitHub 소개용** (핵심 기능·차별화): [`docs/GITHUB_INTRO_KO.md`](./docs/GITHUB_INTRO_KO.md)
- **바이브코딩 스터디** (웹기획자용 과정·개념): [`docs/STUDY_VIBE_CODING_KO.md`](./docs/STUDY_VIBE_CODING_KO.md)
- CI: Ubuntu `lint`·`typecheck`·`test` (`.github/workflows/ci.yml`), Windows E2E (`.github/workflows/e2e-windows.yml`)
- 배포 확장(서명·자동업데이트): [`docs/DEPLOYMENT_EXTRAS_KO.md`](./docs/DEPLOYMENT_EXTRAS_KO.md) — 패키징 빌드에 `electron-updater` 연동됨 (`src/main/autoUpdate.ts`)
- 스터디 노트(용어·결정): [`docs/STUDY.md`](./docs/STUDY.md)
- **수동으로 하실 일:** [`docs/MANUAL_SETUP_KO.md`](./docs/MANUAL_SETUP_KO.md)

## IDE

- [VS Code](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## 로컬을 GitHub 최신과 맞추기

다른 PC에서 푸시했거나 GitHub가 앞선 상태에서 이 PC에서 개발을 이어가려면, 저장소 루트에서 원격 최신을 가져옵니다.

- **개념:** `pull`은 원격(GitHub)의 커밋을 로컬 브랜치로 합칩니다. `push`는 그 반대로 로컬 커밋을 원격에 올립니다.
- **절차:** (선택) `git fetch origin` 후 `git status` — `behind`이면 원격이 앞선 것입니다. 반영은 `git pull` (또는 `git pull origin master`; 기본 브랜치가 `main`이면 `main`으로 바꿉니다).
- **확인:** `git status`에 `Your branch is up to date with 'origin/master'.`가 보이거나, `git rev-parse HEAD`와 `git rev-parse origin/master` 해시가 같으면 맞춰진 상태입니다.

작업 중인 변경이 있으면 `git status`로 확인한 뒤, 필요하면 커밋하거나 `git stash`로 잠시 치워 두고 `pull` 하세요.

## 명령

```bash
npm install
npm run dev          # 개발 (Electron 창)
npm run icons:build  # Windows 설치용 build/icon.ico (배포 전)
npm run build:win
npm run verify:win-installer   # dist NSIS 설치 파일 검사 (TASK-S5-08)
npm run build:win:verify       # build:win 후 검증까지 한 번에
npm run typecheck
npm run lint
npm run test         # Vitest 단위 테스트
npm run build        # E2E 전 필수
npm run e2e          # Playwright · Electron (SNAPNOTE_E2E=1 자동 설정)
npm run e2e:install  # 최초 1회: Playwright 브라우저 등 (Electron은 node_modules electron 사용)
npm run perf         # TASK-S5-07: `e2e/perf-budgets.spec.ts` (build 선행)
npm run perf:strict  # 성능 예산 NFR 엄격 모드 (내부에서 build 포함)
```

선택 E2E: OS 전역 단축키(Ctrl+Shift+M) — Windows에서 `SNAPNOTE_RUN_OS_SHORTCUT_E2E=1` 설정 후  
`npx playwright test e2e/global-shortcut-os.spec.ts` (`e2e/global-shortcut-os.spec.ts` 참고).

## DB (SQLite)

네이티브 모듈 빌드 없이 동작하도록 **`sql.js`**(WebAssembly)를 사용합니다. DB 파일은 `%APPDATA%\SnapNote\snapnote.db` (또는 `app.getPath('userData')`) 입니다.  
데이터 변경 후 디스크에 쓰려면 메인 프로세스에서 `persistDatabase()`를 호출해야 합니다 (S1 레포지토리에서 연동 예정).

## 문제 해결: `Cannot find module 'better-sqlite3'`

프로젝트는 **이미 `better-sqlite3`를 쓰지 않습니다.** 이 오류는 보통 **옛날에 만들어진 `out/` 빌드**를 실행할 때 납니다.

1. **최신 소스**인지 확인 (`src/main/database/db.ts`에 `sql.js` import 가 있어야 함).
2. 터미널에서 프로젝트 루트로 이동 후:
   ```bash
   npm run clean
   npm install
   npm run dev
   ```
3. **`npm start`** / **`electron-vite preview`** 만 쓰는 경우, 먼저 `npm run build` 또는 위처럼 **`npm run dev`** 로 메인 프로세스를 다시 빌드하세요.

## 디렉터리

- `src/main` — 메인 프로세스
- `src/preload` — preload / contextBridge
- `src/renderer` — React UI
- `src/shared` — 공유 타입·상수 (S0-02 이후)
