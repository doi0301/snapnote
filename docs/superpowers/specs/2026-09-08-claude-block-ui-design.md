# 클로드 블록 UI 개선 설계 (P6)

- 작성일: 2026-09-08
- 대상 브랜치 기준: `master` @ `7014bfd` (v1.0.18)
- 선행: P5 클로드 블록 (`3f01822`, `docs/WORK_PLAN_2026-09-06.md` §P5)

## 1. 배경과 문제

P5로 들어간 클로드 블록을 실제로 써 보니 네 가지가 걸린다.

1. **섹션 하위에 못 넣는다.** 실제 사용은 "섹션 안에 클로드 블록"이 대부분인데,
   현재는 최상위 텍스트 줄에서만 `/클로드`가 동작한다.
2. **시각적으로 섹션과 구분이 안 된다.** 슬롯 줄이 섹션 타이틀 스타일을 그대로
   재사용해서 어디까지가 블록인지 눈으로 잡히지 않는다.
3. **템플릿 모델이 실사용과 어긋난다.** 유형 단위로는 거의 안 쓰고, 압도적으로
   `{명령}` + `{첨부}` 조합에 가끔 `{요구사항}`/`{수정사항}`을 얹는다. 게다가 한 번
   템플릿을 고르면 나중에 바꿀 수 없어서, 블록을 지우고 새로 만들어야 한다.
4. **섹션에는 진행상태 표시가 없다.**

## 2. 범위

포함: 위 네 가지. 클로드 API 연동은 여전히 범위 밖(P5와 동일하게 작성·관리·복사만).

제외 (YAGNI):
- 슬롯 순서 변경 드래그 UI
- 슬롯 이름 프리셋/드롭다운 (직접 타이핑으로 충분)
- 상태 변경 시각 기록
- 답변 대기 블록 모아보기

## 3. 설계

### 3.1 중첩 허용 — 섹션 하위 클로드 블록

문제의 본질은 UI 가드가 아니라 범위 알고리즘이다.
`src/shared/sectionFold.ts` `computeSectionBlockRange` 는 **들여쓰기와 무관하게
헤더를 만나면 무조건 끊긴다.** 그래서 섹션 안에 클로드 블록을 두면 섹션 범위가
거기서 잘린다.

**변경 (핵심 한 줄):**

```ts
// 기존
if (isBlockHeader(line)) break
// 변경
if (isBlockHeader(line) && (line?.indentLevel ?? 0) <= titleIndent) break
```

"나보다 얕거나 같은 들여쓰기의 헤더에서만 끊긴다" — 더 깊게 들여쓴 헤더는 자식으로
품는다. 최상위 섹션끼리는 둘 다 indent 0이므로 기존처럼 서로 끊긴다(무회귀).

파생되는 동작은 전부 이 함수를 경유하므로 추가 코드가 필요 없다.

| 기능 | 결과 |
|---|---|
| 접기 (`computeSectionHiddenIndices`) | 섹션을 접으면 안의 클로드 블록도 함께 숨는다 |
| 드래그 재정렬 (`moveSectionBlock`) | 섹션을 옮기면 안의 클로드 블록이 딸려 이동한다 |
| `[복사]` (`exportClaudeBlockToText`) | 클로드 블록 자신의 범위는 그대로 |

**같이 고쳐야 하는 것 — `findEnclosingSectionTitleIndex`**

현재는 역방향으로 첫 헤더를 만나 그 범위 밖이면 **즉시 `null`** 을 반환한다.
중첩이 생기면 "이미 끝난 클로드 블록 뒤에 있으면서 여전히 섹션 안인 줄"이
소속 없음으로 잘못 판정된다. 범위 밖이면 멈추지 말고 **바깥으로 계속 스캔**한다.

```ts
for (let k = index - 1; k >= 0; k--) {
  if (!isBlockHeader(lines[k])) continue
  const [, end] = computeSectionBlockRange(lines, k)
  if (index <= end) return k     // 가장 안쪽 소속 헤더
  // 범위 밖이면 계속 바깥으로
}
return null
```

**`/클로드` 트리거 가드 (`Editor.tsx`)**

"어떤 블록 안이든 금지" → "**클로드 블록 안에서만 금지**". 새 헬퍼를 둔다.

```ts
/** index 를 감싸는 가장 안쪽 클로드 블록 헤더 — 없으면 null */
export function findEnclosingClaudeBlockIndex(lines, index): number | null
```

섹션 안은 허용. 클로드 블록 안 중첩은 계속 금지(프롬프트 조립이 무의미해짐).

중첩 깊이 제한은 두지 않는다 — 기존 `MAX_INDENT`(6)가 자연 상한이다.

### 3.2 감싸는 시각화 — 줄별 테두리 세그먼트

DOM 구조는 건드리지 않는다. `Editor.tsx` 의 렌더 루프는 `lines.map` 평면 구조이고,
드롭 인디케이터·`EditorBlockAfterPad`·인덱스 기반 포커스가 모두 이 평면성에
의존하므로 래퍼 `<div>` 그룹핑은 위험 대비 이득이 없다.

대신 **각 줄이 자기가 블록의 어디인지 알고 CSS 테두리 조각을 그린다.**

```
╭─ 🤖 버튼 문구 검토 ─── ⚪작성중 ⧉ ⌄ ╮   ← start: border-top + 좌우, 위 radius
│                                   │   ← mid:   border 좌우
│  ▎명령                             │
│    버튼 문구를 일관되게 고쳐줘        │
│                                   │
│  ▎첨부                             │
│    확인 / 취소 / 닫기               │
╰───────────────────────────────────╯   ← end:   border-bottom + 좌우, 아래 radius
```

**파생 데이터.** `Editor.tsx` 에서 `lines` 로부터 `Map<number, ClaudeBoxPos>` 를
`useMemo` 로 계산한다. 클로드 블록 헤더마다 `computeSectionBlockRange` 로 범위를
구해 각 인덱스에 배정:

- `'start'` — 헤더 (범위 길이 > 1)
- `'mid'` — 중간 줄
- `'end'` — 마지막 줄
- `'single'` — 헤더 혼자거나 **접혀 있을 때** (사방 radius)

`EditorLine` 에 `claudeBoxPos?: ClaudeBoxPos` prop 으로 전달하고, CSS 클래스
`.editor-line--claude-box-start|mid|end|single` 를 붙인다.

**섹션과의 시각적 구분.** 섹션은 지금처럼 *타이틀 행 자체에 배경색이 깔린 가로 띠*,
클로드 블록은 *테두리로 둘러싸인 옅은 배경 영역*. 형태가 달라 한눈에 구분된다.

**슬롯 줄 스타일 교체.** 현재 슬롯 줄은 `.editor-line--section-title` 클래스를
재사용해 섹션처럼 보인다. 이를 떼고 전용 스타일로 바꾼다:

- 좌측 짧은 색 막대 + **작은 색 알약(pill) 라벨**
- **중괄호는 화면에 그대로 남긴다.** 줄이 실제 `<textarea>` 라 값의 일부만 CSS 로
  감출 수 없고, 중괄호는 "이건 슬롯이다"라는 표식이자 슬롯을 만드는 입력 규칙
  (`{이름}` 타이핑)과도 일관된다.

**색.** 기존 `accentBar: 'blue'` 계열 한 종 고정 (P5 명세의 "블록 식별용 고정색 1종"
유지). 앱에 다크 모드가 없으므로 라이트 팔레트만 정의한다.

### 3.3 템플릿 폐기 → 슬롯 조립식

**삭제 대상**

| 항목 | 위치 |
|---|---|
| `claudeBlockTemplates.json` | `src/shared/` |
| `CLAUDE_BLOCK_TEMPLATES`, `ClaudeBlockTemplate`, `findClaudeBlockTemplate`, `CLAUDE_BLOCK_BLANK_TEMPLATE_ID` | `src/shared/claudeBlock.ts` |
| `ClaudeTemplatePicker` 컴포넌트 | `src/renderer/src/edit/EditorLine.tsx` |
| `.editor-claude-template-popover`, `.editor-claude-template-option` | `src/renderer/src/edit/editor-line.css` |
| `claudeTemplatePickerIndex` 상태, `onPickClaudeTemplate`, `onCloseClaudeTemplatePicker`, `showClaudeTemplatePicker` | `src/renderer/src/edit/Editor.tsx` |

**스키마 변경**

```ts
// 기존
claudeBlock?: { templateId: string; status: ClaudeBlockStatus }
// 변경
claudeBlock?: { status: ClaudeBlockStatus }
```

**마이그레이션.** `normalizeClaudeBlock` 에서 `templateId` 를 조용히 버린다.
슬롯은 이미 실제 줄(`claudeSlot`)로 저장돼 있으므로 데이터 손실이 없다.

**`/클로드` 삽입 결과**

헤더 + `{명령}` 슬롯 + 빈 내용 칸 + `{첨부}` 슬롯 + 빈 내용 칸.
포커스는 `{명령}` 의 내용 칸. 템플릿 선택 단계 자체가 없어진다.
사용 빈도가 높은 순서(`명령` → `첨부`)로 깐다.

**슬롯 추가 — 빈 칸에 `{이름}` 타이핑**

`handleLineChange` 에 `---` 구분선·`/클로드` 와 동일한 특수 케이스를 추가한다.
대상 줄의 조건: **클로드 블록 범위 안**이고, **헤더가 아니며**, **아직 슬롯이 아닌**
줄. 그 줄의 텍스트 전체가 정확히 `/^\{[^{}]+\}$/` 가 되는 순간 (빈 칸에 새로 치는
경우가 일반적이지만, 기존 내용을 지우고 치는 경우도 동일하게 동작한다):

1. 그 줄을 슬롯 줄로 승격 (`claudeSlot` = 중괄호 벗긴 이름)
2. 들여쓰기를 `헤더 indent + 1` 로 정규화
3. 바로 아래에 빈 내용 칸(`헤더 indent + 2`) 삽입
4. 커서를 그 내용 칸으로 이동

**슬롯 이름 변경 — P5 미구현 버그 수정**

`slotNameFromLabelText` 는 `src/shared/claudeBlock.ts` 에 있지만 **테스트에서만
쓰이고 에디터에 연결돼 있지 않다.** 기획 9-1의 "슬롯 라벨 편집 시 재파생"이
미구현 상태여서, `{첨부}` 를 `{자료}` 로 고쳐도 내부 `claudeSlot` 은 `첨부` 로
남고 `[복사]` 출력이 `{첨부}` 로 나간다.

수정: 슬롯 줄의 텍스트가 바뀌면 `claudeSlot` 을 재파생해 동기화한다.
텍스트가 `{...}` 형태를 벗어나면 슬롯을 해제해 일반 텍스트 줄로 되돌린다
(= 슬롯 삭제 UI를 따로 만들지 않아도 되는 자연스러운 경로).

**유지**: `followup` 상태 선택 시 `{추가질문}` 슬롯 자동 추가. 조립식 모델과 오히려
더 잘 맞는다.

### 3.4 섹션 상태 UI

```ts
export type SectionStatus = 'todo' | 'doing' | 'hold' | 'done'
// LineFormatting
sectionStatus?: SectionStatus
```

- `undefined` = 미지정이 기본. **미지정이면 배지를 렌더하지 않고**, 섹션 타이틀에
  호버할 때만 흐린 배지 자리가 나타난다(색상 아이콘과 동일한 호버 규칙).
- 값: ⚪ 할일 / 🔵 진행중 / 🟡 보류 / ✅ 완료, 그리고 "상태 지우기".
- 배치: 섹션 타이틀 행 오른쪽, 색상 아이콘 왼편.
- `sectionStatus` 는 `sectionTitle` 인 줄에서만 유지한다 (`normalizeSectionTitle`).

**공용 컴포넌트 추출.** `ClaudeStatusBadge` 와 구조(버튼 + 팝오버 + 바깥 클릭 닫기)가
동일하므로 제네릭 `StatusBadge<T>` 로 추출하고, 클로드/섹션이 각자
`{ order, meta, value, onPick, allowClear }` 만 주입한다. 팝오버 CSS 도 공유한다.

## 4. 리스크 — 설계 중 발견한 기존 버그

`editorLines.ts` `migrateSectionScopeToIndent` 는 섹션 타이틀 뒤의 줄들을 순회하며
**다음 `sectionTitle` 을 만날 때까지** `indentLevel <= titleIndent` 인 줄을 전부
`titleIndent + 1` 로 끌어올린다. 얕아진 줄에서 멈추는 `break` 가 없다.

결과: 섹션을 빠져나온 최상위 줄이 저장 후 다시 로드하면 섹션 안으로 빨려 들어간다.
이 마이그레이션은 `normalizeEditorLines` 에서 **매 로드마다** 돌기 때문에 1회성이
아니다.

중첩을 허용하면 이 버그의 영향 범위가 넓어지므로(섹션 안 클로드 블록 뒤 줄들)
**같이 고친다.**

고치는 방법은 **게이팅**이다. 루프 안에 `break` 를 넣는 방식은 쓰지 않는다 — 얕아진
줄에서 멈추면 legacy 문서(옛 규칙 = "다음 타이틀 전까지")의 변환 자체가 무력화되어
마이그레이션이 제 일을 못 한다. 대신 **문서 안에 legacy `sectionScope` 필드가 하나라도
있을 때만** `migrateSectionScopeToIndent` 를 돌리고, 없으면 통째로 건너뛴다.

- legacy 문서: 지금과 똑같이 1회 변환된다 (변환 후 `sectionScope` 가 제거되므로
  다음 로드부터는 건너뛴다 — 진짜 1회성이 된다).
- 신규 문서: 애초에 `sectionScope` 가 없으므로 로드 때마다 들여쓰기가 훼손되지 않는다.

## 5. 검증

**단위 테스트**
- `sectionFold.test.ts` — 중첩 범위: 섹션 > 클로드 블록, 같은 레벨 헤더 끊김,
  중첩 접기 시 숨김 집합, `findEnclosingSectionTitleIndex` 바깥 스캔
- `claudeBlock.test.ts` — 템플릿 API 제거 반영, 슬롯 라벨 파싱
- `claudeBlockExport.test.ts` — 슬롯 이름 변경 후 출력이 새 이름으로 나가는지
- `editorNormalize.test.ts` — `templateId` 제거 마이그레이션, `sectionStatus` 정규화,
  `migrateSectionScopeToIndent` 게이팅

**e2e (`e2e/claude-block.spec.ts` 확장 + `section-scope-color.spec.ts` 회귀)**
- 섹션 안에서 `/클로드` → 블록 생성, 섹션 접기 시 함께 숨김, 섹션 드래그 시 동반 이동
- 빈 칸에 `{요구사항}` 타이핑 → 슬롯 승격 + 내용 칸 생성 + 포커스 이동
- 슬롯 이름 변경 → `[복사]` 출력에 새 이름 반영
- 테두리 세그먼트 클래스가 start/mid/end 로 붙는지, 접으면 single 인지
- 섹션 상태 배지 설정/해제

**회귀**: 기존 섹션 e2e 전량(범위·드래그 재정렬·색상) + 클로드 블록 e2e 전량.
P5 때와 같은 이유로 `isBlockHeader`/`computeSectionBlockRange` 가 공유 지점이다.
