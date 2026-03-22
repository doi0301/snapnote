# SnapNote — Design System

> **Version:** 1.0
> **Date:** 2026-03-21
> **Direction:** Clean Paper — sticky 메모의 따뜻함을 유지하면서 가독성과 집중력을 우선

---

## 1. Design Principles

| 원칙                   | 설명                                                           |
| ---------------------- | -------------------------------------------------------------- |
| **Warm & Calm**        | 차갑지 않은 흰색, 은은한 그림자로 종이 위에 메모하는 느낌      |
| **Readable First**     | 모든 텍스트는 읽기 편한 크기와 대비. 꾸밈보다 가독성 우선      |
| **Non-intrusive**      | 작업 중 시선을 빼앗지 않는 조용한 UI. 필요할 때만 존재감       |
| **Consistent Density** | 정보 밀도를 일정하게 유지. 너무 붐비거나 너무 비어 보이지 않게 |

---

## 2. Color Palette

### 2.1 Base Colors

```
Background (앱 전체 기본 배경)
  --color-bg-base:        #FAFAF8   ← 따뜻한 오프화이트. 순수 흰색보다 눈이 편함

Surface (카드, 패널, 모달 배경)
  --color-surface-1:      #FFFFFF   ← 메모 카드 최상위 레이어
  --color-surface-2:      #F5F5F2   ← 배경보다 살짝 구분되는 영역

Border
  --color-border:         #E8E6E1   ← 따뜻한 그레이 계열 구분선
  --color-border-subtle:  #F0EEE9   ← 거의 보이지 않는 미세 구분선

Text
  --color-text-primary:   #1A1A18   ← 거의 검정, 차갑지 않은 웜 블랙
  --color-text-secondary: #6B6B63   ← 부제목, 메타 정보
  --color-text-placeholder:#B0AEA7  ← 입력 placeholder
  --color-text-disabled:  #C8C6C0   ← 비활성 요소
```

### 2.2 Memo Slot Colors (3개 인디케이터)

기본값. Settings에서 사용자 커스터마이즈 가능.

```
  --color-slot-coral:     #F28B74   ← 산호빛 레드. 따뜻하고 선명
  --color-slot-green:     #5BB47A   ← 세이지 그린. 자연스럽고 안정적
  --color-slot-blue:      #5B8FD4   ← 소프트 블루. 차분하고 신뢰감
```

### 2.3 Highlight Colors (텍스트 하이라이트 3색)

```
  --color-highlight-yellow: #FFF176   ← 연한 노랑
  --color-highlight-green:  #C8F0C8   ← 연한 민트
  --color-highlight-pink:   #F9C4D0   ← 연한 핑크
```

### 2.4 Semantic Colors

```
  --color-interactive:      #5B8FD4   ← 버튼, 링크, 포커스 링 (slot-blue와 동일)
  --color-interactive-hover:#4A7BBF   ← hover 상태
  --color-danger:           #E05A5A   ← 삭제, 경고
  --color-danger-hover:     #C94444
  --color-checkbox-done:    #5BB47A   ← 체크 완료 (slot-green)
```

### 2.5 Indent Level Background Colors

```
  Level 0:  transparent (--color-surface-1 그대로)
  Level 1:  #F8F7F4
  Level 2:  #F1F0EB
  Level 3:  #EAEAE3
```

---

## 3. Typography

### 3.1 Font Family

```css
--font-sans: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace; /* 코드 표시용 (미래 대비) */
```

> **Pretendard** 우선. 한/영 가독성이 뛰어나고 weight 범위가 넓음.
> **배포 방식(결정):** 앱 번들에 Pretendard(가변 폰트 WOFF2 또는 공식 npm `@pretendard/variable`)를 포함하고 `@font-face`로 로드. 오프라인·화면 일관성 확보; 용량은 variable 1파일로 관리. 폴백은 `Apple SD Gothic Neo`, `Malgun Gothic`, `system-ui`.

### 3.2 Type Scale

| Token         | Size | Weight | Line Height | 용도                      |
| ------------- | ---- | ------ | ----------- | ------------------------- |
| `--text-xs`   | 11px | 400    | 1.4         | 날짜, 카운트 등 보조 정보 |
| `--text-sm`   | 12px | 400    | 1.5         | 태그, 메타 정보, 툴팁     |
| `--text-base` | 13px | 400    | 1.6         | 에디터 본문 텍스트        |
| `--text-md`   | 14px | 500    | 1.5         | 버튼, 레이블              |
| `--text-lg`   | 16px | 600    | 1.4         | 모달 타이틀               |

> 에디터 본문은 13px / 1.6 line-height. 손에 쓴 메모처럼 여유 있는 행간.

### 3.3 Font Weight

```
--weight-regular: 400
--weight-medium:  500
--weight-semibold:600
```

---

## 4. Spacing

4px 기반 그리드.

```
--space-1:   4px
--space-2:   8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
```

---

## 5. Border Radius

```
--radius-sm:   4px   ← 인라인 요소 (태그 칩, 배지)
--radius-md:   8px   ← 버튼, 인풋
--radius-lg:  12px   ← 카드, 패널, 팝업
--radius-xl:  16px   ← 모달
--radius-full:9999px ← 원형 아이콘 버튼, 토글
```

---

## 6. Elevation (Shadow)

종이가 살짝 떠 있는 느낌. 과하지 않게.

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08); /* Folded panel, 소형 팝업 */
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1); /* Edit window, 클립보드 패널 */
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12); /* History modal */
--shadow-focus: 0 0 0 2px rgba(91, 143, 212, 0.4); /* 포커스 링 */
```

---

## 7. Component Specs

### 7.1 Folded Panel

```
width:            280px (고정)
background:       --color-surface-1
border:           1px solid --color-border
border-radius:    --radius-lg (12px)
shadow:           --shadow-sm
padding (row):    8px 10px

Memo Row
  height:         36px
  color-indicator:4px wide left border (slot color)
  border-radius:  2px
  text:           --text-base, --color-text-primary
  truncate:       10자 + "..."
  button (✏️/✕): 20×20px, --color-text-secondary, hover: --color-text-primary

Empty State
  height:         36px
  text:           --text-sm, --color-text-placeholder
  "+ 새 메모":    --color-interactive
```

### 7.2 Edit Window

```
default-size:     400 × 500px
min-size:         300 × 350px
background:       --color-surface-1
border:           1px solid --color-border
border-radius:    --radius-lg (12px)
shadow:           --shadow-md

Top Bar
  height:         36px
  background:     --color-bg-base
  border-bottom:  1px solid --color-border-subtle
  padding:        0 10px
  drag-region:    top bar 전체 (버튼 제외)

Tag Input
  height:         32px
  background:     transparent
  border-bottom:  1px solid --color-border-subtle
  padding:        0 12px
  font:           --text-sm, --color-text-secondary
  placeholder:    --color-text-placeholder

Editor Area
  padding:        8px 0
  background:     --color-surface-1
  grid-line:      1px solid #EDECEA (행간)
  indent-guide:   1px solid #E8E6E1 (세로, 레벨 경계)

Bottom Toolbar
  height:         36px
  background:     --color-bg-base
  border-top:     1px solid --color-border-subtle
  padding:        0 8px
```

### 7.3 Preview Window

```
Edit Window와 동일한 레이아웃
background:       rgba(250, 250, 248, 0.96)  ← 살짝 투명하게 dim 처리
pointer-events:   auto  ← 클릭 시 편집 전환(SRD FR-02-4) 필요. 읽기 전용은 시각(딤/뱃지)으로만 구분
cursor:           default (또는 text; 편집 전환 가능함을 해치지 않는 범위)
"Read only" badge:
  position:       top-right of window
  font:           --text-xs
  color:          --color-text-disabled
  background:     --color-surface-2
  border-radius:  --radius-sm
  padding:        2px 6px
```

### 7.4 History Modal

```
width:            480px
max-height:       600px
background:       --color-surface-1
border-radius:    --radius-xl (16px)
shadow:           --shadow-lg
backdrop:         rgba(0, 0, 0, 0.30)

Header
  height:         52px
  title:          --text-lg, --weight-semibold
  border-bottom:  1px solid --color-border-subtle

Search Input
  height:         36px
  border:         1px solid --color-border
  border-radius:  --radius-md
  padding:        0 10px
  font:           --text-base

Tag Filter Bar
  padding:        8px 12px
  gap:            6px
  chip-height:    26px
  chip-padding:   0 10px
  chip-radius:    --radius-full
  chip-inactive:  bg --color-surface-2, text --color-text-secondary
  chip-active:    bg --color-interactive, text #FFFFFF

Memo List Item
  height:         56px
  padding:        10px 12px
  hover:          background --color-surface-2
  border-bottom:  1px solid --color-border-subtle
  color-indicator:4px left border (slot color)
```

### 7.5 Emoji Palette

```
width:            240px
padding:          10px
background:       --color-surface-1
border:           1px solid --color-border
border-radius:    --radius-lg
shadow:           --shadow-md
grid:             8 columns
cell-size:        28px
cell-hover:       background --color-surface-2, border-radius --radius-sm
font-size:        16px
```

### 7.6 Clipboard Panel

```
width:            300px
max-height:       360px
background:       --color-surface-1
border:           1px solid --color-border
border-radius:    --radius-lg
shadow:           --shadow-md

Item Row
  height:         44px
  padding:        8px 10px
  text:           --text-sm, truncate 50자
  hover:          background --color-surface-2
  button (📥):    disabled → --color-text-disabled, cursor:not-allowed
```

---

## 8. Interactive States

모든 인터랙티브 요소에 일관된 상태 스타일 적용.

| State            | 처리 방식                                                      |
| ---------------- | -------------------------------------------------------------- |
| Default          | 기본 색상                                                      |
| Hover            | 배경 `--color-surface-2` 또는 색상 tone-down                   |
| Active (pressed) | 추가 10% 어둡게 (`filter: brightness(0.9)`)                    |
| Focus            | `--shadow-focus` (2px outline, interactive 색상 40% 투명)      |
| Disabled         | `--color-text-disabled`, `opacity: 0.5`, `cursor: not-allowed` |

---

## 9. Motion & Animation

작업 중 방해가 되지 않도록 빠르고 절제된 애니메이션.

```
--duration-fast:    100ms   ← hover, button press
--duration-normal:  150ms   ← 팝업 열기/닫기
--duration-slow:    200ms   ← 모달 overlay, preview 등장

--easing-default:   cubic-bezier(0.2, 0, 0, 1)   ← 빠르게 시작, 부드럽게 끝
--easing-spring:    cubic-bezier(0.34, 1.56, 0.64, 1) ← 팝업 등장 시 살짝 튀는 느낌
```

**적용 예시:**

- 팝업(이모지 팔레트, 클립보드 패널): `opacity 0→1` + `translateY 4px→0`, `--duration-normal`, `--easing-spring`
- 모달 backdrop: `opacity 0→1`, `--duration-slow`, `--easing-default`
- hover: `background-color`, `--duration-fast`
- Preview window 등장: `opacity 0→1` + `translateX -4px→0` (패널 옆으로 슬라이드), `--duration-normal`

---

## 10. Icon System

[Lucide Icons](https://lucide.dev/) 사용 (MIT 라이선스, React 컴포넌트 제공).

| 요소                      | 아이콘           | 크기 |
| ------------------------- | ---------------- | ---- |
| Pin toggle OFF            | `Pin`            | 16px |
| Pin toggle ON             | `PinOff`         | 16px |
| Fold button               | `Minus`          | 16px |
| Close button              | `X`              | 16px |
| Edit button (폴디드 슬롯) | `Pencil`         | 14px |
| History button            | `Clock`          | 16px |
| Emoji palette             | `Smile`          | 16px |
| Clipboard                 | `Clipboard`      | 16px |
| Bold                      | `Bold`           | 14px |
| Strikethrough             | `Strikethrough`  | 14px |
| Highlight                 | `Highlighter`    | 14px |
| Checkbox insert           | `SquareCheck`    | 14px |
| Delete                    | `Trash2`         | 14px |
| Search                    | `Search`         | 14px |
| New memo                  | `Plus`           | 14px |
| Insert                    | `CornerDownLeft` | 14px |

아이콘 색상은 `--color-text-secondary` 기본, hover 시 `--color-text-primary`.

---

## 11. Custom Window Chrome

Electron `frame: false` 사용으로 OS 기본 타이틀바 없음. 커스텀 드래그 영역 구현.

```css
/* Top Bar 전체를 드래그 가능 영역으로 설정 */
.top-bar {
  -webkit-app-region: drag;
}

/* 버튼은 드래그 제외 */
.top-bar button {
  -webkit-app-region: no-drag;
}
```

창 리사이즈 핸들: 모서리/가장자리 8px 영역에 투명 핸들 오버레이.

---

## 12. Accessibility

| 항목              | 기준                                                         |
| ----------------- | ------------------------------------------------------------ |
| 색상 대비         | 본문 텍스트: 최소 4.5:1 (WCAG AA)                            |
| 포커스 가시성     | `--shadow-focus` 모든 인터랙티브 요소에 적용                 |
| 버튼 최소 크기    | 20×20px (툴바 아이콘), 터치 영역 별도 고려 불필요 (데스크탑) |
| 키보드 내비게이션 | Tab으로 모든 인터랙티브 요소 접근 가능                       |

---

## 13. CSS Variables 전체 참조

```css
:root {
  /* Colors - Base */
  --color-bg-base: #fafaf8;
  --color-surface-1: #ffffff;
  --color-surface-2: #f5f5f2;
  --color-border: #e8e6e1;
  --color-border-subtle: #f0eee9;

  /* Colors - Text */
  --color-text-primary: #1a1a18;
  --color-text-secondary: #6b6b63;
  --color-text-placeholder: #b0aea7;
  --color-text-disabled: #c8c6c0;

  /* Colors - Slots */
  --color-slot-coral: #f28b74;
  --color-slot-green: #5bb47a;
  --color-slot-blue: #5b8fd4;

  /* Colors - Highlight */
  --color-highlight-yellow: #fff176;
  --color-highlight-green: #c8f0c8;
  --color-highlight-pink: #f9c4d0;

  /* Colors - Semantic */
  --color-interactive: #5b8fd4;
  --color-interactive-hover: #4a7bbf;
  --color-danger: #e05a5a;
  --color-danger-hover: #c94444;
  --color-checkbox-done: #5bb47a;

  /* Colors - Indent Levels */
  --color-indent-1: #f8f7f4;
  --color-indent-2: #f1f0eb;
  --color-indent-3: #eaeae3;

  /* Typography */
  --font-sans: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif;
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  --shadow-focus: 0 0 0 2px rgba(91, 143, 212, 0.4);

  /* Motion */
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 200ms;
  --easing-default: cubic-bezier(0.2, 0, 0, 1);
  --easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```
