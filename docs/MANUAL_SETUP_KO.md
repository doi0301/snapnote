# SnapNote — 수동으로 하실 일 가이드

AI/자동화가 못 하는 **본인 PC에서 꼭 한 번씩** 하시면 되는 작업만 모았습니다.

---

## 1. 처음 한 번 (환경)

| 순서 | 할 일 | 설명 |
|------|--------|------|
| 1 | **Node.js 설치** | [nodejs.org](https://nodejs.org) LTS 권장. 터미널에서 `node -v` 로 확인 |
| 2 | **프로젝트 폴더로 이동** | 예: `cd C:\Users\doi\snapmemo` |
| 3 | **`npm install`** | 의존성 설치. 인터넷 필요 |
| 4 | **`npm run dev`** | 개발 모드로 앱 실행 (Electron 창이 뜨면 OK) |

---

## 2. 오류 났을 때 (자주 하는 조치)

### `Cannot find module 'better-sqlite3'`

프로젝트는 **`sql.js`만** 씁니다. **옛날 빌드(`out/`)**가 돌아가면 이 메시지가 날 수 있습니다.

```bash
npm run clean
npm install
npm run dev
```

### `Cannot find module 'sql.js'` 또는 설치 관련 오류

```bash
npm install
```

그다음 다시 `npm run dev`.

---

## 3. TASK-S0-03 (DB) 확인 방법

아래를 **순서대로** 확인하면 됩니다.

1. 프로젝트 루트에서 **`npm run dev`** 실행  
2. 터미널에 아래와 **비슷한 한 줄**이 나오는지 본다 (경로는 PC마다 다름).
   ```text
   [SnapNote] SQLite (sql.js): C:\Users\...\AppData\Roaming\SnapNote\snapnote.db
   ```
3. **Electron 창**이 뜨는지 본다 (창이 뜨면 메인 프로세스가 크래시 없이 올라온 것).  
4. (선택) 탐색기 주소창에 **`%APPDATA%\SnapNote`** 입력 → **`snapnote.db`** 파일이 생겼는지 확인.

**참고:** `disk_cache` / `Gpu Cache` 같은 **ERROR** 줄은 Chromium 캐시 관련 로그로, DB 성공 여부와는 별개입니다. 위 1~3이 되면 S0-03은 통과로 봐도 됩니다.

---

## 4. 린트 / 포맷 (코드 품질)

로컬에서 확인할 때:

```bash
npm run lint
npm run format
npm run typecheck
```

Prettier 경고만 나오면 보통:

```bash
npm run format
```

---

## 5. 배포용 빌드 (S0-04)

Windows 설치 파일까지 만들 때 — **아이콘 생성 후** 빌드합니다.

```bash
npm run icons:build   # build/icon.png + build/icon.ico (임시: resources/icon.png 기준)
npm run build:win
```

코드 서명 등은 TASK·`electron-builder.yml` 기준으로 이후 단계에서 진행합니다.

---

## 6. Git (버전 관리)

저장소를 쓰신다면:

```bash
git status
git add .
git commit -m "메시지"
```

원격 저장소 연결·푸시는 본인 계정/서비스(GitHub 등)에 맞게 진행하시면 됩니다.

---

## 7. 지금 단계에서 **안 해도 되는 것**

- Visual Studio C++ 빌드 도구 (**sql.js** 사용으로 불필요)
- **`better-sqlite3`** — 프로젝트에 포함되어 있지 않음(예전 튜토리얼·문서와 혼동 주의)
- 수동으로 DB 테이블 만들기 (앱이 첫 실행 시 생성)

---

## 8. 문제가 계속되면

1. `src\main\database\db.ts`에 `import ... from 'sql.js'` 가 있는지 확인  
2. `npm run clean` 후 `npm run dev` 다시 실행  
3. Node 버전을 LTS(예: 22.x)로 맞춰 보기  

그래도 같으면 터미널 **전체 로그**를 복사해 두면 원인 파악에 도움이 됩니다.
