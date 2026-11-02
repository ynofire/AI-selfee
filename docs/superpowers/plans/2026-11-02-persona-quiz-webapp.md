# 페르소나 문항 웹앱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문항 답변 → 규칙 기반 리포트 → AI용 프롬프트 패키지 내보내기 → 지인용 초대/답장 링크(v2)까지 되는 무료 정적 웹앱을 만든다.

**Architecture:** 서버 없는 Vite 정적 사이트. 계산·인코딩·저장은 UI와 분리된 순수 TypeScript 모듈(`src/core`)이고, React 화면은 그 모듈을 호출만 한다. 문항 은행은 `src/data/bank.v1.json`으로 분리돼 앱 코드 수정 없이 바뀐다. 보낸 사람↔받는 사람 데이터는 링크의 `#` 뒤 payload로만 오간다.

**Tech Stack:** Vite + React + TypeScript(strict), Vitest + @testing-library/react(jsdom), Playwright(e2e), Vercel Hobby.

**Spec:** `/home/claude/docs/persona-quiz-webapp-masterplan.md` (v0.2, 프로젝트 문서 `claude/persona-quiz-webapp-masterplan.md`)

**작업 위치:** 새 저장소 `/home/claude/persona-quiz/` (Task 1에서 `git init`). 경로는 모두 이 저장소 기준이다.

## Global Constraints

- 로그인 없음. 이메일 수집 없음 (보낸 사람, 받는 사람 모두). `input[type=email]`을 쓰지 않는다.
- 서버·DB 없음. 앱이 보내는 네트워크 요청은 같은 출처의 정적 파일뿐이다. 분석·추적 스크립트 금지.
- 답변은 localStorage에만 저장한다. 마지막 활동 후 7일(`EXPIRY_MS = 7*24*60*60*1000`)이 지나면 삭제한다. "모두 지우기" 제공.
- 링크: 초대 `/r#<payload>`, 답장 `/b#<payload>`. payload 인코딩 결과는 1,000자 미만이다.
- 받는 사람의 문항별 원답은 링크·내보내기 어디에도 담지 않는다. 축 단위 요약만 담는다.
- 앱은 AI API를 호출하지 않는다. 내보내기는 복사·다운로드뿐이다.
- 유형 라벨(MBTI식 코드) 금지. 축별 연속 점수 0~100.
- 광고·결제·제휴 링크 금지 (Vercel Hobby 조건).
- 축 15개(`layer: "desired"` 1개 포함), 첫 답변 문항 140개(축당 8개 × 15축 = 120, 극단 상황 20), 한 번에 18문항(`SESSION_SIZE = 18`)씩 답한다.
- 화면 문구는 한국어 존댓말, 모바일 폭(390px) 우선. 링크 payload는 데이터로만 렌더링하고 HTML로 삽입하지 않는다.
- 모든 커밋 메시지 끝에 다음 두 줄을 붙인다:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_01YXe6GfXm1kQgW6s7C5ZJCs`

## Review Focus

각 줄의 테스트는 해당 코드를 소유한 Task에 들어 있다.

1. 카톡 등에서 잘리거나 깨진 링크 → 크래시 없이 "링크가 올바르지 않아요" 화면 (Task 4, 9).
2. localStorage를 쓸 수 없는 환경(사생활 보호 모드, 인앱 브라우저) → 메모리로 동작하고 "저장되지 않아요" 경고 (Task 5, 8).
3. 만료 경계(정확히 7일, 7일 + 1ms)와 만료 24시간 전 안내 (Task 5, 8).
4. 답한 문항이 3개 미만이거나 전부 건너뛴 축 → 점수 `null`, 화면에 "근거 부족", `NaN` 없음 (Task 3, 8).
5. 은행 버전이나 초대 식별자가 맞지 않는 답장, 원래 기기가 아닌 곳에서 연 답장 → 병합하지 않고 이유를 안내 (Task 6, 9).

---

### Task 1: 프로젝트 골격과 라우팅

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`(vitest jsdom 설정 포함), `index.html`(lang="ko", viewport), `.gitignore`, `vercel.json`
- Create: `src/main.tsx`, `src/ui/App.tsx`
- Test: `tests/vercel-config.test.ts`, `tests/ui/App.test.tsx`

**Interfaces:**
- Produces: `App({ pathname, hash }: { pathname: string; hash: string }): JSX.Element` — `/`→`data-testid="screen-owner"`, `/r`→`screen-rater`, `/b`→`screen-reply`, 그 외→`screen-notfound`. 이후 Task에서 각 화면이 이 자리를 채운다.

- [ ] **Step 1: Write the failing tests**

```ts
it('routes by pathname', () => {
  for (const [p, id] of [['/', 'screen-owner'], ['/r', 'screen-rater'], ['/b', 'screen-reply'], ['/x', 'screen-notfound']])
    expect(render(<App pathname={p} hash="" />).getByTestId(id)).toBeTruthy()
})
it('vercel.json rewrites /r and /b to /index.html', () => { /* 두 rewrite의 destination === '/index.html' */ })
it("vercel.json CSP forbids network", () => { expect(cspHeader).toContain("connect-src 'none'") })
```
- [ ] **Step 2: Run** `npx vitest run` → FAIL (모듈 없음)
- [ ] **Step 3: Scaffold** — `git init`, Vite react-ts 템플릿 구성, `App`은 위 표대로 분기. `vercel.json`: rewrites `/r`, `/b` → `/index.html`; headers `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- [ ] **Step 4: Run** `npx vitest run && npx vite build` → PASS, `dist/` 생성
- [ ] **Step 5: Commit** `chore: scaffold vite react ts with routing and vercel config`

### Task 2: 타입과 문항 은행 검증

**Files:**
- Create: `src/core/types.ts`, `src/core/bank.ts`, `tests/fixtures/bank.fixture.json`
- Test: `tests/core/bank.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  `type Audience = 'spouse'|'child'|'parent'|'boss'|'friend'`; `type ItemFormat = 'forced'|'frequency'|'audience'|'recall'`;
  `interface Option { id: string; label: string; value: number }` (value는 축 위의 위치 0~100);
  `interface Item { id: string; axisId: string; format: ItemFormat; text: string; options: Option[]; basis: 'self'|'behavior'; audience?: Audience; sensitive?: boolean; extreme?: boolean; weight?: number }`;
  `interface RaterItem { id: string; axisId: string; kind: 'observe'|'audience'; text: string }` (observe는 "동의할수록 축의 높은 쪽" 방향으로 쓴다);
  `interface Axis { id: string; name: string; layer: 'actual'|'desired'; observable: boolean; low: string; high: string; summary: { low: string; mid: string; high: string } }`;
  `interface Bank { version: string; axes: Axis[]; items: Item[]; raterItems: RaterItem[] }`;
  `interface Answer { optionId: string; note?: string }`; `type Answers = Record<string, Answer | 'skipped'>`; `type RaterAnswers = Record<string, 1|2|3|4|5|'a'|'d'|'u'>` (observe는 1~5, audience는 a=맞다/d=아니다/u=모르겠다);
  `class BankError extends Error`; `validateBank(raw: unknown): Bank` (`bank.ts`).
- 픽스처: 축 3개 — `f1`(actual, observable), `f2`(actual, 비관찰), `f3`(desired). `f1`은 문항 5개 `f1_1`(forced, self), `f1_2`(forced, self), `f1_3`(frequency, behavior, 옵션 값 0/33/67/100), `f1_4`(audience spouse, behavior), `f1_5`(audience boss, behavior); forced·audience 옵션 값은 20/80. `f2` 3문항(전부 self), `f3` 3문항. `raterItems`: `f1_r1..f1_r3`(observe), `f1_ra`(audience).

- [ ] **Step 1: Write the failing tests** — `accepts the fixture`(축 3개, 문항 14개); 아래는 각각 `BankError`를 던져야 한다: 옵션 값 101, 중복 문항 id, 알 수 없는 `axisId`, `format:'audience'`인데 `audience` 없음, 옵션 1개짜리 문항, `observable:false` 축의 raterItem, `layer:'desired'`이면서 `observable:true`인 축.
- [ ] **Step 2: Run** `npx vitest run tests/core/bank.test.ts` → FAIL
- [ ] **Step 3: Implement** 위 타입과 `validateBank`(손으로 쓴 검사, 외부 라이브러리 없음)
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat: bank types and validation`

### Task 3: 리포트 계산

**Files:** Create `src/core/scoring.ts` · Test `tests/core/scoring.test.ts`

**Interfaces:**
- Consumes: Task 2의 `Bank`, `Answers`.
- Produces: `interface AxisResult { axisId: string; score: number|null; spread: number|null; coverage: number; grade: 'self'|'behavior'|'other'; evidence: string[] }`; `type Report = AxisResult[]`; `computeReport(bank: Bank, answers: Answers): Report` (bank.axes 순서).
- 규칙: 점수 = 답한 문항의 가중 평균(가중치 기본 1)을 반올림한 정수, 답한 문항 3개 미만이면 `null`. 상대별 차이 = audience 문항을 audience별 평균 낸 뒤 (최댓값 − 최솟값) 반올림, audience 2개 미만이면 `null`. `coverage` = 답한 수/전체 수(소수 둘째 자리). `grade` = 답한 문항 중 `basis:'behavior'`가 절반 이상이면 `'behavior'`, 아니면 `'self'`. `evidence` = |값−50|이 큰 순으로 최대 3개 id(동률은 id 오름차순).

- [ ] **Step 1: Write the failing tests**

```ts
it('f1 full answers', () => { // f1_1=80, f1_2=80, f1_3=67, f1_4=20, f1_5=80
  expect(r.f1).toMatchObject({ score: 65, spread: 60, coverage: 1, grade: 'behavior', evidence: ['f1_1','f1_2','f1_4'] })
})
it('skipping spouse item removes spread', () => { expect(r.f1).toMatchObject({ score: 77, spread: null }) })
it('fewer than 3 answers gives null score', () => { expect(r.f2).toMatchObject({ score: null, coverage: 0.67 }) })
it('all skipped has no NaN', () => { expect(JSON.stringify(report)).not.toContain('NaN') })
```
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** `computeReport` · **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat: report scoring`

### Task 4: 링크 payload 인코딩

**Files:** Create `src/core/codec.ts` · Test `tests/core/codec.test.ts`

**Interfaces:**
- Consumes: `Bank`, `Report`.
- Produces:
  `interface InvitePayload { v: 1; bank: string; nonce: string; label: string; axes: Array<[axisId: string, score: number, spread: number|null]> }`;
  `interface ReplyPayload { v: 1; bank: string; nonce: string; label: string; axes: Array<[axisId: string, observe: number|null, spreadCheck: 'a'|'d'|'u'|null]> }` (observe는 1~5 평균, 소수 첫째 자리);
  `class PayloadError extends Error { code: 'malformed'|'version'|'invalid'|'too_long' }`;
  `encodeInvite(p: InvitePayload): string`, `decodeInvite(s: string): InvitePayload`, `encodeReply(p: ReplyPayload): string`, `decodeReply(s: string): ReplyPayload` (JSON → UTF-8 → base64url, 압축 없음);
  `makeInvite(bank: Bank, report: Report, label: string, nonce: string): InvitePayload` (desired 층 축과 점수 `null` 축은 제외); `newNonce(): string` (`crypto.getRandomValues`, 12자 base64url);
  `inviteUrl(origin: string, p: InvitePayload): string` → `${origin}/r#…`; `replyUrl(origin: string, p: ReplyPayload): string` → `${origin}/b#…`.
- 검증 규칙: `v===1`; `bank` 1~32자; `nonce`는 `/^[A-Za-z0-9_-]{8,32}$/`; `label`은 제어문자 제거·trim 후 1~20자(코드포인트 기준), `<`·`>` 포함 시 거부; `axes` 최대 20개, axisId는 `/^[a-z0-9_]{1,16}$/`; 점수·상대별 차이는 0~100 정수; 인코딩 결과 1,000자 이상이면 `too_long`.

- [ ] **Step 1: Write the failing tests** — `roundtrips invite with Korean and emoji label`('민준💛'); `invite for 14 axes encodes under 600 chars`; `decode rejects` 각각 `PayloadError`와 code 확인: `'not-base64!!'`→malformed, 유효 payload를 `.slice(0,-5)`로 자름→PayloadError, `v:2`→version, 점수 101→invalid, label `'<img src=x onerror=alert(1)>'`→invalid, `'A'.repeat(1001)`→too_long; `makeInvite excludes desired-layer and null-score axes`; `inviteUrl starts with origin + '/r#'`; `newNonce matches the nonce regex and differs between calls`.
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** · **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat: link payload codec with validation`

### Task 5: 브라우저 저장소와 만료

**Files:** Create `src/core/storage.ts` · Test `tests/core/storage.test.ts`

**Interfaces:**
- Produces: `EXPIRY_MS`; `getStore(): Storage|null` (localStorage 접근·쓰기 시험이 던지면 `null`);
  `load<T extends { lastActiveAt: number }>(store: Storage|null, key: string, now: number): { value: T|null; expired: boolean }`;
  `save(store: Storage|null, key: string, value: unknown): boolean` (불가·용량 초과면 `false`, 던지지 않음);
  `clearAll(store: Storage|null): void` (접두사 `pq:` 키만 삭제);
  `expiryInfo(lastActiveAt: number, now: number): { expired: boolean; hoursLeft: number }` (`hoursLeft` = 남은 시간 내림);
  `interface OwnerState { v: 1; bank: string; answers: Answers; consentAt: number|null; startedAt: number; lastActiveAt: number; invites: Record<string, { label: string; createdAt: number }> }`; `interface RaterState { v: 1; nonce: string; answers: RaterAnswers; consentAt: number|null; lastActiveAt: number }` (`RaterAnswers`는 Task 2). 키: `pq:owner:v1`, `pq:rater:<nonce>`.
- 규칙: 만료는 `now - lastActiveAt > EXPIRY_MS`. 만료 시 키를 지우고 `{value:null, expired:true}`. 깨진 JSON은 키를 지우고 `{value:null, expired:false}`.

- [ ] **Step 1: Write the failing tests** — 저장·불러오기 왕복; `now - lastActiveAt === EXPIRY_MS`는 만료 아님, `+1`이면 만료이고 키 삭제; 깨진 JSON; `store=null`이면 `load`는 `value:null`, `save`는 `false`; `setItem`이 던지면 `save`는 `false`; `clearAll`은 `pq:` 외 키를 남김; `expiryInfo`가 23시간 30분 남았을 때 `hoursLeft===23`; `getStore`는 `localStorage` getter가 던질 때 `null`.
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** · **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat: storage with 7-day expiry`

### Task 6: 받는 사람 문항, 답장, v2 병합

**Files:** Create `src/core/rater.ts` · Test `tests/core/rater.test.ts`

**Interfaces:**
- Consumes: `Bank`, `Report`, `RaterAnswers`, `InvitePayload`, `ReplyPayload`.
- Produces: `buildRaterForm(bank: Bank, invite: InvitePayload): RaterItem[]` — 초대에 들어 있는 관찰 가능 축의 raterItem만. observe 먼저(축 순서), 이어서 audience를 초대의 상대별 차이가 큰 축부터(`null`은 맨 뒤), 최대 20개;
  `buildReply(bank: Bank, invite: InvitePayload, answers: RaterAnswers, label: string): ReplyPayload` — 축마다 observe 평균(없으면 `null`)과 audience 답;
  `interface AxisResultV2 extends AxisResult { other: number|null; spreadCheck: 'a'|'d'|'u'|null; gap: number|null }`; `type ReportV2 = AxisResultV2[]`;
  `class MergeError extends Error { code: 'bank'|'nonce' }`; `mergeReply(bank: Bank, report: Report, invite: InvitePayload, reply: ReplyPayload): ReportV2` — `other = round((평균−1)*25)`, `gap = |score−other|`(둘 다 있을 때), `other`가 있으면 `grade:'other'`.

- [ ] **Step 1: Write the failing tests**

```ts
it('form uses only observable axes in the invite', () => { expect(form.map(i => i.id)).toEqual(['f1_r1','f1_r2','f1_r3','f1_ra']) })
it('caps at 20 with observe first', () => { // 합성 은행: 관찰 6축 × observe 3 + audience 6
  expect(form).toHaveLength(20); expect(form.filter(i => i.kind==='observe')).toHaveLength(18) })
it('reply holds axis-level aggregates only', () => { // observe 5,4,3 + audience 'a'
  expect(reply.axes).toEqual([['f1', 4.0, 'a']]); expect(JSON.stringify(reply)).not.toContain('f1_r1') })
it('merge computes other and gap', () => { // score 65, observe 4.0
  expect(v2.f1).toMatchObject({ other: 75, gap: 10, grade: 'other', spreadCheck: 'a' }) })
it('non-observable axes stay untouched', () => { expect(v2.f2).toMatchObject({ other: null, gap: null, grade: 'self' }) })
it('merge rejects mismatches', () => { expect(() => merge(wrongNonce)).toThrow(MergeError) /* code 'nonce' */; /* wrongBank → code 'bank' */ })
```
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** · **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat: rater form, reply and v2 merge`

### Task 7: 프롬프트 템플릿 실험과 내보내기 빌더

**Files:** Create `src/data/prompt.v1.md`, `src/core/exportPackage.ts`, `docs/prompt-pretest.md` · Test `tests/core/exportPackage.test.ts`

**Interfaces:**
- Consumes: `Bank`, `Answers`, `Report`/`ReportV2`, `ReplyPayload`.
- Produces: `buildExportMarkdown(args: { bank: Bank; answers: Answers; report: Report | ReportV2; reply?: ReplyPayload; template: string; generatedAt: Date }): string`. 템플릿 자리표시자: `{{DATE}}`, `{{REPORT}}`, `{{ANSWERS}}`, `{{DESIRED}}`, `{{OTHER}}`.
- 템플릿(`prompt.v1.md`)에 반드시 들어갈 것: 역할과 지시, 태그 정의(`[stated]`, `[observed]`, `[other:호칭]`, `[inferred]`, `[desired]`), 규칙 — 근거 없는 내용을 만들지 않는다, 근거가 약하면 비워 둔다, 겉으로 보이는 모습과 속마음을 구분한다, 출력은 memory.md 섹션 구조.
- 출력 규칙: 건너뛴 문항은 제외. 문항마다 문항 텍스트 · 고른 선택지 · 상대(있으면) · 신뢰도 등급(self/behavior). recall의 `note`는 포함. desired 층 축은 `{{DESIRED}}` 아래에 `[desired]`로 분리. `reply`가 있으면 `{{OTHER}}` 아래에 축 단위 `[other:호칭]` 줄(관찰 평균, 상대별 차이 확인)만 쓴다.

- [ ] **Step 1: Write the failing tests** — 출력에 `{{`가 없다; 태그 5개가 모두 포함된다; 건너뛴 문항 텍스트는 없고 답한 문항의 선택지 라벨은 있다; desired 축 문항은 `[desired]` 구역에만 있다; recall `note`가 포함된다; `reply`가 있으면 `[other:와이프]` 줄이 있고 raterItem id는 없다.
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** `buildExportMarkdown`와 `prompt.v1.md` 초안 · **Step 4: Run** → PASS
- [ ] **Step 5: 프롬프트 사전 실험(앱 없이)** — 픽스처 답변으로 만든 내보내기를 이 세션의 Claude에 넣어 memory.md를 생성하고 `docs/prompt-pretest.md`에 기록한다. 결과를 `/home/claude/memory_v0.4.md`와 비교해 섹션 구조와 태그 사용이 맞는지 본다. 통과 기준: 답변에 없는 사실이 만들어지지 않고, 태그가 규칙대로 쓰이고, 근거가 약한 섹션이 비어 있다. 하나라도 어기면 템플릿을 고쳐 Step 5를 반복한다.
- [ ] **Step 6: Commit** `feat: export package and prompt template v1`

### Task 8: 보낸 사람 화면

**Files:** Modify `src/ui/App.tsx`(`/`에서 `OwnerApp`을 렌더, 은행은 `validateBank(bank.v1.json)`, 저장소는 `getStore()`, 시계는 `Date.now`); Create `src/data/bank.v1.json`(픽스처 복사본, Task 10에서 교체), `src/ui/owner/{OwnerApp,StartScreen,Questionnaire,ReportScreen,ExportScreen,InviteScreen}.tsx`, `src/ui/components/{ItemCard,Banner}.tsx`, `src/ui/hooks/useOwnerState.ts`, `src/ui/copy.ts` · Test `tests/ui/owner.test.tsx`

**Interfaces:**
- Consumes: Task 2~7의 `validateBank`, `computeReport`, `makeInvite`, `inviteUrl`, `newNonce`, `buildExportMarkdown`, `load/save/clearAll/expiryInfo/getStore`, `OwnerState`; `src/data/bank.v1.json`(Task 10 전에는 픽스처를 쓴다).
- Produces: `OwnerApp({ bank, store, now }: { bank: Bank; store: Storage|null; now: () => number }): JSX.Element` (`App`의 `/`가 렌더). `SESSION_SIZE = 18`.
- 화면 테스트 id: 동의 체크박스 `consent`, 시작 버튼 `start`, 건너뛰기 `skip`, 세션 종료 안내 `session-done`, 계속하기 `continue`, 리포트 축 줄 `axis-<id>`, "근거 부족" `axis-<id>-insufficient`, 복사 `copy-export`, 다운로드 `download-export`(파일명 `persona-export-YYYYMMDD.md`), AI 붙여넣기 고지 `ai-notice`, 호칭 입력 `invite-label`, 링크 `invite-url`, 공유 범위 고지 `invite-warning`, 모두 지우기 `wipe`, 배너 `banner-expired`/`banner-expiring`/`banner-nostore`.

- [ ] **Step 1: Write the failing tests** — 동의 전에는 `start`가 비활성; 18문항째 이후 `session-done`이 보이고 `continue`를 누르면 다음 세션이 이어지며, 다시 마운트해도 이어서 진행; 민감 문항에만 `skip`이 있고 누르면 `'skipped'` 저장; 리포트에 `^[EI][SN][TF][JP]$` 텍스트가 없고 점수 `null` 축은 `axis-<id>-insufficient`; 호칭이 비었거나 21자면 `invite-url`이 없고, 정상이면 `/r#`로 시작하며 길이 1,000 미만이고 `invite-warning`이 있음; `copy-export`가 `navigator.clipboard.writeText`를 호출; 내보내기 화면에 `ai-notice`; **[Review Focus 2·3·4]** `store=null`이면 `banner-nostore`이고 답변은 메모리에서 계속 동작, `lastActiveAt`이 7일 + 1ms 전이면 `banner-expired`, 23시간 남았으면 `banner-expiring`; `wipe`는 `pq:` 키를 모두 지우고 시작 화면으로 돌아간다.
- [ ] **Step 2: Run** `npx vitest run tests/ui/owner.test.tsx` → FAIL
- [ ] **Step 3: Implement** 화면과 훅. 문항 카드는 형식별(forced/frequency/audience/recall) 입력, recall만 선택적 메모(300자 이하).
- [ ] **Step 4: Run** → PASS · **Step 5: Commit** `feat: owner screens`

### Task 9: 받는 사람 화면과 답장 보기

**Files:** Modify `src/ui/App.tsx`(`/r`→`RaterApp`, `/b`→`ReplyScreen`); Create `src/ui/rater/{RaterApp,RaterIntro,RaterQuestions,RaterDone}.tsx`, `src/ui/owner/ReplyScreen.tsx`, `src/ui/components/ErrorScreen.tsx` · Test `tests/ui/rater.test.tsx`

**Interfaces:**
- Consumes: Task 4·5·6의 모든 공개 함수, `OwnerState`, `RaterState`.
- Produces: `RaterApp({ hash, bank, store, now }): JSX.Element` (`/r`), `ReplyScreen({ hash, bank, store, now }): JSX.Element` (`/b`), `ErrorScreen({ message }: { message: string }): JSX.Element`.
- 테스트 id: 안내 화면의 `disclosure-sender`(보낸 사람 호칭), `disclosure-collected`(수집 항목), `disclosure-returned`("보낸 사람에게는 축별 요약만 전달"), `disclosure-skip`(건너뛰기·중단 자유), `disclosure-local`(답변은 이 기기에만, 모두 지우기); `consent`, `summary-<axisId>`, `reply-url`, `wipe`, `error-screen`, `v2-axis-<id>`.

- [ ] **Step 1: Write the failing tests** — **[Review Focus 1·5]** `/r#` 뒤가 깨졌거나 잘리면 `error-screen`이고 문구에 "링크가 올바르지 않아요"가 있으며 던지지 않음; 정상 초대면 `disclosure-*` 5개가 모두 보이고 `consent` 전에는 문항이 안 보임; 문항은 20개 이하이고 새로고침(재마운트) 후 `pq:rater:<nonce>`에서 이어짐; 완료하면 `reply-url`이 `/b#`로 시작하고 길이 1,000 미만이며 문항 id가 들어 있지 않음; `/b#` 열기 — 보낸 사람 상태에 같은 nonce가 있으면 `v2-axis-<id>`로 v2 표시, 다른 nonce면 "다른 초대의 답장" 안내, 보낸 사람 상태가 없으면(다른 기기) 원래 기기에서 열라는 안내; `wipe`는 `pq:rater:<nonce>`를 지움.
- [ ] **Step 2: Run** → FAIL · **Step 3: Implement** · **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat: rater screens and reply viewer`

### Task 10: 문항 은행 v1 콘텐츠

**Files:** Create `src/data/bank.v1.json` · Test `tests/core/bank-content.test.ts`

**Interfaces:**
- Consumes: Task 2의 `validateBank`.
- Produces: 축 15개 — 마스터 문서 12개(기대치 설정·갱신, 표현 필터, 책임·역할 범위·도움 조건, 임계점·폭발 조건, 결정 방식, 관계 유지, 고마움·사과·돌봄 표현, 가치와 우선순위, 즐거움과 몰입, 말투와 유머, 시간에 따른 변화, 되고 싶은 나[`layer:'desired'`]) + 스트레스·기분 반응, 새로움·위험에 대한 태도, 사람 만난 뒤의 에너지 소모. 관찰 가능(`observable:true`)은 표현 필터, 책임·역할, 임계점, 관계 유지, 고마움·사과·돌봄 표현, 말투·유머 6개.
- 구성: 축당 8문항(forced 3, frequency 2, audience 2[서로 다른 상대], recall 1) = 120 + 극단 상황 20(`format:'recall'`, `extreme:true`, 축에 1~2개씩) = 140. forced 선택지는 둘 다 사회적으로 좋아 보이게 쓴다. 관찰 가능 축마다 `observe` 3개와 `audience` 1개 raterItem(동의할수록 축의 높은 쪽). 민감한 문항에 `sensitive:true`.

- [ ] **Step 1: Write the failing tests** — `validateBank` 통과; 문항 140개; 축당 비극단 문항 8개이고 형식 분포가 3/2/2/1; 축마다 서로 다른 audience가 2개 이상; 극단 문항 20개; 관찰 가능 축 6개이고 축마다 observe 3 + audience 1; 모든 옵션 값 0~100이고 forced 문항은 값이 서로 달라 양 끝을 구분; 문항 id 유일.
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: 문항 작성** — 문항 문장은 존댓말, 한 문항 한 가지만 묻고 "항상/절대" 같은 극단어를 쓰지 않는다. 작성 후 사용자에게 문장 검토를 받는다(검토 반영 전까지 Task 11로 넘어가지 않는다).
- [ ] **Step 4: Run** → PASS · **Step 5: Commit** `feat: question bank v1`

### Task 11: 종단 테스트 (Playwright)

**Files:** Create `e2e/flow.e2e.mjs`, `package.json`의 `"e2e"` 스크립트 · 서버: `vite preview`

**Interfaces:** Consumes: 모든 화면 test id, `bank.v1.json`.

- [ ] **Step 1: Write the e2e** — `import { chromium } from 'playwright'` (이 환경엔 설치돼 있으니 `playwright install`은 실행하지 않는다). 시나리오: ① 보낸 사람 컨텍스트에서 동의 → 140문항을 모두 첫 선택지로 답함(18문항마다 `continue`) → 리포트 → 내보내기 복사 텍스트에 `{{`가 없음 → 호칭 "민준" 입력 → `invite-url` 확보(1,000자 미만) ② **새 컨텍스트**(받는 사람)에서 그 URL 열기 → 동의 → 모든 문항 응답 → `reply-url` 확보 ③ 보낸 사람 컨텍스트에서 `reply-url` 열기 → `v2-axis-*` 표시 ④ 모든 컨텍스트에서 같은 출처 이외 요청 0건, `input[type=email]` 0개 ⑤ 390×844에서 가로 스크롤 없음 ⑥ `localStorage`의 `lastActiveAt`을 8일 전으로 바꾸고 새로고침 → `banner-expired`.
- [ ] **Step 2: Run** `npx vite build && npx vite preview & node e2e/flow.e2e.mjs` → 처음엔 FAIL이면 원인을 고친다
- [ ] **Step 3: Run** → 모든 단언 PASS (스크린샷 `e2e/out/`에 저장)
- [ ] **Step 4: Commit** `test: end-to-end flow`

### Task 12: 배포와 카톡 실측

**Files:** Create `docs/deploy-checklist.md`, `docs/kakao-check.md`

- [ ] **Step 1 [사용자]:** GitHub에 빈 저장소를 만들고 알려준다. (저장소 이름은 사용자가 정한다.)
- [ ] **Step 2:** 저장소를 이 세션에 연결하고 `main`을 푸시한다. 연결이 안 되면 멈추고 사용자에게 알린다.
- [ ] **Step 3 [사용자]:** Vercel에서 그 저장소를 Import한다 (프레임워크 Vite, 환경 변수 없음, Analytics 끄기).
- [ ] **Step 4:** 배포 URL로 `e2e/flow.e2e.mjs`를 실행하고(`BASE_URL` 환경 변수), 응답 헤더에 `Content-Security-Policy`의 `connect-src 'none'`가 있는지 확인한다.
- [ ] **Step 5 [사용자]:** 폰에서 `docs/kakao-check.md`의 항목을 확인한다 — ① 초대 링크를 카톡 "나와의 채팅"에 보내고 카톡 안에서 열었을 때 안내 화면이 정상 ② 문항 3개 답하고 닫았다 다시 열면 진행 유지 ③ 답장 링크도 같은 방식으로 정상 ④ 링크가 잘리면 길이를 기록. 하나라도 실패하면 구현을 멈추고 해결안을 상의한다.
- [ ] **Step 6 [사용자]:** 공개 전에 개인정보처리방침이 필요한지 확인한다 (법률 자문 필요 여부 포함).
- [ ] **Step 7 [사용자]:** 민준 + 와이프 실사용 1회 — 초대 링크 전달 → 와이프 답변 → 답장 링크 → v2 확인. 불편했던 점을 `docs/kakao-check.md`에 적는다.
- [ ] **Step 8: Commit** `docs: deploy and kakao check results`
