import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import fixture from '../fixtures/bank.fixture.json'
import { validateBank } from '../../src/core/bank'
import { computeReport } from '../../src/core/scoring'
import { buildReply, mergeReply } from '../../src/core/rater'
import { buildExportMarkdown } from '../../src/core/exportPackage'
import type { Answers, Bank } from '../../src/core/types'
import type { InvitePayload } from '../../src/core/codec'

const realTemplate = readFileSync(resolve(process.cwd(), 'src/data/prompt.v1.md'), 'utf-8')
const generatedAt = new Date('2026-11-02T03:00:00Z')

const bank: Bank = validateBank(fixture)
const ans = (m: Record<string, string>): Answers =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v === 'skipped' ? 'skipped' : { optionId: v }])) as Answers

const answers = ans({
  f1_1: 'b', f1_2: 'a', f1_3: 'n1', f1_4: 'a', f1_5: 'skipped',
  f2_1: 'b', f2_2: 'b', f2_3: 'b',
  f3_1: 'b',
})

const run = (template: string, over: Partial<Parameters<typeof buildExportMarkdown>[0]> = {}) =>
  buildExportMarkdown({ bank, answers, report: computeReport(bank, answers), template, generatedAt, ...over })

describe('real template', () => {
  it('has every placeholder replaced', () => {
    expect(run(realTemplate)).not.toContain('{{')
  })

  it('defines all five tags and the date', () => {
    const out = run(realTemplate)
    for (const tag of ['[stated]', '[observed]', '[other:', '[inferred]', '[desired]']) expect(out).toContain(tag)
    expect(out).toContain('2026-11-02')
  })
})

describe('answers section', () => {
  const out = run('A:{{ANSWERS}}')

  it('lists answered items with option label, audience and basis', () => {
    expect(out).toContain('불편한 얘기를 들었을 때 나는 → 말을 고른 뒤에 꺼낸다 [stated · 자기 보고]')
    expect(out).toContain('(배우자) 배우자에게 서운한 일이 생기면 → 그날 바로 말한다 [stated · 행동 기반]')
  })

  it('leaves out skipped and unanswered items', () => {
    expect(out).not.toContain('직장 상급자에게 서운한 일이 생기면')
    expect(out).not.toContain('더 키우고 싶은 쪽은')
  })

  it('keeps desired-layer answers out of it', () => {
    expect(out).not.toContain('1년 뒤의 나는')
  })

  it('says so when nothing was answered', () => {
    const none = ans(Object.fromEntries(bank.items.map((i) => [i.id, 'skipped'])))
    expect(run('A:{{ANSWERS}}', { answers: none, report: computeReport(bank, none) })).toContain('(답변 없음)')
  })

  it('includes recall notes', () => {
    const withRecall = structuredClone(bank)
    withRecall.items.push({
      id: 'f1_6', axisId: 'f1', format: 'recall', basis: 'behavior', text: '최근 크게 다툰 일이 있었다면',
      options: [{ id: 'a', label: '바로 풀었다', value: 20 }, { id: 'b', label: '시간이 지나서 풀었다', value: 80 }],
    })
    const a: Answers = { ...answers, f1_6: { optionId: 'b', note: '지난달 아들과 빨래 문제로' } }
    const text = buildExportMarkdown({ bank: withRecall, answers: a, report: computeReport(withRecall, a), template: 'A:{{ANSWERS}}', generatedAt })
    expect(text).toContain('메모: 지난달 아들과 빨래 문제로')
  })

  it('keeps user text literal: no placeholder recursion and no $ expansion', () => {
    const withRecall = structuredClone(bank)
    withRecall.items.push({
      id: 'f1_6', axisId: 'f1', format: 'recall', basis: 'behavior', text: 'q',
      options: [{ id: 'a', label: 'x', value: 20 }, { id: 'b', label: 'y', value: 80 }],
    })
    const a: Answers = { f1_6: { optionId: 'b', note: '{{OTHER}} $& $1' } }
    const text = buildExportMarkdown({ bank: withRecall, answers: a, report: computeReport(withRecall, a), template: 'A:{{ANSWERS}}|O:{{OTHER}}', generatedAt })
    expect(text).toContain('메모: {{OTHER}} $& $1')
    expect(text).toContain('O:(지인 평가 없음)')
  })
})

describe('desired section', () => {
  it('holds only desired-layer answers, tagged [desired]', () => {
    const out = run('D:{{DESIRED}}')
    expect(out).toContain('1년 뒤의 나는 → 많이 달라졌으면 좋겠다 [desired]')
    expect(out).not.toContain('불편한 얘기를 들었을 때 나는')
  })
})

describe('report section', () => {
  it('marks axes with too little evidence', () => {
    const few = ans({ f1_1: 'b', f1_2: 'a', f1_3: 'n1', f1_4: 'a', f1_5: 'b', f2_1: 'b', f2_2: 'b' })
    expect(run('R:{{REPORT}}', { answers: few, report: computeReport(bank, few) })).toContain('결정 방식: 근거 부족')
  })

  it('says "not measured" when the spread is null, never "no difference"', () => {
    const out = run('R:{{REPORT}}')
    expect(out).toContain('표현 필터: ')
    expect(out).toContain('상대별 차이 측정 안 됨')
    expect(out).not.toContain('상대별 차이 없음')
  })

  it('lists actual-layer axes only', () => {
    const out = run('R:{{REPORT}}')
    expect(out).toContain('표현 필터: ')
    expect(out).not.toContain('되고 싶은 나')
  })
})

describe('other section', () => {
  const invite: InvitePayload = { v: 1, bank: 'fixture-1', nonce: 'abcdefgh1234', label: '민준', axes: [['f1', 65, 60]] }
  const reply = buildReply(bank, invite, { f1_r1: 5, f1_r2: 4, f1_r3: 3, f1_ra: 'a' }, '와이프')

  it('is empty without a reply', () => {
    const out = run('O:{{OTHER}}')
    expect(out).toContain('(지인 평가 없음)')
    expect(out).not.toContain('[other:와이프]')
  })

  it('writes axis-level [other:호칭] lines and never rater item ids', () => {
    const out = run('O:{{OTHER}}', { reply })
    expect(out).toContain('[other:와이프] 표현 필터: 관찰 평균 4/5')
    expect(out).toContain('상대별 차이 확인: 맞다')
    expect(out).not.toContain('f1_r1')
  })

  it('shows the other-rating and gap in the report after a merge', () => {
    const v2 = mergeReply(bank, computeReport(bank, answers), invite, reply)
    expect(run('R:{{REPORT}}', { report: v2, reply })).toMatch(/타인 평가 75\/100 \(차이 \d+\)/)
  })
})
