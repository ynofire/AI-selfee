// 종단 테스트: 보낸 사람 → 초대 링크 → 받는 사람(새 컨텍스트) → 답장 링크 → v2 → 만료.
// 실행: npm run e2e  (vite build 후 preview 서버를 직접 띄우고 끝나면 내린다)
// 배포본 확인: BASE_URL=https://<배포 주소> npm run e2e  (서버를 띄우지 않고, 응답 헤더의 CSP도 확인한다)
import { execFileSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

// 이 환경의 Playwright는 전역 설치라서 ESM import가 아니라 require로만 찾아진다.
const { chromium } = createRequire(import.meta.url)('playwright')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'e2e', 'out')
const PORT = 4173
const REMOTE = process.env.BASE_URL?.replace(/\/+$/, '')
const BASE = REMOTE ?? `http://localhost:${PORT}`
const VIEWPORT = { width: 390, height: 844 }
const DAY = 24 * 60 * 60 * 1000

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const log = (m) => console.log(`• ${m}`)

async function startServer() {
  execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, stdio: 'pipe' })
  const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe',
  })
  let stderr = ''
  server.stderr.on('data', (d) => (stderr += d))
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return server
    } catch { /* 아직 안 떴다 */ }
    if (server.exitCode !== null) throw new Error(`preview server exited: ${stderr}`)
    await new Promise((r) => setTimeout(r, 100))
  }
  server.kill()
  throw new Error('preview server did not start')
}

/** 컨텍스트마다 요청·콘솔 오류를 모은다. */
function watch(context, label, sink) {
  context.on('request', (r) => sink.requests.push({ label, url: r.url() }))
  context.on('page', (p) => {
    p.on('pageerror', (e) => sink.errors.push(`${label}: ${e.message}`))
    p.on('console', (m) => m.type() === 'error' && sink.errors.push(`${label}: ${m.text()}`))
  })
}

const noHorizontalScroll = (page, where) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth).then((ok) => assert.ok(ok, `가로 스크롤 생김: ${where}`))

const noEmailInput = (page, where) =>
  page.locator('input[type=email]').count().then((n) => assert.equal(n, 0, `이메일 입력칸이 있음: ${where}`))

async function shot(page, name) {
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true })
}

/** 보이는 문항에 첫 번째 선택지로 답한다. 18문항마다 나오는 쉬어 가기는 "이어서"로 넘긴다. */
async function answerAllOwner(page) {
  let answered = 0
  for (;;) {
    if (await page.getByTestId('session-done').isVisible()) {
      await page.getByTestId('continue').click()
      continue
    }
    const progress = page.getByTestId('progress')
    if (!(await progress.isVisible())) break
    const before = await progress.textContent()
    const isRecall = (await page.getByTestId('recall-note').count()) > 0
    await page.locator('[data-testid^="option-"]').first().click()
    if (isRecall) await page.getByTestId('recall-next').click()
    await page.waitForFunction((b) => document.querySelector('[data-testid="progress"]')?.textContent !== b, before)
    answered++
  }
  return answered
}

async function answerAllRater(page) {
  let answered = 0
  while (await page.getByTestId('progress').isVisible()) {
    const before = await page.getByTestId('progress').textContent()
    const observe = (await page.getByTestId('rate-5').count()) > 0
    await page.getByTestId(observe ? 'rate-5' : 'choice-a').click()
    await page.waitForFunction((b) => document.querySelector('[data-testid="progress"]')?.textContent !== b, before)
    answered++
  }
  return answered
}

// 배포본이면 서버를 띄우지 않는다. vite preview는 vercel.json 헤더를 적용하지 않으므로 CSP는 배포본에서만 확인할 수 있다.
const server = REMOTE ? null : await startServer()
const browser = await chromium.launch()
const sink = { requests: [], errors: [] }
let failed = null

try {
  const opts = { viewport: VIEWPORT, permissions: ['clipboard-read', 'clipboard-write'] }

  if (REMOTE) {
    const csp = (await fetch(BASE)).headers.get('content-security-policy') ?? ''
    assert.ok(csp.includes("connect-src 'none'"), `배포본 응답에 connect-src 'none' CSP가 없음: "${csp}"`)
    log(`CSP 확인: ${csp.length}자, connect-src 'none' 포함`)
  }

  // ① 보낸 사람
  const ownerCtx = await browser.newContext(opts)
  watch(ownerCtx, 'owner', sink)
  const owner = await ownerCtx.newPage()
  await owner.goto(BASE)
  await owner.getByTestId('screen-owner').waitFor()
  await noEmailInput(owner, '시작 화면')
  await noHorizontalScroll(owner, '시작 화면')
  await shot(owner, '01-owner-start')

  await owner.getByTestId('consent').check()
  await owner.getByTestId('start').click()
  await owner.getByTestId('item-text').waitFor()
  await noHorizontalScroll(owner, '문항 화면')
  await shot(owner, '02-owner-question')

  const answered = await answerAllOwner(owner)
  assert.equal(answered, 140, '140문항을 모두 답해야 한다')
  log(`보낸 사람: ${answered}문항 답함`)

  await owner.locator('li[data-testid^="axis-"]').first().waitFor()
  assert.equal(await owner.locator('li[data-testid^="axis-"]').count(), 15, '리포트 축 15개')
  assert.equal(await owner.locator('[data-testid$="-insufficient"]').count(), 0, '모든 축에 점수가 있어야 한다')
  const reportText = await owner.locator('main').innerText()
  assert.ok(!/\b[EI][SN][TF][JP]\b/.test(reportText), '유형 라벨이 없어야 한다')
  await noHorizontalScroll(owner, '리포트 화면')
  await shot(owner, '03-owner-report')

  await owner.getByTestId('to-export').click()
  const exportText = await owner.getByTestId('export-text').inputValue()
  assert.ok(!exportText.includes('{{'), '내보내기에 치환되지 않은 자리표시자가 남음')
  assert.ok(exportText.includes('# 지시') && exportText.includes('[stated'), '내보내기 내용이 비어 있음')
  await owner.getByTestId('copy-export').click()
  await owner.getByTestId('copy-done').waitFor()
  assert.equal(await owner.evaluate(() => navigator.clipboard.readText()), exportText, '클립보드 내용이 내보내기와 같아야 한다')
  await noHorizontalScroll(owner, '내보내기 화면')
  await shot(owner, '04-owner-export')
  await owner.getByTestId('back').click()

  await owner.getByTestId('to-invite').click()
  await owner.getByTestId('invite-label').fill('민준')
  const inviteUrl = await owner.getByTestId('invite-url').inputValue()
  assert.ok(inviteUrl.startsWith(`${BASE}/r#`), `초대 링크 모양: ${inviteUrl.slice(0, 40)}`)
  assert.ok(new URL(inviteUrl).hash.length - 1 < 1000, '초대 링크가 1,000자 미만이어야 한다')
  await owner.getByTestId('invite-warning').waitFor()
  await noHorizontalScroll(owner, '초대 화면')
  await shot(owner, '05-owner-invite')
  log(`초대 링크 ${inviteUrl.length}자`)

  // ② 받는 사람 (새 컨텍스트: 저장소가 따로)
  const raterCtx = await browser.newContext(opts)
  watch(raterCtx, 'rater', sink)
  const rater = await raterCtx.newPage()
  await rater.goto(inviteUrl)
  for (const id of ['sender', 'collected', 'returned', 'skip', 'local']) await rater.getByTestId(`disclosure-${id}`).waitFor()
  assert.ok((await rater.getByTestId('disclosure-sender').innerText()).includes('민준'))
  assert.equal(await rater.getByTestId('item-text').count(), 0, '동의 전에는 문항이 보이면 안 된다')
  await noEmailInput(rater, '받는 사람 안내')
  await noHorizontalScroll(rater, '받는 사람 안내')
  await shot(rater, '06-rater-intro')

  await rater.getByTestId('consent').check()
  await rater.getByTestId('start').click()
  assert.equal(await rater.locator('li[data-testid^="summary-"]').count(), 14, '초대에는 실제 모습 축 14개의 요약이 들어 있어야 한다')
  await noHorizontalScroll(rater, '받는 사람 요약')
  await shot(rater, '07-rater-summary')
  await rater.getByTestId('begin').click()
  const raterAnswered = await answerAllRater(rater)
  assert.ok(raterAnswered > 0 && raterAnswered <= 20, `받는 사람 문항은 20개 이하여야 한다: ${raterAnswered}`)
  log(`받는 사람: ${raterAnswered}문항 답함`)

  await rater.getByTestId('rater-label').fill('와이프')
  const replyUrl = await rater.getByTestId('reply-url').inputValue()
  assert.ok(replyUrl.startsWith(`${BASE}/b#`), '답장 링크 모양')
  assert.ok(new URL(replyUrl).hash.length - 1 < 1000, '답장 링크가 1,000자 미만이어야 한다')
  await noHorizontalScroll(rater, '답장 만들기 화면')
  await shot(rater, '08-rater-done')
  const raterKeys = await rater.evaluate(() => Object.keys(localStorage))
  assert.ok(raterKeys.some((k) => k.startsWith('pq:rater:')) && !raterKeys.includes('pq:owner:v1'), '받는 사람 저장소는 보낸 사람 것과 분리돼야 한다')
  log(`답장 링크 ${replyUrl.length}자`)

  // ③ 보낸 사람이 답장 링크를 연다
  await owner.goto(replyUrl)
  await owner.locator('li[data-testid^="v2-axis-"]').first().waitFor()
  assert.equal(await owner.locator('li[data-testid^="v2-axis-"]').count(), 6, '지인이 평가한 축은 관찰 가능한 6개')
  assert.ok((await owner.getByTestId('v2-axis-filter').innerText()).includes('와이프'))
  await noHorizontalScroll(owner, '답장 보기 화면')
  await shot(owner, '09-owner-v2')
  await owner.getByTestId('to-export-v2').click()
  const v2Text = await owner.getByTestId('export-text').inputValue()
  assert.ok(v2Text.includes('[other:와이프]') && !v2Text.includes('{{'), 'v2 내보내기에 지인의 시각이 들어가야 한다')
  await shot(owner, '10-owner-v2-export')

  // 답장을 다른 기기(저장소 없음)에서 열면 안내가 나온다
  const strangerCtx = await browser.newContext(opts)
  watch(strangerCtx, 'stranger', sink)
  const stranger = await strangerCtx.newPage()
  await stranger.goto(replyUrl)
  await stranger.getByTestId('reply-no-owner').waitFor()
  await shot(stranger, '11-reply-other-device')

  // ⑥ 만료: 마지막 활동을 8일 전으로 돌리고 새로고침
  await owner.goto(BASE)
  await owner.evaluate((ms) => {
    const raw = localStorage.getItem('pq:owner:v1')
    const s = JSON.parse(raw)
    s.lastActiveAt = Date.now() - ms
    localStorage.setItem('pq:owner:v1', JSON.stringify(s))
  }, 8 * DAY)
  await owner.reload()
  await owner.getByTestId('banner-expired').waitFor()
  await owner.getByTestId('start').waitFor()
  assert.equal(await owner.evaluate(() => localStorage.getItem('pq:owner:v1')), null, '만료되면 저장된 답변이 지워져야 한다')
  await shot(owner, '12-owner-expired')

  // ④ 같은 출처 밖으로 나간 요청과 콘솔 오류
  const outside = sink.requests.filter((r) => !r.url.startsWith(BASE) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'))
  assert.deepEqual(outside, [], `같은 출처 밖으로 요청이 나감: ${JSON.stringify(outside.slice(0, 3))}`)
  assert.deepEqual(sink.errors, [], `콘솔·페이지 오류: ${sink.errors.slice(0, 3).join(' | ')}`)
  log(`요청 ${sink.requests.length}건 모두 같은 출처, 오류 0건`)
} catch (e) {
  failed = e
} finally {
  await browser.close()
  server?.kill()
}

if (failed) {
  console.error(`✗ 실패: ${failed.message}`)
  process.exit(1)
}
console.log('✓ 종단 테스트 통과 (스크린샷: e2e/out/)')
