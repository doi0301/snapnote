# 클로드 블록 UI 개선 (P6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 클로드 블록을 섹션 하위에 넣을 수 있게 하고, 테두리로 감싸는 전용 시각화를 주고, 템플릿을 폐기해 슬롯 조립식으로 바꾸고, 섹션에도 진행상태 배지를 붙인다.

**Architecture:** 중첩은 `src/shared/sectionFold.ts` 의 범위 판정을 "나보다 얕거나 같은 헤더에서만 끊김"으로 일반화하는 것으로 해결한다 — 접기·드래그·복사가 전부 이 함수를 경유하므로 파생 기능은 자동으로 따라온다. 시각화는 DOM 그룹핑 없이 각 줄에 `start/mid/end/single` 위치를 파생 계산해 CSS 테두리 조각을 그린다. 템플릿은 데이터 모델(`templateId`)째 제거하고, 슬롯은 빈 칸에 `{이름}` 을 타이핑하면 승격되는 방식으로 만든다.

**Tech Stack:** Electron + React 19 + TypeScript, Vitest (단위), Playwright (e2e), electron-vite

**Spec:** `docs/superpowers/specs/2026-09-08-claude-block-ui-design.md`

## Global Constraints

- 모든 주석·문서·커밋 메시지는 **한국어**로 쓴다 (기존 코드베이스 관례).
- 들여쓰기 상한은 `MAX_INDENT = 6`. 슬롯/내용 줄 생성 시 `Math.min(MAX_INDENT, ...)` 로 클램프한다.
- 클로드 블록 식별색은 **1종 고정** (`accentBar: 'blue'` 계열). 상태별 색 세트를 만들지 않는다 — 상태는 이모지로만 표시한다.
- 다크 모드는 앱에 없다. 라이트 팔레트만 정의한다.
- `[복사]` 출력 포맷(`claudeBlockExport.ts`)은 이번 작업에서 **바꾸지 않는다**. 슬롯 이름이 정확히 반영되는지만 달라진다.
- 순수 로직은 `src/shared/` (단위 테스트 대상, React 를 import 하지 않는다), React 는 `src/renderer/src/edit/`.
- 커밋 메시지 끝에 다음 줄을 붙인다:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## 실행 순서와 의존

```
T1 (sectionFold 일반화) ──┬─→ T3 (/클로드 가드) ──→ T6 (슬롯 타이핑 추가)
                          ├─→ T7 (테두리 시각화)
T2 (마이그레이션 게이팅) ─┘
T4 (템플릿 폐기) ──→ T5 (슬롯 이름 동기화) ──→ T6
T8 (섹션 상태 UI) — 독립
T9 (문서 + 전체 회귀) — 마지막
```

T1·T2·T4·T8 은 서로 독립이라 병렬 가능. T9 는 반드시 마지막.

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `src/shared/sectionFold.ts` | 헤더 범위·숨김·이동 판정 (섹션/클로드 공용) | 수정 (T1) |
| `src/shared/sectionFold.test.ts` | 위 단위 테스트 | 수정 (T1) |
| `src/shared/claudeBlock.ts` | 슬롯 라벨 변환, 상태 메타, 박스 위치 파생 | 수정 (T4, T7) |
| `src/shared/claudeBlock.test.ts` | 위 단위 테스트 | 수정 (T4, T7) |
| `src/shared/claudeBlockTemplates.json` | (템플릿 정의) | **삭제** (T4) |
| `src/shared/sectionStatus.ts` | 섹션 상태 값·메타 | **신규** (T8) |
| `src/shared/sectionStatus.test.ts` | 위 단위 테스트 | **신규** (T8) |
| `src/shared/types.ts` | `LineFormatting` 스키마 | 수정 (T4, T8) |
| `src/renderer/src/edit/editorLines.ts` | 로드 시 정규화·마이그레이션 | 수정 (T2, T4, T8) |
| `src/renderer/src/edit/editorNormalize.test.ts` | 위 단위 테스트 | 수정 (T2, T4, T8) |
| `src/renderer/src/edit/Editor.tsx` | 줄 상태·입력 처리·렌더 루프 | 수정 (T3~T8) |
| `src/renderer/src/edit/EditorLine.tsx` | 한 줄 렌더 | 수정 (T4, T7, T8) |
| `src/renderer/src/edit/StatusBadge.tsx` | 상태 배지 + 팝오버 (클로드/섹션 공용) | **신규** (T8) |
| `src/renderer/src/edit/editor-line.css` | 줄 스타일 | 수정 (T4, T7, T8) |
| `e2e/claude-block.spec.ts` | 클로드 블록 e2e | 수정 (T3~T7) |
| `e2e/section-scope-color.spec.ts` | 섹션 e2e | 수정 (T8) |
| `docs/WORK_PLAN_2026-09-06.md` | 작업 기록 | 수정 (T9) |

---

### Task 1: 중첩 허용 — 범위 판정 일반화

**Files:**
- Modify: `src/shared/sectionFold.ts`
- Test: `src/shared/sectionFold.test.ts`

**Interfaces:**
- Consumes: 없음 (기반 태스크)
- Produces:
  - `computeSectionBlockRange(lines: EditorLine[], titleIndex: number): [number, number]` — 동작 변경 (시그니처 동일)
  - `findEnclosingSectionTitleIndex(lines: EditorLine[], index: number): number | null` — 동작 변경 (시그니처 동일)
  - `findEnclosingClaudeBlockIndex(lines: EditorLine[], index: number): number | null` — **신규**

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/shared/sectionFold.test.ts` 파일 끝에 아래 `describe` 블록을 통째로 추가한다. 파일 상단 import 에 `findEnclosingClaudeBlockIndex` 를 추가한다. `line()` 헬퍼는 그 파일에 이미 있다.

```ts
describe('중첩 (섹션 > 클로드 블록)', () => {
  /** 섹션(0) > 클로드 블록(1) > 슬롯(2) > 내용(3) > 섹션으로 복귀한 줄(1) */
  const nested = (): EditorLine[] => [
    line('sec', '섹션 A', { sectionTitle: true, accentBar: 'blue' }, 0),
    line('s-body', '섹션 본문', {}, 1),
    line('cb', '클로드 블록', { claudeBlock: { status: 'draft' }, accentBar: 'blue' }, 1),
    line('slot', '{명령}', { claudeSlot: '명령' }, 2),
    line('content', '고쳐줘', {}, 3),
    line('after', '블록 뒤 섹션 본문', {}, 1),
    line('top', '최상위로 복귀', {}, 0)
  ]

  it('섹션 범위가 더 깊게 들여쓴 클로드 블록을 품는다', () => {
    expect(computeSectionBlockRange(nested(), 0)).toEqual([0, 5])
  })

  it('클로드 블록 범위는 자기 슬롯·내용까지만이다', () => {
    expect(computeSectionBlockRange(nested(), 2)).toEqual([2, 4])
  })

  it('같거나 얕은 들여쓰기의 헤더에서는 여전히 끊긴다', () => {
    const lines = [
      line('a', '섹션 A', { sectionTitle: true }, 0),
      line('b', '본문', {}, 1),
      line('c', '섹션 B', { sectionTitle: true }, 0),
      line('d', 'B 본문', {}, 1)
    ]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 1])
  })

  it('섹션을 접으면 안의 클로드 블록까지 전부 숨는다', () => {
    const lines = nested()
    lines[0] = { ...lines[0]!, formatting: { ...lines[0]!.formatting, sectionCollapsed: true } }
    const hidden = computeSectionHiddenIndices(lines)
    expect([...hidden].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5])
  })

  it('끝난 클로드 블록 뒤의 줄도 바깥 섹션 소속으로 잡는다', () => {
    // index 5 = '블록 뒤 섹션 본문' — 역방향 첫 헤더인 클로드 블록(2)의 범위 밖이지만
    // 거기서 멈추지 말고 바깥으로 계속 스캔해 섹션(0)을 찾아야 한다
    expect(findEnclosingSectionTitleIndex(nested(), 5)).toBe(0)
  })

  it('클로드 블록 내부는 가장 안쪽 클로드 블록 헤더를 돌려준다', () => {
    expect(findEnclosingClaudeBlockIndex(nested(), 4)).toBe(2)
  })

  it('섹션 안이지만 클로드 블록 밖이면 클로드 헤더가 없다고 답한다', () => {
    expect(findEnclosingClaudeBlockIndex(nested(), 1)).toBeNull()
    expect(findEnclosingClaudeBlockIndex(nested(), 5)).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/shared/sectionFold.test.ts`
Expected: FAIL — `findEnclosingClaudeBlockIndex is not a function`, 그리고 중첩 범위 케이스가 `[0, 1]` 등으로 어긋남

- [ ] **Step 3: `computeSectionBlockRange` 의 끊김 조건을 바꾼다**

`src/shared/sectionFold.ts` 에서 아래 한 줄을 교체한다.

```ts
// 기존
    if (isBlockHeader(line)) break
// 변경
    if (isBlockHeader(line) && (line?.indentLevel ?? 0) <= titleIndent) break
```

파일 상단 블록 주석의 "다음 헤더를 만나거나(들여쓰기와 무관하게 항상 끊김 — 중첩 없음)" 문장을 아래로 고친다.

```
 * 연속되는 동안만 그 헤더에 속한다. 나보다 얕거나 같은 들여쓰기의 헤더를 만나거나,
 * 들여쓰기가 헤더와 같거나 얕아지면(Shift+Tab 등) 그 줄부터는 소속에서 빠진다.
 * 더 깊게 들여쓴 헤더는 자식으로 품는다 — 섹션 하위 클로드 블록이 이 경우다.
```

- [ ] **Step 4: `findEnclosingSectionTitleIndex` 가 바깥으로 계속 스캔하게 한다**

같은 파일에서 함수 본문을 교체한다.

```ts
/**
 * `index` 를 감싸는 가장 안쪽 헤더(섹션/클로드 블록)의 줄 인덱스 — 없으면 null.
 * 범위 밖인 헤더를 만나도 멈추지 않고 바깥으로 계속 스캔한다 (중첩 대응).
 */
export function findEnclosingSectionTitleIndex(lines: EditorLine[], index: number): number | null {
  for (let k = index - 1; k >= 0; k--) {
    if (!isBlockHeader(lines[k])) continue
    const [, end] = computeSectionBlockRange(lines, k)
    if (index <= end) return k
  }
  return null
}
```

- [ ] **Step 5: `findEnclosingClaudeBlockIndex` 를 추가한다**

같은 파일, `findEnclosingSectionTitleIndex` 바로 아래에 추가한다.

```ts
/**
 * `index` 를 감싸는 가장 안쪽 **클로드 블록** 헤더의 줄 인덱스 — 없으면 null.
 * 섹션 헤더는 무시한다. `/클로드` 중첩 금지 판정과 슬롯 승격 판정에 쓴다.
 */
export function findEnclosingClaudeBlockIndex(lines: EditorLine[], index: number): number | null {
  for (let k = index - 1; k >= 0; k--) {
    if (!lines[k]?.formatting?.claudeBlock) continue
    const [, end] = computeSectionBlockRange(lines, k)
    if (index <= end) return k
  }
  return null
}
```

- [ ] **Step 6: 기존 "중첩 없음" 테스트를 새 규칙으로 고친다**

`src/shared/sectionFold.test.ts` 의 `'always stops at the next section title regardless of its indent (no nesting)'` 테스트는 **의도적으로 깨진다** — 더 깊게 들여쓴 섹션 B 를 이제 품기 때문이다. 삭제하지 말고 아래로 교체한다.

```ts
  it('더 깊게 들여쓴 헤더는 자식으로 품고, 같거나 얕은 헤더에서 끊긴다', () => {
    const lines = [
      line('a', 'Sec A', { sectionTitle: true, sectionCollapsed: true, accentBar: 'blue' }, 0),
      line('b', 'body 1', {}, 1),
      line('c', 'Sec B (더 깊게 들여씀)', { sectionTitle: true, accentBar: 'blue' }, 2),
      line('d', 'body of B', {}, 3)
    ]
    expect(computeSectionBlockRange(lines, 0)).toEqual([0, 3])
    const hidden = computeSectionHiddenIndices(lines)
    expect([...hidden].sort((x, y) => x - y)).toEqual([1, 2, 3])
  })
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/shared/sectionFold.test.ts`
Expected: PASS

- [ ] **Step 8: 전체 단위 테스트로 회귀를 확인한다**

Run: `npm test`
Expected: PASS. 실패가 나면 그 테스트가 "중첩 없음"을 전제로 쓰였는지 확인하고, 새 규칙 기준으로 기대값을 고친다.

- [ ] **Step 9: 커밋**

```bash
git add src/shared/sectionFold.ts src/shared/sectionFold.test.ts
git commit -m "$(printf 'feat: 헤더 범위 판정을 중첩 허용으로 일반화 (P6)\n\n나보다 얕거나 같은 들여쓰기의 헤더에서만 끊기도록 바꿔 섹션이 더 깊게\n들여쓴 클로드 블록을 자식으로 품게 했다. findEnclosingSectionTitleIndex\n가 범위 밖 헤더에서 조기 종료하던 버그도 함께 고쳤다.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: 로드 시 들여쓰기 훼손 버그 수정 (마이그레이션 게이팅)

**Files:**
- Modify: `src/renderer/src/edit/editorLines.ts:67-85, 164-168`
- Test: `src/renderer/src/edit/editorNormalize.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `normalizeEditorLines(content: EditorLine[]): EditorLine[]` — 동작 변경 (시그니처 동일)

**배경:** `migrateSectionScopeToIndent` 는 섹션 타이틀 뒤의 줄을 다음 `sectionTitle` 까지 순회하며 `indentLevel <= titleIndent` 인 줄을 전부 `titleIndent + 1` 로 끌어올린다. 얕아진 줄에서 멈추는 `break` 가 없고, 이 함수가 **매 로드마다** 돌기 때문에 섹션을 빠져나온 최상위 줄이 저장/로드 때마다 섹션 안으로 빨려 들어간다.

`break` 를 넣는 방식은 쓰지 않는다 — 그러면 legacy 문서(옛 규칙 = "다음 타이틀 전까지") 변환이 무력화된다. **legacy `sectionScope` 필드가 남아 있는 문서에서만** 마이그레이션을 돌린다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/renderer/src/edit/editorNormalize.test.ts` 파일 끝에 추가한다. 파일 상단에 `normalizeEditorLines` 가 import 되어 있는지 확인하고, 없으면 추가한다.

```ts
describe('migrateSectionScopeToIndent 게이팅 (P6)', () => {
  it('legacy sectionScope 가 없으면 섹션 밖 최상위 줄의 들여쓰기를 건드리지 않는다', () => {
    const out = normalizeEditorLines([
      { id: 'a', text: '섹션 A', indentLevel: 0, formatting: { sectionTitle: true } },
      { id: 'b', text: '섹션 본문', indentLevel: 1, formatting: {} },
      { id: 'c', text: '섹션을 빠져나온 줄', indentLevel: 0, formatting: {} }
    ])
    expect(out.map((l) => l.indentLevel)).toEqual([0, 1, 0])
  })

  it('여러 번 정규화해도 결과가 같다 (멱등)', () => {
    const once = normalizeEditorLines([
      { id: 'a', text: '섹션 A', indentLevel: 0, formatting: { sectionTitle: true } },
      { id: 'b', text: '본문', indentLevel: 1, formatting: {} },
      { id: 'c', text: '밖', indentLevel: 0, formatting: {} }
    ])
    const twice = normalizeEditorLines(once)
    expect(twice.map((l) => l.indentLevel)).toEqual(once.map((l) => l.indentLevel))
  })

  it('legacy sectionScope 가 있으면 옛 규칙대로 1회 변환하고 필드를 지운다', () => {
    const out = normalizeEditorLines([
      {
        id: 'a',
        text: '섹션 A',
        indentLevel: 0,
        formatting: { sectionTitle: true, sectionScope: 'until-next' } as never
      },
      { id: 'b', text: '옛 규칙에선 섹션 소속이던 줄', indentLevel: 0, formatting: {} }
    ])
    expect(out[1]!.indentLevel).toBe(1)
    expect((out[0]!.formatting as Record<string, unknown>).sectionScope).toBeUndefined()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/renderer/src/edit/editorNormalize.test.ts`
Expected: FAIL — 첫 번째 테스트가 `[0, 1, 1]` 을 받아 `[0, 1, 0]` 과 불일치

- [ ] **Step 3: 게이팅 헬퍼를 추가한다**

`src/renderer/src/edit/editorLines.ts` 의 `migrateSectionScopeToIndent` 정의 **바로 위**에 추가한다.

```ts
/**
 * 구버전 문서 판별 — `sectionScope` 필드가 한 줄이라도 남아 있으면 아직 변환 전이다.
 * 변환이 끝나면 `normalizeSectionTitle` 이 이 필드를 지우므로 다음 로드부터는 false 가 된다.
 */
function hasLegacySectionScope(content: EditorLineModel[]): boolean {
  return content.some(
    (l) => (l.formatting as Record<string, unknown> | undefined)?.sectionScope !== undefined
  )
}
```

- [ ] **Step 4: `normalizeEditorLines` 에서 게이팅한다**

같은 파일에서 아래를 교체한다.

```ts
// 기존
  return migrateSectionScopeToIndent(content).map((l) => {
// 변경
  const base = hasLegacySectionScope(content) ? migrateSectionScopeToIndent(content) : content
  return base.map((l) => {
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/renderer/src/edit/editorNormalize.test.ts`
Expected: PASS

- [ ] **Step 6: 전체 단위 테스트로 회귀를 확인한다**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/renderer/src/edit/editorLines.ts src/renderer/src/edit/editorNormalize.test.ts
git commit -m "$(printf 'fix: 로드할 때마다 섹션 밖 줄이 섹션 안으로 빨려 들어가던 문제\n\nmigrateSectionScopeToIndent 가 매 로드마다 돌면서 얕아진 줄을 계속\n끌어올리고 있었다. legacy sectionScope 필드가 남아 있는 문서에서만\n돌도록 게이팅해 진짜 1회성 마이그레이션으로 만들었다.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: 섹션 하위에서 `/클로드` 허용

**Files:**
- Modify: `src/renderer/src/edit/Editor.tsx:1437-1460`
- Test: `e2e/claude-block.spec.ts`

**Interfaces:**
- Consumes: `findEnclosingClaudeBlockIndex(lines, index)` from Task 1
- Produces: 없음 (동작 변경만)

- [ ] **Step 1: 실패하는 e2e 테스트를 쓴다**

`e2e/claude-block.spec.ts` 파일 끝에 추가한다. 그 파일에 이미 있는 헬퍼(`newEditWindow`, `lineValues`, `triggerClaudeBlock`, `launchSnapNote`)를 그대로 쓴다.

```ts
test('섹션 하위에서도 /클로드 가 동작하고, 섹션을 접으면 블록이 함께 숨는다', async () => {
  const app = await launchSnapNote()
  const page = await newEditWindow(app)

  // 섹션 타이틀을 만들고 그 아래 들여쓴 칸에서 /클로드
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('섹션 A')
  await page.keyboard.press('Control+`')
  await page.keyboard.press('Shift+Enter') // 섹션 타이틀 아래 → 자동 +1 들여쓰기
  await page.keyboard.type('/클로드')
  await page.waitForTimeout(300)

  expect(await page.locator('.editor-line--claude-block').count()).toBe(1)

  // 섹션 접기 → 클로드 블록 줄들이 DOM 에서 사라진다
  const beforeFold = (await lineValues(page)).length
  await page.locator('.editor-line--section-title .editor-section-fold-btn').first().click()
  await page.waitForTimeout(200)
  const afterFold = (await lineValues(page)).length
  expect(afterFold).toBeLessThan(beforeFold)
  expect(await page.locator('.editor-line--claude-block').count()).toBe(0)

  await app.close()
})

test('클로드 블록 안에서는 /클로드 가 중첩 블록을 만들지 않는다', async () => {
  const app = await launchSnapNote()
  const page = await newEditWindow(app)
  await triggerClaudeBlock(page)
  await page.waitForTimeout(300)

  // 블록 안 내용 칸으로 이동해 /클로드 를 다시 친다
  const textareas = page.locator('.editor-line-textarea')
  await textareas.nth(3).click()
  await page.keyboard.type('/클로드')
  await page.waitForTimeout(300)

  expect(await page.locator('.editor-line--claude-block').count()).toBe(1)
  expect(await textareas.nth(3).inputValue()).toBe('/클로드')

  await app.close()
})
```

- [ ] **Step 2: 빌드하고 테스트가 실패하는지 확인한다**

Run: `npm run build && npx playwright test e2e/claude-block.spec.ts -g "섹션 하위에서도"`
Expected: FAIL — `.editor-line--claude-block` 이 0개 (섹션 안이라 트리거가 막힘)

- [ ] **Step 3: 가드를 클로드 블록 한정으로 좁힌다**

`src/renderer/src/edit/Editor.tsx` 상단 import 의 `@shared/sectionFold` 항목에 `findEnclosingClaudeBlockIndex` 를 추가한다. `findEnclosingSectionTitleIndex` 는 붙여넣기 들여쓰기 보정에서 계속 쓰이므로 지우지 않는다.

트리거 조건을 교체한다.

```ts
        /**
         * `/클로드` 만 입력하면 그 칸을 클로드 블록 헤더로 바꾸고 기본 슬롯을 깐다.
         * 섹션 하위에는 넣을 수 있고(P6), 클로드 블록 안에서만 중첩을 막는다 —
         * 블록 안에 블록이 있으면 프롬프트 조립이 무의미해지기 때문이다.
         */
        const cur = lines[index]
        if (
          newT === '/클로드' &&
          oldT !== '/클로드' &&
          cur &&
          !isBlockHeader(cur) &&
          !cur.formatting?.claudeSlot &&
          findEnclosingClaudeBlockIndex(lines, index) === null
        ) {
```

- [ ] **Step 4: 빌드하고 테스트가 통과하는지 확인한다**

Run: `npm run build && npx playwright test e2e/claude-block.spec.ts`
Expected: PASS (신규 2개 + 기존 클로드 블록 e2e 전부)

- [ ] **Step 5: 섹션 e2e 회귀를 확인한다**

Run: `npx playwright test e2e/section-scope-color.spec.ts e2e/section-drag-reorder.spec.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/renderer/src/edit/Editor.tsx e2e/claude-block.spec.ts
git commit -m "$(printf 'feat: 섹션 하위에서도 /클로드 로 블록을 만들 수 있게 (P6)\n\n중첩 금지 가드를 어떤 블록 안이든에서 클로드 블록 안에서만으로\n좁혔다. 섹션을 접으면 안의 클로드 블록도 함께 숨는다.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: 템플릿 폐기 — 스키마와 UI 제거

**Files:**
- Delete: `src/shared/claudeBlockTemplates.json`
- Modify: `src/shared/claudeBlock.ts`, `src/shared/types.ts:69`, `src/renderer/src/edit/editorLines.ts:29-38`, `src/renderer/src/edit/Editor.tsx`, `src/renderer/src/edit/EditorLine.tsx`, `src/renderer/src/edit/editor-line.css`
- Test: `src/shared/claudeBlock.test.ts`, `src/renderer/src/edit/editorNormalize.test.ts`, `e2e/claude-block.spec.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `LineFormatting['claudeBlock']` → `{ status: ClaudeBlockStatus }` (`templateId` 제거)
  - `CLAUDE_DEFAULT_SLOT_NAMES` = `['명령', '첨부'] as const` — Task 6 이 참조
  - 제거: `CLAUDE_BLOCK_TEMPLATES`, `ClaudeBlockTemplate`, `findClaudeBlockTemplate`, `CLAUDE_BLOCK_BLANK_TEMPLATE_ID`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/shared/claudeBlock.test.ts` 를 아래 내용으로 **통째로 교체**한다 (템플릿 `describe` 블록이 사라진다).

```ts
import { describe, expect, it } from 'vitest'
import {
  CLAUDE_DEFAULT_SLOT_NAMES,
  CLAUDE_STATUS_META,
  CLAUDE_STATUS_ORDER,
  slotLabelText,
  slotNameFromLabelText
} from './claudeBlock'

describe('기본 슬롯', () => {
  it('사용 빈도 순서대로 명령 → 첨부 두 개다', () => {
    expect([...CLAUDE_DEFAULT_SLOT_NAMES]).toEqual(['명령', '첨부'])
  })
})

describe('slot label helpers', () => {
  it('slotLabelText wraps the name in braces', () => {
    expect(slotLabelText('첨부')).toBe('{첨부}')
  })

  it('slotNameFromLabelText strips braces and whitespace', () => {
    expect(slotNameFromLabelText('{첨부}')).toBe('첨부')
    expect(slotNameFromLabelText('  {명령} ')).toBe('명령')
    expect(slotNameFromLabelText('명령')).toBe('명령')
  })
})

describe('status meta', () => {
  it('has all 5 statuses in order with an emoji + label each', () => {
    expect(CLAUDE_STATUS_ORDER).toEqual(['draft', 'sent', 'review', 'followup', 'done'])
    for (const s of CLAUDE_STATUS_ORDER) {
      expect(CLAUDE_STATUS_META[s].emoji).toBeTruthy()
      expect(CLAUDE_STATUS_META[s].label).toBeTruthy()
    }
  })
})
```

`src/renderer/src/edit/editorNormalize.test.ts` 끝에 마이그레이션 테스트를 추가한다.

```ts
describe('claudeBlock templateId 제거 마이그레이션 (P6)', () => {
  it('구버전 templateId 를 조용히 버리고 status 만 남긴다', () => {
    const out = normalizeEditorLines([
      {
        id: 'a',
        text: '블록',
        indentLevel: 0,
        formatting: { claudeBlock: { templateId: 'summarize', status: 'review' } } as never
      }
    ])
    expect(out[0]!.formatting.claudeBlock).toEqual({ status: 'review' })
  })

  it('알 수 없는 status 는 draft 로 폴백한다', () => {
    const out = normalizeEditorLines([
      {
        id: 'a',
        text: '블록',
        indentLevel: 0,
        formatting: { claudeBlock: { status: 'nope' } } as never
      }
    ])
    expect(out[0]!.formatting.claudeBlock).toEqual({ status: 'draft' })
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/shared/claudeBlock.test.ts src/renderer/src/edit/editorNormalize.test.ts`
Expected: FAIL — `CLAUDE_DEFAULT_SLOT_NAMES` 가 export 되지 않음, `claudeBlock` 에 `templateId` 가 남음

- [ ] **Step 3: 템플릿 정의 파일을 지우고 `claudeBlock.ts` 를 정리한다**

```bash
git rm src/shared/claudeBlockTemplates.json
```

`src/shared/claudeBlock.ts` 에서 `templatesJson` import, `ClaudeBlockTemplate`, `CLAUDE_BLOCK_TEMPLATES`, `CLAUDE_BLOCK_BLANK_TEMPLATE_ID`, `findClaudeBlockTemplate` 를 전부 삭제하고 아래로 대체한다.

```ts
import type { ClaudeBlockStatus } from './types'

/**
 * `/클로드` 로 블록을 만들 때 깔리는 기본 슬롯 (P6).
 * 템플릿 유형 개념은 폐기했다 — 실사용이 사실상 {명령} + {첨부} 조합에 수렴해서,
 * 유형을 고르는 단계보다 슬롯을 그때그때 붙이는 편이 빠르다.
 * 사용 빈도 순서대로 깐다.
 */
export const CLAUDE_DEFAULT_SLOT_NAMES = ['명령', '첨부'] as const
```

`slotLabelText`, `slotNameFromLabelText`, `CLAUDE_STATUS_ORDER`, `CLAUDE_STATUS_META`, `CLAUDE_FOLLOWUP_SLOT_NAME` 은 그대로 둔다.

- [ ] **Step 4: 스키마에서 `templateId` 를 뺀다**

`src/shared/types.ts` 에서 교체한다.

```ts
  /** 클로드 블록 헤더 (P5) — 섹션과 동일한 들여쓰기 기반 소속 판정을 공유한다.
   *  P6 에서 templateId 를 제거하고 상태만 남겼다 (템플릿 폐기, 슬롯 조립식) */
  claudeBlock?: { status: ClaudeBlockStatus }
```

`src/renderer/src/edit/editorLines.ts` 의 `normalizeClaudeBlock` 을 교체한다.

```ts
/** 알 수 없는 status 는 draft 로 폴백. 구버전 templateId 는 조용히 버린다 (P6) */
function normalizeClaudeBlock(formatting: Record<string, unknown>): void {
  const cb = formatting.claudeBlock as { status?: unknown } | undefined
  if (!cb || typeof cb !== 'object') {
    delete formatting.claudeBlock
    return
  }
  const status =
    typeof cb.status === 'string' && VALID_CLAUDE_STATUSES.has(cb.status) ? cb.status : 'draft'
  formatting.claudeBlock = { status }
}
```

- [ ] **Step 5: 템플릿 선택 UI 를 제거한다**

`src/renderer/src/edit/EditorLine.tsx`:
- `ClaudeTemplatePicker` 함수 정의 전체를 삭제한다
- import 에서 `CLAUDE_BLOCK_TEMPLATES` 를 뺀다
- props 인터페이스에서 `showClaudeTemplatePicker`, `onPickClaudeTemplate`, `onCloseClaudeTemplatePicker` 를 뺀다
- 렌더 본문에서 `<ClaudeTemplatePicker ... />` 를 쓰는 분기를 삭제한다

`src/renderer/src/edit/Editor.tsx`:
- `claudeTemplatePickerIndex` `useState` 와 `setClaudeTemplatePickerIndex(...)` 호출을 전부 삭제한다
- `onPickClaudeTemplate`, `onCloseClaudeTemplatePicker` 콜백 정의와 `<EditorLine>` 에 넘기던 세 prop 을 삭제한다
- import 에서 `CLAUDE_BLOCK_BLANK_TEMPLATE_ID`, `findClaudeBlockTemplate` 를 빼고 `CLAUDE_DEFAULT_SLOT_NAMES` 를 넣는다

`buildClaudeBlockLines` 를 교체한다.

```ts
/** 클로드 블록 헤더 한 줄 + 기본 슬롯(라벨+빈 내용 줄) 쌍들을 만든다 (P6) */
function buildClaudeBlockLines(headerText: string, headerIndent: number): EditorLineModel[] {
  const header: EditorLineModel = {
    id: crypto.randomUUID(),
    text: headerText,
    indentLevel: headerIndent,
    formatting: {
      claudeBlock: { status: 'draft' },
      accentBar: 'blue'
    }
  }
  const rest: EditorLineModel[] = []
  for (const slotName of CLAUDE_DEFAULT_SLOT_NAMES) {
    rest.push({
      id: crypto.randomUUID(),
      text: slotLabelText(slotName),
      indentLevel: Math.min(MAX_INDENT, headerIndent + 1),
      formatting: { claudeSlot: slotName }
    })
    rest.push({
      id: crypto.randomUUID(),
      text: '',
      indentLevel: Math.min(MAX_INDENT, headerIndent + 2),
      formatting: {}
    })
  }
  return [header, ...rest]
}
```

`/클로드` 트리거 안의 호출부를 고친다.

```ts
          const built = buildClaudeBlockLines('', cur.indentLevel)
```

`followup` 자동 슬롯 추가 코드에서 `claudeBlock` 을 재구성할 때 `...l.formatting!.claudeBlock!` 로 펼치고 있으면, `{ status }` 만 쓰도록 명시적으로 정리한다.

`src/renderer/src/edit/editor-line.css`:
- `.editor-claude-template-popover` 와 `.editor-claude-template-option` 관련 규칙을 전부 삭제한다

- [ ] **Step 6: 남은 참조가 없는지 확인한다**

Run: `grep -rn "templateId\|CLAUDE_BLOCK_TEMPLATES\|ClaudeTemplatePicker\|claudeBlockTemplates\|findClaudeBlockTemplate\|CLAUDE_BLOCK_BLANK" src/ e2e/`
Expected: 출력 없음. 남아 있으면 지운다.

- [ ] **Step 7: 템플릿을 쓰던 e2e 를 고친다**

`e2e/claude-block.spec.ts` 에서 템플릿 팝오버를 클릭하거나 `Escape` 로 닫는 단계가 있는 테스트를 찾아 그 단계를 삭제하고, 아래 테스트를 추가한다.

```ts
test('/클로드 는 템플릿 선택 없이 {명령}·{첨부} 슬롯을 바로 깐다', async () => {
  const app = await launchSnapNote()
  const page = await newEditWindow(app)
  await triggerClaudeBlock(page)
  await page.waitForTimeout(300)

  expect(await lineValues(page)).toEqual(['메모', '', '{명령}', '', '{첨부}', ''])
  expect(await page.locator('.editor-claude-template-popover').count()).toBe(0)

  await app.close()
})
```

- [ ] **Step 8: 타입체크 · 단위 테스트 · e2e 를 돌린다**

Run: `npm run typecheck && npm test && npm run build && npx playwright test e2e/claude-block.spec.ts`
Expected: 전부 PASS

- [ ] **Step 9: 커밋**

```bash
git add -A src/shared src/renderer/src/edit e2e/claude-block.spec.ts
git commit -m "$(printf 'feat!: 클로드 블록 템플릿 폐기, 기본 슬롯 명령/첨부 로 고정 (P6)\n\n유형 단위 사용 빈도가 낮고 한 번 고르면 바꿀 수 없다는 문제가 있어\n템플릿 개념을 데이터 모델째 제거했다. claudeBlock 에서 templateId 를\n빼고 status 만 남기며, 구버전 문서는 로드 시 조용히 마이그레이션된다.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: 슬롯 이름 편집 동기화 (P5 미구현 버그)

**Files:**
- Modify: `src/renderer/src/edit/Editor.tsx` (`handleLineChange`)
- Test: `e2e/claude-block.spec.ts`

**Interfaces:**
- Consumes: `slotNameFromLabelText(text: string): string` (기존)
- Produces: `SLOT_LABEL_RE: RegExp` — Task 6 이 재사용하므로 `Editor.tsx` 모듈 최상단에 선언한다

**배경:** `slotNameFromLabelText` 는 테스트에서만 쓰이고 에디터에 연결돼 있지 않다. 그래서 `{첨부}` 를 `{자료}` 로 고쳐도 내부 `claudeSlot` 은 `첨부` 로 남고 `[복사]` 출력이 `{첨부}` 로 나간다.

- [ ] **Step 1: 실패하는 e2e 테스트를 쓴다**

`e2e/claude-block.spec.ts` 에 추가한다. 줄 인덱스는 Task 4 이후 기준이다 (0=메모, 1=헤더, 2={명령}, 3=내용, 4={첨부}, 5=내용).

```ts
test('슬롯 이름을 바꾸면 [복사] 출력에 새 이름이 나간다', async () => {
  const app = await launchSnapNote()
  const page = await newEditWindow(app)
  await triggerClaudeBlock(page)
  await page.waitForTimeout(300)

  const textareas = page.locator('.editor-line-textarea')
  await textareas.nth(4).click()
  await textareas.nth(4).fill('{자료}')
  await textareas.nth(5).click()
  await textareas.nth(5).fill('스크린샷 3장')
  await page.waitForTimeout(200)

  await page.locator('.editor-claude-copy-btn').first().click()
  await page.waitForTimeout(300)

  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('{자료}')
  expect(copied).not.toContain('{첨부}')

  await app.close()
})

test('슬롯 라벨이 중괄호 형태를 벗어나면 슬롯이 해제된다', async () => {
  const app = await launchSnapNote()
  const page = await newEditWindow(app)
  await triggerClaudeBlock(page)
  await page.waitForTimeout(300)

  expect(await page.locator('.editor-line--claude-slot').count()).toBe(2)

  const textareas = page.locator('.editor-line-textarea')
  await textareas.nth(4).click()
  await textareas.nth(4).fill('그냥 텍스트')
  await page.waitForTimeout(200)

  expect(await page.locator('.editor-line--claude-slot').count()).toBe(1)

  await app.close()
})
```

- [ ] **Step 2: 빌드하고 테스트가 실패하는지 확인한다**

Run: `npm run build && npx playwright test e2e/claude-block.spec.ts -g "슬롯 이름을 바꾸면"`
Expected: FAIL — 복사 결과에 `{첨부}` 가 그대로 들어 있음

- [ ] **Step 3: 정규식 상수를 모듈 최상단에 선언한다**

`src/renderer/src/edit/Editor.tsx` 의 `buildClaudeBlockLines` 정의 **바로 위**에 추가한다.

```ts
/** 슬롯 라벨 줄로 인정하는 텍스트 — 앞뒤 공백 허용, 중괄호 안에 중괄호는 불가 */
const SLOT_LABEL_RE = /^\s*\{[^{}]+\}\s*$/
```

- [ ] **Step 4: `handleLineChange` 의 일반 경로에서 슬롯 이름을 재파생한다**

`handleLineChange` 마지막의 `setLines((prev) => { ... })` 블록에서 `return prev.map(...)` 을 아래로 교체한다.

```ts
        /**
         * 슬롯 라벨 줄을 고치면 `claudeSlot` 을 다시 뽑아 동기화한다 (P6).
         * `{...}` 형태를 벗어나면 슬롯을 해제해 평범한 텍스트 줄로 되돌린다 —
         * 슬롯 삭제 UI 를 따로 두지 않아도 되는 자연스러운 경로다.
         */
        let formatting = line.formatting
        if (formatting?.claudeSlot) {
          const nextSlot = SLOT_LABEL_RE.test(newT) ? slotNameFromLabelText(newT) : null
          if (nextSlot !== formatting.claudeSlot) {
            const nextFmt = { ...formatting }
            if (nextSlot) nextFmt.claudeSlot = nextSlot
            else delete nextFmt.claudeSlot
            formatting = nextFmt
          }
        }
        return prev.map((l, i) => (i === index ? { ...l, text: newT, spans, formatting } : l))
```

import 에 `slotNameFromLabelText` 를 추가한다.

- [ ] **Step 5: 빌드하고 테스트가 통과하는지 확인한다**

Run: `npm run build && npx playwright test e2e/claude-block.spec.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/renderer/src/edit/Editor.tsx e2e/claude-block.spec.ts
git commit -m "$(printf 'fix: 슬롯 라벨을 고쳐도 복사 출력이 옛 이름으로 나가던 문제 (P6)\n\nslotNameFromLabelText 가 테스트에서만 쓰이고 에디터에 연결돼 있지\n않았다. 라벨 줄을 고치면 claudeSlot 을 재파생하고, 중괄호 형태를\n벗어나면 슬롯을 해제하도록 연결했다.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: `{이름}` 타이핑으로 슬롯 추가

**Files:**
- Modify: `src/renderer/src/edit/Editor.tsx` (`handleLineChange`)
- Test: `e2e/claude-block.spec.ts`

**Interfaces:**
- Consumes: `findEnclosingClaudeBlockIndex` (Task 1), `SLOT_LABEL_RE` (Task 5), `slotNameFromLabelText`·`slotLabelText` (기존)
- Produces: 없음

- [ ] **Step 1: 실패하는 e2e 테스트를 쓴다**

`e2e/claude-block.spec.ts` 에 추가한다.

```ts
test('블록 안 빈 칸에 {요구사항} 을 치면 슬롯으로 승격되고 내용 칸이 생긴다', async () => {
  const app = await launchSnapNote()
  const page = await newEditWindow(app)
  await triggerClaudeBlock(page)
  await page.waitForTimeout(300)

  const textareas = page.locator('.editor-line-textarea')
  // index 5 = {첨부} 의 내용 칸. 거기서 Shift+Enter 로 같은 깊이의 빈 칸을 하나 만든다
  await textareas.nth(5).click()
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('{요구사항}')
  await page.waitForTimeout(300)

  expect(await page.locator('.editor-line--claude-slot').count()).toBe(3)
  const values = await lineValues(page)
  expect(values).toContain('{요구사항}')
  expect(values[values.indexOf('{요구사항}') + 1]).toBe('')

  // 커서가 그 내용 칸으로 옮겨가 있어 바로 타이핑할 수 있다
  await page.keyboard.type('존대말로 통일')
  await page.waitForTimeout(200)
  const after = await lineValues(page)
  expect(after[after.indexOf('{요구사항}') + 1]).toBe('존대말로 통일')

  await app.close()
})

test('블록 밖에서 {이름} 을 치면 슬롯이 되지 않는다', async () => {
  const app = await launchSnapNote()
  const page = await newEditWindow(app)
  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('{요구사항}')
  await page.waitForTimeout(300)

  expect(await page.locator('.editor-line--claude-slot').count()).toBe(0)
  expect(await first.inputValue()).toBe('{요구사항}')

  await app.close()
})
```

- [ ] **Step 2: 빌드하고 테스트가 실패하는지 확인한다**

Run: `npm run build && npx playwright test e2e/claude-block.spec.ts -g "슬롯으로 승격"`
Expected: FAIL — `.editor-line--claude-slot` 이 2개 그대로

- [ ] **Step 3: 승격 특수 케이스를 추가한다**

`src/renderer/src/edit/Editor.tsx` 의 `handleLineChange` 안, `/클로드` 트리거 블록 **바로 아래**에 추가한다 (둘 다 `oldT !== newT` 인 경우만 도는 같은 구역에 둔다).

```ts
        /**
         * 클로드 블록 안의 평범한 칸에 `{이름}` 만 치면 그 줄을 슬롯 라벨로 승격하고,
         * 바로 아래에 빈 내용 칸을 깔아 커서를 옮긴다 (P6 — 슬롯 조립식).
         * 템플릿 유형을 고르는 대신 필요한 슬롯을 그때그때 붙이는 경로다.
         */
        if (cur && SLOT_LABEL_RE.test(newT) && !isBlockHeader(cur) && !cur.formatting?.claudeSlot) {
          const headerIndex = findEnclosingClaudeBlockIndex(lines, index)
          if (headerIndex !== null) {
            const headerIndent = lines[headerIndex]!.indentLevel
            const slotName = slotNameFromLabelText(newT)
            const slotLine: EditorLineModel = {
              ...cur,
              text: slotLabelText(slotName),
              spans: undefined,
              indentLevel: Math.min(MAX_INDENT, headerIndent + 1),
              formatting: { ...(cur.formatting ?? {}), claudeSlot: slotName }
            }
            const bodyLine: EditorLineModel = {
              id: crypto.randomUUID(),
              text: '',
              indentLevel: Math.min(MAX_INDENT, headerIndent + 2),
              formatting: {}
            }
            pendingFocusRef.current = { index: index + 1, cursor: 0 }
            setLines((prev) => {
              const next = [...prev]
              next.splice(index, 1, slotLine, bodyLine)
              return next
            })
            return
          }
        }
```

import 에 `slotLabelText` 가 이미 있는지 확인하고, 없으면 추가한다.

- [ ] **Step 4: 빌드하고 테스트가 통과하는지 확인한다**

Run: `npm run build && npx playwright test e2e/claude-block.spec.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/src/edit/Editor.tsx e2e/claude-block.spec.ts
git commit -m "$(printf 'feat: 블록 안에서 중괄호 이름을 치면 슬롯이 바로 추가되게 (P6)\n\n템플릿을 폐기한 자리를 메우는 입력 경로다. --- 구분선, /클로드 와\n같은 handleLineChange 특수 케이스 패턴을 따랐다.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 7: 감싸는 테두리 시각화

**Files:**
- Modify: `src/shared/claudeBlock.ts`, `src/renderer/src/edit/Editor.tsx`, `src/renderer/src/edit/EditorLine.tsx`, `src/renderer/src/edit/editor-line.css`
- Test: `src/shared/claudeBlock.test.ts`, `e2e/claude-block.spec.ts`

**Interfaces:**
- Consumes: `computeSectionBlockRange` (Task 1)
- Produces:
  - `type ClaudeBoxPos = 'start' | 'mid' | 'end' | 'single'`
  - `computeClaudeBoxPositions(lines: EditorLine[]): Map<number, ClaudeBoxPos>`

- [ ] **Step 1: 실패하는 단위 테스트를 쓴다**

`src/shared/claudeBlock.test.ts` 끝에 추가한다. 상단 import 에 `computeClaudeBoxPositions` 와 `import type { EditorLine } from './types'` 를 추가한다.

```ts
describe('computeClaudeBoxPositions', () => {
  const line = (
    id: string,
    text: string,
    formatting: EditorLine['formatting'] = {},
    indentLevel = 0
  ): EditorLine => ({ id, text, indentLevel, formatting })

  it('헤더는 start, 중간은 mid, 마지막은 end 로 표시한다', () => {
    const lines = [
      line('t', '메모', {}, 0),
      line('h', '블록', { claudeBlock: { status: 'draft' } }, 0),
      line('s', '{명령}', { claudeSlot: '명령' }, 1),
      line('b', '고쳐줘', {}, 2),
      line('after', '블록 밖', {}, 0)
    ]
    const pos = computeClaudeBoxPositions(lines)
    expect(pos.get(0)).toBeUndefined()
    expect(pos.get(1)).toBe('start')
    expect(pos.get(2)).toBe('mid')
    expect(pos.get(3)).toBe('end')
    expect(pos.get(4)).toBeUndefined()
  })

  it('헤더 혼자면 single 이다', () => {
    const lines = [line('h', '블록', { claudeBlock: { status: 'draft' } }, 0)]
    expect(computeClaudeBoxPositions(lines).get(0)).toBe('single')
  })

  it('접힌 블록은 헤더만 single 이고 나머지에는 위치를 주지 않는다', () => {
    const lines = [
      line('h', '블록', { claudeBlock: { status: 'draft' }, sectionCollapsed: true }, 0),
      line('s', '{명령}', { claudeSlot: '명령' }, 1)
    ]
    const pos = computeClaudeBoxPositions(lines)
    expect(pos.get(0)).toBe('single')
    expect(pos.get(1)).toBeUndefined()
  })

  it('섹션 안에 중첩된 블록도 자기 범위만 감싼다', () => {
    const lines = [
      line('sec', '섹션', { sectionTitle: true }, 0),
      line('sb', '섹션 본문', {}, 1),
      line('h', '블록', { claudeBlock: { status: 'draft' } }, 1),
      line('s', '{명령}', { claudeSlot: '명령' }, 2),
      line('after', '섹션 본문 2', {}, 1)
    ]
    const pos = computeClaudeBoxPositions(lines)
    expect(pos.get(1)).toBeUndefined()
    expect(pos.get(2)).toBe('start')
    expect(pos.get(3)).toBe('end')
    expect(pos.get(4)).toBeUndefined()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/shared/claudeBlock.test.ts`
Expected: FAIL — `computeClaudeBoxPositions is not a function`

- [ ] **Step 3: 파생 함수를 구현한다**

`src/shared/claudeBlock.ts` 끝에 추가한다. 상단에 `import type { EditorLine } from './types'` 와 `import { computeSectionBlockRange } from './sectionFold'` 를 추가한다.

```ts
/** 클로드 블록을 테두리로 감쌀 때, 한 줄이 박스의 어디인지 */
export type ClaudeBoxPos = 'start' | 'mid' | 'end' | 'single'

/**
 * 클로드 블록 범위의 각 줄에 박스 위치를 배정한다 (P6).
 * DOM 을 그룹핑하지 않고 줄마다 CSS 테두리 조각을 그리기 위한 파생 데이터다 —
 * 렌더 루프의 평면 구조(드롭 인디케이터·패드·인덱스 기반 포커스)를 건드리지 않는다.
 * 접힌 블록은 헤더만 `single` 이 된다 (나머지 줄은 어차피 렌더되지 않는다).
 */
export function computeClaudeBoxPositions(lines: EditorLine[]): Map<number, ClaudeBoxPos> {
  const pos = new Map<number, ClaudeBoxPos>()
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]?.formatting?.claudeBlock) continue
    if (lines[i]?.formatting?.sectionCollapsed) {
      pos.set(i, 'single')
      continue
    }
    const [, end] = computeSectionBlockRange(lines, i)
    if (end === i) {
      pos.set(i, 'single')
      continue
    }
    pos.set(i, 'start')
    for (let j = i + 1; j < end; j++) pos.set(j, 'mid')
    pos.set(end, 'end')
  }
  return pos
}
```

- [ ] **Step 4: 단위 테스트가 통과하는지 확인한다**

Run: `npm test -- src/shared/claudeBlock.test.ts`
Expected: PASS

- [ ] **Step 5: Editor 에서 파생해 EditorLine 으로 넘긴다**

`src/renderer/src/edit/Editor.tsx` 의 import 에 `computeClaudeBoxPositions` 를 추가하고, 렌더 직전에 메모이즈한다.

```ts
  /** 클로드 블록 테두리 세그먼트용 파생 데이터 (P6) */
  const claudeBoxPositions = useMemo(() => computeClaudeBoxPositions(lines), [lines])
```

`<EditorLine>` 에 prop 을 추가한다.

```tsx
                  claudeBoxPos={claudeBoxPositions.get(index)}
```

`src/renderer/src/edit/EditorLine.tsx` 의 props 인터페이스에 추가한다.

```ts
  /** 클로드 블록 테두리 세그먼트 위치 (P6) */
  claudeBoxPos?: ClaudeBoxPos
```

import 에 `type ClaudeBoxPos` 를 추가하고, 클래스 조립에 끼운다.

```ts
    const claudeBoxClass = claudeBoxPos ? ` editor-line--claude-box-${claudeBoxPos}` : ''
```

줄 컨테이너의 `className` 템플릿 문자열 끝에 `${claudeBoxClass}` 를 붙인다.

- [ ] **Step 6: 테두리 CSS 와 슬롯 알약 스타일을 넣는다**

`src/renderer/src/edit/editor-line.css` 의 기존 `.editor-line--claude-slot` 규칙을 삭제하고, 아래를 추가한다.

```css
/* ── 클로드 블록: 줄별 테두리 세그먼트로 영역을 감싼다 (P6) ───────────── */

:root {
  --claude-box-border: rgba(59, 130, 246, 0.38);
  --claude-box-bg: rgba(239, 246, 255, 0.72);
  --claude-slot-bg: rgba(191, 219, 254, 0.85);
  --claude-slot-fg: rgba(30, 58, 138, 0.95);
}

.editor-line--claude-box-start,
.editor-line--claude-box-mid,
.editor-line--claude-box-end,
.editor-line--claude-box-single {
  background: var(--claude-box-bg);
  border-left: 1px solid var(--claude-box-border);
  border-right: 1px solid var(--claude-box-border);
}

.editor-line--claude-box-start,
.editor-line--claude-box-single {
  border-top: 1px solid var(--claude-box-border);
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  padding-top: 2px;
}

.editor-line--claude-box-end,
.editor-line--claude-box-single {
  border-bottom: 1px solid var(--claude-box-border);
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  padding-bottom: 4px;
}

/* 슬롯 라벨: 섹션 타이틀 스타일 재사용을 끊고 작은 알약으로 (P6) */
.editor-line--claude-slot .editor-line-textarea,
.editor-line--claude-slot .editor-line-mirror {
  display: inline-block;
  width: auto;
  min-width: 0;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--claude-slot-bg);
  color: var(--claude-slot-fg);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.6;
}
```

`.editor-line--claude-slot` 이 `.editor-line--section-title` 계열 스타일을 상속받던 규칙이 남아 있으면 삭제한다.

- [ ] **Step 7: e2e 로 클래스가 붙는지 확인한다**

`e2e/claude-block.spec.ts` 에 추가한다.

```ts
test('클로드 블록이 테두리 세그먼트로 감싸지고, 접으면 single 이 된다', async () => {
  const app = await launchSnapNote()
  const page = await newEditWindow(app)
  await triggerClaudeBlock(page)
  await page.waitForTimeout(300)

  expect(await page.locator('.editor-line--claude-box-start').count()).toBe(1)
  expect(await page.locator('.editor-line--claude-box-end').count()).toBe(1)
  expect(await page.locator('.editor-line--claude-box-mid').count()).toBeGreaterThan(0)
  expect(await page.locator('.editor-line--claude-box-single').count()).toBe(0)

  await page.locator('.editor-line--claude-block .editor-section-fold-btn').first().click()
  await page.waitForTimeout(200)

  expect(await page.locator('.editor-line--claude-box-single').count()).toBe(1)
  expect(await page.locator('.editor-line--claude-box-start').count()).toBe(0)

  await app.close()
})
```

- [ ] **Step 8: 빌드하고 e2e 를 돌린다**

Run: `npm run build && npx playwright test e2e/claude-block.spec.ts`
Expected: PASS

- [ ] **Step 9: 눈으로 확인한다**

Run: `npm run dev`

메모를 새로 만들어 `/클로드` 를 치고 확인한다:
- 블록 전체가 옅은 파랑 배경 + 둥근 테두리로 감싸져 있다
- 슬롯 라벨이 작은 알약으로 보이고, 섹션 타이틀(가로 색 띠)과 형태가 확실히 다르다
- 섹션 안에 넣어도 섹션 들여쓰기 안쪽에 박스가 정상적으로 그려진다
- 접으면 헤더 한 줄이 사방 둥근 칩으로 남는다

- [ ] **Step 10: 커밋**

```bash
git add src/shared/claudeBlock.ts src/shared/claudeBlock.test.ts src/renderer/src/edit e2e/claude-block.spec.ts
git commit -m "$(printf 'feat: 클로드 블록을 테두리로 감싸는 전용 시각화 (P6)\n\n줄마다 start/mid/end/single 위치를 파생 계산해 CSS 테두리 조각을\n그린다. DOM 그룹핑을 하지 않아 렌더 루프의 평면 구조(드롭 인디케이터,\n인덱스 기반 포커스)를 건드리지 않는다. 슬롯 라벨은 섹션 타이틀\n스타일 재사용을 끊고 작은 알약으로 바꿨다.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 8: 섹션 상태 UI

**Files:**
- Create: `src/shared/sectionStatus.ts`, `src/shared/sectionStatus.test.ts`, `src/renderer/src/edit/StatusBadge.tsx`
- Modify: `src/shared/types.ts`, `src/renderer/src/edit/editorLines.ts`, `src/renderer/src/edit/EditorLine.tsx`, `src/renderer/src/edit/Editor.tsx`, `src/renderer/src/edit/editor-line.css`
- Test: `src/shared/sectionStatus.test.ts`, `src/renderer/src/edit/editorNormalize.test.ts`, `e2e/section-scope-color.spec.ts`

**Interfaces:**
- Consumes: `CLAUDE_STATUS_ORDER`, `CLAUDE_STATUS_META` (기존)
- Produces:
  - `type SectionStatus = 'todo' | 'doing' | 'hold' | 'done'`
  - `SECTION_STATUS_ORDER: SectionStatus[]`
  - `SECTION_STATUS_META: Record<SectionStatus, { emoji: string; label: string }>`
  - `LineFormatting['sectionStatus']?: SectionStatus`
  - `StatusBadge<T extends string>` React 컴포넌트

- [ ] **Step 1: 실패하는 단위 테스트를 쓴다**

`src/shared/sectionStatus.test.ts` 를 새로 만든다.

```ts
import { describe, expect, it } from 'vitest'
import { SECTION_STATUS_META, SECTION_STATUS_ORDER } from './sectionStatus'

describe('섹션 상태', () => {
  it('할일·진행중·보류·완료 네 단계다', () => {
    expect(SECTION_STATUS_ORDER).toEqual(['todo', 'doing', 'hold', 'done'])
  })

  it('각 상태에 이모지와 라벨이 있다', () => {
    for (const s of SECTION_STATUS_ORDER) {
      expect(SECTION_STATUS_META[s].emoji).toBeTruthy()
      expect(SECTION_STATUS_META[s].label).toBeTruthy()
    }
  })
})
```

`src/renderer/src/edit/editorNormalize.test.ts` 에 추가한다.

```ts
describe('sectionStatus 정규화 (P6)', () => {
  it('섹션 타이틀이 아닌 줄의 sectionStatus 는 버린다', () => {
    const out = normalizeEditorLines([
      { id: 'a', text: '보통 줄', indentLevel: 0, formatting: { sectionStatus: 'doing' } as never }
    ])
    expect(out[0]!.formatting.sectionStatus).toBeUndefined()
  })

  it('알 수 없는 값은 버린다', () => {
    const out = normalizeEditorLines([
      {
        id: 'a',
        text: '섹션',
        indentLevel: 0,
        formatting: { sectionTitle: true, sectionStatus: 'nope' } as never
      }
    ])
    expect(out[0]!.formatting.sectionStatus).toBeUndefined()
  })

  it('섹션 타이틀의 정상 값은 유지한다', () => {
    const out = normalizeEditorLines([
      {
        id: 'a',
        text: '섹션',
        indentLevel: 0,
        formatting: { sectionTitle: true, sectionStatus: 'hold' } as never
      }
    ])
    expect(out[0]!.formatting.sectionStatus).toBe('hold')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/shared/sectionStatus.test.ts src/renderer/src/edit/editorNormalize.test.ts`
Expected: FAIL — `./sectionStatus` 모듈 없음

- [ ] **Step 3: 상태 정의를 만든다**

`src/shared/sectionStatus.ts` 를 새로 만든다.

```ts
/**
 * 섹션 진행상태 (P6) — 클로드 블록 상태와 값 집합이 다르다.
 * 클로드 블록은 대화 사이클(질문완료·답변검토)을 추적하지만, 섹션은 일반 작업
 * 진행 단계를 추적한다. `undefined` = 미지정이 기본이고, 그때는 배지를 그리지 않는다.
 */
export type SectionStatus = 'todo' | 'doing' | 'hold' | 'done'

export const SECTION_STATUS_ORDER: SectionStatus[] = ['todo', 'doing', 'hold', 'done']

export const SECTION_STATUS_META: Record<SectionStatus, { emoji: string; label: string }> = {
  todo: { emoji: '⚪', label: '할일' },
  doing: { emoji: '🔵', label: '진행중' },
  hold: { emoji: '🟡', label: '보류' },
  done: { emoji: '✅', label: '완료' }
}
```

`src/shared/types.ts` 최상단에 import 를 추가한다.

```ts
import type { SectionStatus } from './sectionStatus'
```

`LineFormatting` 의 `sectionColor` 바로 아래에 필드를 추가한다.

```ts
  /** 섹션 진행상태 (P6). 미지정이면 배지를 그리지 않는다 */
  sectionStatus?: SectionStatus
```

`ClaudeBlockStatus` 정의 아래에 재수출을 추가한다.

```ts
export type { SectionStatus } from './sectionStatus'
```

- [ ] **Step 4: 정규화를 붙인다**

`src/renderer/src/edit/editorLines.ts` 의 `VALID_CLAUDE_STATUSES` 옆에 추가한다.

```ts
const VALID_SECTION_STATUSES = new Set(['todo', 'doing', 'hold', 'done'])

/** sectionStatus 는 섹션 타이틀 줄에서만, 정해진 값만 유지한다 (P6) */
function normalizeSectionStatus(formatting: Record<string, unknown>): void {
  const s = formatting.sectionStatus
  if (!formatting.sectionTitle || typeof s !== 'string' || !VALID_SECTION_STATUSES.has(s)) {
    delete formatting.sectionStatus
  }
}
```

`normalizeSectionTitle` 안에서 `normalizeClaudeSlot(formatting)` 바로 뒤에 호출을 넣는다.

```ts
  normalizeSectionStatus(formatting)
```

- [ ] **Step 5: 단위 테스트가 통과하는지 확인한다**

Run: `npm test -- src/shared/sectionStatus.test.ts src/renderer/src/edit/editorNormalize.test.ts`
Expected: PASS

- [ ] **Step 6: 공용 `StatusBadge` 를 뽑는다**

`src/renderer/src/edit/StatusBadge.tsx` 를 새로 만든다.

```tsx
import { useEffect, useState } from 'react'

export interface StatusMeta {
  emoji: string
  label: string
}

/**
 * 상태 배지 + 드롭다운 (P6) — 클로드 블록과 섹션이 공유한다.
 * 값 집합만 주입받고, 팝오버 열림/바깥 클릭 닫기 동작은 여기서 관리한다.
 */
export function StatusBadge<T extends string>(props: {
  value: T | undefined
  order: readonly T[]
  meta: Record<T, StatusMeta>
  onPick: (value: T | undefined) => void
  /** 미지정으로 되돌리는 항목을 보여줄지 (섹션만 true) */
  allowClear?: boolean
  /** 미지정일 때 배지에 띄울 문구 (섹션: '상태') */
  emptyLabel?: string
  ariaLabel: string
}): React.JSX.Element {
  const { value, order, meta, onPick, allowClear, emptyLabel, ariaLabel } = props
  const [open, setOpen] = useState(false)
  const current = value ? meta[value] : undefined

  useEffect(() => {
    if (!open) return
    const onDocDown = (ev: MouseEvent): void => {
      const el = ev.target as Element | null
      if (el?.closest('.editor-status-popover') || el?.closest('.editor-status-btn')) return
      setOpen(false)
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDocDown), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDocDown)
    }
  }, [open])

  return (
    <div className="editor-status-wrap">
      <button
        type="button"
        className={`editor-status-btn${current ? '' : ' editor-status-btn--empty'}`}
        title={ariaLabel}
        aria-label={`${ariaLabel}: ${current?.label ?? '미지정'}`}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        {current ? `${current.emoji} ${current.label}` : (emptyLabel ?? '상태')}{' '}
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="editor-status-popover" role="menu" aria-label={`${ariaLabel} 선택`}>
          {order.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              className={`editor-status-option${s === value ? ' editor-status-option--current' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(s)
                setOpen(false)
              }}
            >
              {meta[s].emoji} {meta[s].label}
            </button>
          ))}
          {allowClear ? (
            <button
              type="button"
              role="menuitem"
              className="editor-status-option editor-status-option--clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(undefined)
                setOpen(false)
              }}
            >
              상태 지우기
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 7: `EditorLine` 에서 두 배지를 모두 `StatusBadge` 로 바꾼다**

`src/renderer/src/edit/EditorLine.tsx`:
- `ClaudeStatusBadge` 함수 정의를 삭제하고 `import { StatusBadge } from './StatusBadge'` 를 추가한다
- import 에 `SECTION_STATUS_META`, `SECTION_STATUS_ORDER`, `type SectionStatus` 를 추가한다
- props 에 `onPickSectionStatus?: (status: SectionStatus | undefined) => void` 를 추가한다

클로드 배지 렌더를 교체한다.

```tsx
            {isClaudeBlockHeader && claudeBlock && onPickClaudeStatus ? (
              <StatusBadge
                value={claudeBlock.status}
                order={CLAUDE_STATUS_ORDER}
                meta={CLAUDE_STATUS_META}
                onPick={(s) => s && onPickClaudeStatus(s)}
                ariaLabel="진행상태"
              />
            ) : null}
```

섹션 배지 렌더를 섹션 색상 아이콘 렌더보다 **앞**에 추가한다.

```tsx
            {isSectionTitle && onPickSectionStatus ? (
              <StatusBadge
                value={line.formatting?.sectionStatus}
                order={SECTION_STATUS_ORDER}
                meta={SECTION_STATUS_META}
                onPick={onPickSectionStatus}
                allowClear
                emptyLabel="상태"
                ariaLabel="섹션 상태"
              />
            ) : null}
```

- [ ] **Step 8: `Editor` 에 상태 변경 핸들러를 붙인다**

`src/renderer/src/edit/Editor.tsx` 의 `onPickSectionColor` 정의 근처에 추가한다.

```ts
  /** 섹션 진행상태 선택 — undefined 면 미지정으로 되돌린다 (P6) */
  const onPickSectionStatus = useCallback((index: number, status: SectionStatus | undefined) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index || !l.formatting?.sectionTitle) return l
        const formatting = { ...l.formatting }
        if (status) formatting.sectionStatus = status
        else delete formatting.sectionStatus
        return { ...l, formatting }
      })
    )
  }, [])
```

`<EditorLine>` 에 prop 을 넘긴다.

```tsx
                  onPickSectionStatus={
                    line.formatting?.sectionTitle
                      ? (status) => onPickSectionStatus(index, status)
                      : undefined
                  }
```

import 에 `type SectionStatus` 를 추가한다.

- [ ] **Step 9: CSS 를 공용 클래스명으로 옮긴다**

`src/renderer/src/edit/editor-line.css` 에서 아래 셀렉터 이름을 바꾼다 (스타일 값은 그대로).

| 기존 | 변경 |
|---|---|
| `.editor-claude-status-wrap` | `.editor-status-wrap` |
| `.editor-claude-status-btn` | `.editor-status-btn` |
| `.editor-claude-status-popover` | `.editor-status-popover` |
| `.editor-claude-status-option` | `.editor-status-option` |
| `.editor-claude-status-option--current` | `.editor-status-option--current` |

미지정 배지와 지우기 항목 스타일을 추가한다.

```css
/* 미지정 섹션 상태 — 평소엔 거의 안 보이고 줄에 호버할 때만 드러난다 (P6) */
.editor-status-btn--empty {
  opacity: 0;
  color: rgba(100, 116, 139, 0.9);
  transition: opacity 120ms ease;
}

.editor-line:hover .editor-status-btn--empty,
.editor-status-btn--empty[aria-expanded='true'] {
  opacity: 0.7;
}

.editor-status-option--clear {
  border-top: 1px solid rgba(148, 163, 184, 0.28);
  color: rgba(100, 116, 139, 0.95);
}
```

- [ ] **Step 10: e2e 테스트를 추가한다**

`e2e/section-scope-color.spec.ts` 끝에 추가한다 (그 파일의 기존 헬퍼를 쓴다 — 이름이 다르면 그 파일 것에 맞춘다).

```ts
test('섹션 상태 배지를 지정하고 다시 지울 수 있다', async () => {
  const app = await launchSnapNote()
  const page = await newEditWindow(app)

  const first = page.locator('.editor-line-textarea').first()
  await first.click()
  await first.fill('섹션 A')
  await page.keyboard.press('Control+`')
  await page.waitForTimeout(200)

  const badge = page.locator('.editor-line--section-title .editor-status-btn').first()
  await badge.click()
  await page.getByRole('menuitem', { name: /진행중/ }).click()
  await page.waitForTimeout(200)
  await expect(badge).toHaveText(/진행중/)

  await badge.click()
  await page.getByRole('menuitem', { name: '상태 지우기' }).click()
  await page.waitForTimeout(200)
  await expect(badge).toHaveText(/상태/)

  await app.close()
})
```

- [ ] **Step 11: 남은 옛 클래스 참조를 확인한다**

Run: `grep -rn "editor-claude-status" src/ e2e/`
Expected: 출력 없음. 남아 있으면 `.editor-status-*` 로 고친다.

- [ ] **Step 12: 타입체크 · 단위 테스트 · e2e 를 돌린다**

Run: `npm run typecheck && npm test && npm run build && npx playwright test e2e/section-scope-color.spec.ts e2e/claude-block.spec.ts`
Expected: 전부 PASS

- [ ] **Step 13: 커밋**

```bash
git add -A src/shared src/renderer/src/edit e2e/section-scope-color.spec.ts
git commit -m "$(printf 'feat: 섹션에도 진행상태 배지 (P6)\n\n할일·진행중·보류·완료 네 단계이고 미지정이 기본이다. 미지정이면\n배지가 거의 보이지 않다가 줄에 호버할 때만 드러난다. 클로드 블록\n배지와 구조가 같아 공용 StatusBadge 컴포넌트로 추출했다.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```

---

### Task 9: 전체 회귀 검증과 작업 기록

**Files:**
- Modify: `docs/WORK_PLAN_2026-09-06.md`

**Interfaces:**
- Consumes: Task 1~8 전부
- Produces: 없음

- [ ] **Step 1: 전체 검증을 돌린다**

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test
```

Expected: 전부 PASS. 실패한 테스트는 개별로 원인을 확인한다 — "중첩 없음"이나 "템플릿 존재"를 전제로 쓰인 오래된 기대값이면 새 규칙 기준으로 고치고, 그 외에는 실제 회귀이므로 해당 Task 로 돌아간다.

- [ ] **Step 2: 실제 앱으로 손으로 확인한다**

Run: `npm run dev`

체크리스트:
- 섹션 안에서 `/클로드` → 블록 생성, 섹션 접기 → 함께 숨김, 섹션 드래그 → 함께 이동
- 클로드 블록 안에서 `/클로드` → 아무 일도 안 일어남
- 블록 안 빈 칸에 `{요구사항}` → 슬롯 승격 + 커서가 내용 칸으로
- 슬롯 이름 변경 → `[복사]` 출력에 새 이름
- 테두리 박스가 섹션(가로 색 띠)과 시각적으로 확실히 구분됨
- 섹션 타이틀 호버 → 상태 배지 자리가 드러나고, 지정하면 남아 있음
- 메모를 닫았다 다시 열어도 들여쓰기·상태·슬롯이 그대로 (Task 2 게이팅 확인)

- [ ] **Step 3: 작업 기록을 남긴다**

`docs/WORK_PLAN_2026-09-06.md` 상단 진행 표에 행을 추가한다.

```markdown
| **P6** | 클로드 블록 UI 개선 (중첩·시각화·슬롯 조립·섹션 상태) | ✅ 완료 |
```

파일 끝에 섹션을 추가한다.

```markdown
### P6 — 클로드 블록 UI 개선

설계: `docs/superpowers/specs/2026-09-08-claude-block-ui-design.md`
계획: `docs/superpowers/plans/2026-09-08-claude-block-ui.md`

P5 를 실제로 써 보고 나온 네 가지를 고쳤다.

1. **섹션 하위 중첩 허용** — `computeSectionBlockRange` 의 끊김 조건을 "나보다
   얕거나 같은 들여쓰기의 헤더에서만"으로 일반화했다. 접기·드래그·복사가 전부
   이 함수를 경유하므로 파생 기능은 자동으로 따라왔다. P5 때 `isBlockHeader` 가
   재사용 지점이었던 것과 같은 구조다.
2. **감싸는 테두리 시각화** — DOM 그룹핑 없이 줄마다 `start/mid/end/single`
   위치를 파생 계산해 CSS 테두리 조각을 그린다. 렌더 루프의 평면 구조에
   의존하는 드롭 인디케이터·인덱스 기반 포커스를 건드리지 않으려는 선택이다.
   슬롯 라벨은 섹션 타이틀 스타일 재사용을 끊고 작은 알약으로 바꿨다.
3. **템플릿 폐기 → 슬롯 조립식** — 실사용이 `{명령}` + `{첨부}` 에 수렴하고,
   한 번 고른 유형을 바꿀 수 없다는 문제가 컸다. `templateId` 를 스키마째
   제거하고, 빈 칸에 `{이름}` 을 치면 슬롯이 붙는 방식으로 바꿨다.
4. **섹션 상태 배지** — 클로드와 값 집합이 다르다(할일·진행중·보류·완료).
   구조가 같아 `StatusBadge` 로 공용화했다.

곁다리로 고친 기존 버그 두 건:
- `slotNameFromLabelText` 가 테스트에서만 쓰이고 에디터에 연결돼 있지 않아
  슬롯 이름을 바꿔도 `[복사]` 가 옛 이름으로 나가고 있었다.
- `migrateSectionScopeToIndent` 가 매 로드마다 돌면서 섹션을 빠져나온 최상위
  줄을 계속 섹션 안으로 끌어올리고 있었다. legacy `sectionScope` 필드가 남아
  있는 문서에서만 돌도록 게이팅해 진짜 1회성 마이그레이션으로 만들었다.
```

- [ ] **Step 4: 커밋**

```bash
git add docs/WORK_PLAN_2026-09-06.md
git commit -m "$(printf 'docs: P6 클로드 블록 UI 개선 작업 기록\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
```
