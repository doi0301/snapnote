# TASK-S5-08: Windows 인스톨러 검증

## 1. 산출물 자동 검사

NSIS 설치 파일은 `npm run build` 만으로는 나오지 않습니다. Windows용은 아래를 사용합니다.

```bash
npm run build:win
npm run verify:win-installer
```

또는 `npm run build:win:verify` 한 번에 실행합니다.

- 기대 파일: `dist/snapnote-버전-setup.exe` (electron-builder `nsis.artifactName`)
- 스크립트는 존재 여부와 최소 크기(8MB)를 검사합니다.

## 2. 수동 검증 (클린 PC 권장)

VM 또는 별도 PC에서 진행하는 것을 권장합니다.

1. `*-setup.exe` 실행 후 설치 완료
2. 시작 메뉴 또는 바탕화면에서 SnapNote 실행
3. Smoke: 폴디드, 새 메모, 접기, 히스토리 등 핵심 동작
4. 설정 - 앱 또는 제어판에서 SnapNote 제거

## 3. 완료 기준

- `verify:win-installer` 통과
- 위 수동 4단계를 클린 환경에서 확인

## 4. 문제 시

- `build/icon.ico` 없으면: `npm run icons:build`
