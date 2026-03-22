# SnapNote 개발 스터디 노트

> 기획·개발 병행하며 정리한 용어·개념·제품 결정 모음.

---

## Electron

**정의:** HTML, CSS, JavaScript/TypeScript로 **데스크톱 앱**(Windows·macOS·Linux)을 만드는 프레임워크.

**비유:** Chromium으로 **웹 화면**을 띄우고, 그걸 **설치형 프로그램**처럼 포장한다.

| 부분                 | 역할                                       |
| -------------------- | ------------------------------------------ |
| **메인(Main)**       | 창·트레이·단축키·파일/DB 등 OS에 가까운 일 |
| **렌더러(Renderer)** | 사용자가 보는 UI (예: React)               |

**장점:** 웹/React 경험과 이어짐, 로컬 저장·트레이·항상 위 등 데스크톱 기능에 적합.  
**단점:** Chromium 포함으로 용량·메모리 부담. 보안은 preload로 노출 범위를 최소화.

---

## IPC (Inter-Process Communication)

**정의:** 서로 다른 **프로세스**가 **메시지**로 데이터를 주고받는 방식.

**Electron에서:** 메인과 렌더러는 메모리를 공유하지 않으므로, DB·설정 등은 **IPC**로 요청한다.

| 패턴                | 특징                                       |
| ------------------- | ------------------------------------------ |
| **invoke / handle** | 요청 후 응답(프로미스) — API 호출에 가깝다 |
| **on**              | 메인 → 렌더러 **이벤트** 구독              |

채널 이름은 `src/shared/ipc-channels.ts`에 **상수로 모아** 오타·불일치를 막는다.  
**preload**는 `contextBridge`로 허용된 API만 `window`에 붙인다.

---

## SQLite 저장: sql.js (구현 결정)

원안 TRD에는 `better-sqlite3`(네이티브)가 있었으나, Windows·Node 최신 버전에서 **프리빌드/Visual Studio** 이슈를 피하기 위해 **`sql.js`(WASM SQLite)** 로 구현한다. DB **스키마·파일 경로**는 동일하고, 메모리에 올린 뒤 **`persistDatabase()`** 로 `snapnote.db`에 쓴다. 상세는 `docs/TRD_SnapNote_v1.md` §3.1 참고.

---

## UI/UX 관점: Preload API 네임스페이스 결정

**결정: `window.snapnote` 단일 네임스페이스만 사용한다.**

| 기준        | `snapnote`                                                                  | 제네릭 `api`                   |
| ----------- | --------------------------------------------------------------------------- | ------------------------------ |
| 제품 연관성 | SnapNote 앱 API임이 **즉시 식별**                                           | 여러 앱·라이브러리와 혼동 가능 |
| 검색·리뷰   | 코드/로그에서 **`snapnote.` 검색**이 명확                                   | `api.`는 노이즈가 큼           |
| 확장        | 메모·클립보드·설정을 **하나의 제품 API** 아래 그룹화 (`memo`, `settings` …) | 의미 없는 묶음이 되기 쉬움     |

렌더러에서는 `window.snapnote.memo.getAll()` 형태로만 접근한다.

---

## (이어서 적기)

새로 물어본 개념은 아래에 날짜와 함께 추가.

---

## 관련 문서

- 프로젝트를 **바이브코딩으로 어떻게 진행했는지**(웹기획자용): [`STUDY_VIBE_CODING_KO.md`](./STUDY_VIBE_CODING_KO.md)
- **GitHub 소개**용 요약: [`GITHUB_INTRO_KO.md`](./GITHUB_INTRO_KO.md)
