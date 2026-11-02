import { describe, it, expect } from 'vitest'
import fixture from '../fixtures/bank.fixture.json'
import { validateBank } from '../../src/core/bank'
import type { Bank, RaterAnswers } from '../../src/core/types'
import type { Report } from '../../src/core/scoring'
import type { InvitePayload, ReplyPayload } from '../../src/core/codec'
import { buildRaterForm, buildReply, mergeReply, MergeError } from '../../src/core/rater'
import { SPREAD_NOTABLE } from '../../src/core/scoring'

const bank = validateBank(fixture)
const NONCE = 'abcdefgh1234'
const invite: InvitePayload = {
  v: 1, bank: 'fixture-1', nonce: NONCE, label: '민준', axes: [['f1', 65, 60], ['f2', 40, null]],
}
const report: Report = [
  { axisId: 'f1', score: 65, spread: 60, coverage: 1, grade: 'behavior', evidence: [] },
  { axisId: 'f2', score: 40, spread: null, coverage: 1, grade: 'self', evidence: [] },
  { axisId: 'f3', score: 50, spread: null, coverage: 1, grade: 'self', evidence: [] },
]
const f1Answers: RaterAnswers = { f1_r1: 5, f1_r2: 4, f1_r3: 3, f1_ra: 'a' }

/** 관찰 가능 축 n개, 축마다 observe 3 + audience 1 */
function synthetic(n: number): Bank {
  const ids = Array.from({ length: n }, (_, i) => `s${i + 1}`)
  return {
    version: 'syn',
    axes: ids.map((id) => ({
      id, name: id, layer: 'actual', observable: true, low: 'l', high: 'h', summary: { low: 'l', mid: 'm', high: 'h' },
    })),
    items: [],
    raterItems: ids.flatMap((id) => [
      ...[1, 2, 3].map((k) => ({ id: `${id}_r${k}`, axisId: id, kind: 'observe' as const, text: 't' })),
      { id: `${id}_ra`, axisId: id, kind: 'audience' as const, text: 't' },
    ]),
  }
}

describe('buildRaterForm', () => {
  it('uses only observable axes that are in the invite', () => {
    expect(buildRaterForm(bank, invite).map((i) => i.id)).toEqual(['f1_r1', 'f1_r2', 'f1_r3', 'f1_ra'])
  })

  it('skips observable axes that are missing from the invite', () => {
    const syn = synthetic(6)
    const onlyS1: InvitePayload = { ...invite, bank: 'syn', axes: [['s1', 50, SPREAD_NOTABLE]] }
    expect(buildRaterForm(syn, onlyS1)).toHaveLength(4)
  })

  it('asks the spread-check item only for axes whose report says the person differs by audience', () => {
    const syn = synthetic(3)
    const inv: InvitePayload = {
      ...invite, bank: 'syn', axes: [['s1', 50, SPREAD_NOTABLE - 1], ['s2', 50, null], ['s3', 50, SPREAD_NOTABLE]],
    }
    const ids = buildRaterForm(syn, inv).map((i) => i.id)
    expect(ids).toContain('s3_ra')
    expect(ids).not.toContain('s1_ra')
    expect(ids).not.toContain('s2_ra')
    expect(ids.filter((id) => id.endsWith('_ra'))).toHaveLength(1)
  })

  it('caps at 20 with observe items first and the widest spreads next', () => {
    const syn = synthetic(6)
    const spreads = [10, 50, null, 30, 70, 20]
    const inv: InvitePayload = { ...invite, bank: 'syn', axes: spreads.map((sp, i) => [`s${i + 1}`, 50, sp]) }
    const form = buildRaterForm(syn, inv)
    expect(form).toHaveLength(20)
    expect(form.filter((i) => i.kind === 'observe')).toHaveLength(18)
    expect(form.slice(18).map((i) => i.id)).toEqual(['s5_ra', 's2_ra'])
  })
})

describe('buildReply', () => {
  it('holds axis-level aggregates only', () => {
    const reply = buildReply(bank, invite, f1Answers, '와이프')
    expect(reply).toMatchObject({ v: 1, bank: 'fixture-1', nonce: NONCE, label: '와이프' })
    expect(reply.axes).toEqual([['f1', 4, 'a']])
    expect(JSON.stringify(reply)).not.toContain('f1_r1')
  })

  it('rounds the observe mean to one decimal', () => {
    const reply = buildReply(bank, invite, { f1_r1: 5, f1_r2: 4, f1_r3: 4 }, '와이프')
    expect(reply.axes).toEqual([['f1', 4.3, null]])
  })

  it('uses null when an axis has no answers', () => {
    expect(buildReply(bank, invite, {}, '와이프').axes).toEqual([['f1', null, null]])
  })
})

describe('mergeReply', () => {
  const reply = buildReply(bank, invite, f1Answers, '와이프')
  const byAxis = (v2: ReturnType<typeof mergeReply>) => Object.fromEntries(v2.map((r) => [r.axisId, r]))

  it('computes other and gap and upgrades the grade', () => {
    expect(byAxis(mergeReply(bank, report, invite, reply)).f1).toMatchObject({
      other: 75, gap: 10, grade: 'other', spreadCheck: 'a', score: 65,
    })
  })

  it('leaves non-observable axes untouched even if the reply names them', () => {
    const sneaky: ReplyPayload = { ...reply, axes: [...reply.axes, ['f2', 5, 'a']] }
    expect(byAxis(mergeReply(bank, report, invite, sneaky)).f2).toMatchObject({ other: null, gap: null, grade: 'self', spreadCheck: null })
  })

  it('keeps the grade when the reply has no observe value', () => {
    const empty = buildReply(bank, invite, {}, '와이프')
    expect(byAxis(mergeReply(bank, report, invite, empty)).f1).toMatchObject({ other: null, gap: null, grade: 'behavior' })
  })

  it('gives other without gap when the owner score is null', () => {
    const noScore: Report = [{ ...report[0]!, score: null }, report[1]!, report[2]!]
    expect(byAxis(mergeReply(bank, noScore, invite, reply)).f1).toMatchObject({ other: 75, gap: null, grade: 'other' })
  })

  it('rejects a reply for another invite', () => {
    const wrong = { ...reply, nonce: 'zzzzzzzz9999' }
    expect(() => mergeReply(bank, report, invite, wrong)).toThrow(MergeError)
    try { mergeReply(bank, report, invite, wrong) } catch (e) { expect((e as MergeError).code).toBe('nonce') }
  })

  it('rejects a reply made against another bank version', () => {
    const wrong = { ...reply, bank: 'other-bank' }
    try { mergeReply(bank, report, invite, wrong); expect.unreachable() } catch (e) {
      expect(e).toBeInstanceOf(MergeError)
      expect((e as MergeError).code).toBe('bank')
    }
  })
})
