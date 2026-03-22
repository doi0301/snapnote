# 배포 확장 가이드

## 왜 처음엔 코드만 안 넣었나

- **코드 서명:** 유료 인증서·PFX·GitHub Secrets 는 **저장소 밖** 자산이라, 여기서 임의 값을 넣으면 CI만 실패하거나 의미 없는 설정이 됩니다. 대신 **워크플로 + Secrets 이름**을 정해 두었습니다.
- **자동 업데이트:** 배포 URL·`latest.yml` 호스팅이 없으면 매 실행마다 **실패 로그만** 남을 수 있어, 플레이스홀더(`example.com`)일 때는 **검사를 건너뛰는** 런타임 로직(`src/main/autoUpdate.ts`)을 넣었습니다.

---

## 런타임: electron-updater (이미 포함)

- 패키징된 앱(`app.isPackaged`)에서만 동작. 개발·E2E 는 제외.
- `electron-builder.yml` 의 `publish.url` 이 실제 서버로 바뀌어 빌드되면, 기본적으로 업데이트 검사가 켜집니다.
- 아직 `example.com` 이거나 메타가 없으면 검사 생략.
- 환경 변수:
  - `SNAPNOTE_DISABLE_AUTO_UPDATE=1` — 완전 끔
  - `SNAPNOTE_UPDATE_BASE_URL` — 피드 URL 강제 (스테이징 등)
  - `SNAPNOTE_ENABLE_AUTO_UPDATE=1` — 메타가 애매해도 검사 강제

서버에는 `electron-builder` 가 `dist/` 에 만든 `latest.yml` 과 설치 파일을 같은 베이스 URL 에 올려야 합니다.

## Windows 코드 서명

**electron-builder** 환경 변수:

- `CSC_LINK` — PFX 파일 경로 또는 base64 인코딩된 인증서
- `CSC_KEY_PASSWORD` — PFX 비밀번호

GitHub Actions에서는 Secrets에 인증서를 넣고, 빌드 스텝에서 파일로 복원한 뒤 `CSC_LINK`에 경로를 지정하는 방식이 흔합니다.

공식: https://www.electron.build/code-signing

## 자동 업데이트

`electron-builder.yml`의 `publish`는 예시 URL입니다. 도입 시:

1. `electron-updater` 의존성 추가
2. 메인 프로세스에서 `autoUpdater` 설정
3. 빌드 산출물과 `latest.yml` 등을 동일 호스트에 배포

공식: https://www.electron.build/auto-update

## CI

- **E2E:** `.github/workflows/e2e-windows.yml`
- **릴리스 빌드(수동):** `.github/workflows/build-win-release.yml` — `workflow_dispatch` 후 `dist` 아티팩트. `WINDOWS_CSC_LINK` / `WINDOWS_CSC_KEY_PASSWORD` Secrets 를 채우면 서명 시도.

## 성능 NFR 엄격 검증

`npm run perf:strict` — 빌드 후 `SNAPNOTE_PERF_STRICT=1` 로 Playwright 성능 스펙 실행.  
상세: `docs/PERF_S5-07.md`

## OS 전역 단축키 E2E (선택)

`e2e/global-shortcut-os.spec.ts` — `SNAPNOTE_RUN_OS_SHORTCUT_E2E=1` 일 때만 의미 있는 실행.  
합성 키가 OS에 전달되지 않으면 실패할 수 있음.

## 관련

- `docs/INSTALL_VERIFY_WIN_S5-08.md` — 설치 검증
