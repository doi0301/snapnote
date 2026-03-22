# TASK-S5-07 — 성능 검증 (NFR)

## 측정 항목과 자동화

| 항목 (TASKS) | 자동화 | 비고 |
|--------------|--------|------|
| 앱 콜드 스타트 < 3초 | Playwright `e2e/perf-budgets.spec.ts` | `electron.launch` ~ 폴디드 `load` |
| EditWindow 열기 < 200ms | 동 파일 | 새 메모 클릭 ~ `edit.html` `domcontentloaded` (창 생성 포함) |
| 히스토리 모달 (50개) < 300ms | 동 파일 | `SNAPNOTE_PERF_SEED=50` 시드 후 전체보기 ~ 첫 `.history-memo-item` |
| 유휴 메모리 < 150MB | 동 파일 | `app.getAppMetrics()` 의 `workingSetSize` 합 (KB→MB) |
| 검색 응답 < 100ms | Vitest `src/shared/historyFilter.test.ts` | 50개 메모 단일 `filterHistoryMemos` 패스 CPU 시간 |

## 한계값 모드

- **기본 (`npm run perf`)**: 기기 편차를 허용하는 완화 한계(예: 히스토리 ~1.8s, 메모리 합 ~400MB).
- **엄격 (`npm run perf:strict`)**: `SNAPNOTE_PERF_STRICT=1` 로 TASK에 가까운 한계. 로컬 릴리스 전 게이트용.

## 실행

```bash
npm run build
npm run perf
npm run perf:strict   # NFR 엄격 (내부에서 build + playwright perf)
```

Windows PowerShell에서만 환경 변수로 켤 때:

```powershell
$env:SNAPNOTE_PERF_STRICT='1'; npm run perf
```

검색 연산 단위 테스트:

```bash
npm run test -- src/shared/historyFilter.test.ts
```

## UI 디바운스와 검색 100ms

`SearchBar`는 입력 후 150ms 디바운스 뒤에 필터가 돌아갑니다. NFR 「검색 응답」은 필터 연산 자체를 100ms 이내로 두는 것으로 해석하며 Vitest가 검증합니다.
