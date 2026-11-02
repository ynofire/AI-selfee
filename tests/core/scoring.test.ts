import { describe, it, expect } from 'vitest'
import fixture from '../fixtures/bank.fixture.json'
import { validateBank } from '../../src/core/bank'
import { computeReport } from '../../src/core/scoring'
import type { Answers } from '../../src/core/types'

const bank = validateBank(fixture)

/** { itemId: optionId | 'skipped' } → Answers */
const ans = (m: Record<string, string>): Answers =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v === 'skipped' ? 'skipped' : { optionId: v }])) as Answers

// f1 값: f1_1=80 f1_2=80 f1_3=67 f1_4=20(spouse) f1_5=80(boss)
const f1Full = { f1_1: 'b', f1_2: 'b', f1_3: 'n2', f1_4: 'a', f1_5: 'b' }
const byAxis = (answers: Answers) => Object.fromEntries(computeReport(bank, answers).map((r) => [r.axisId, r]))

describe('computeReport', () => {
  it('scores f1 with spread, coverage, grade and evidence', () => {
    expect(byAxis(ans(f1Full)).f1).toEqual({
      axisId: 'f1', score: 65, spread: 60, coverage: 1, grade: 'behavior', evidence: ['f1_1', 'f1_2', 'f1_4'],
    })
  })

  it('removes spread when only one audience is answered', () => {
    const r = byAxis(ans({ ...f1Full, f1_4: 'skipped' })).f1!
    expect(r.score).toBe(77)
    expect(r.spread).toBeNull()
  })

  it('gives a null score with fewer than 3 answers', () => {
    const r = byAxis(ans({ f2_1: 'a', f2_2: 'a' })).f2!
    expect(r.score).toBeNull()
    expect(r.coverage).toBe(0.67)
  })

  it('never produces NaN when everything is skipped', () => {
    const all = Object.fromEntries(bank.items.map((i) => [i.id, 'skipped']))
    for (const r of computeReport(bank, ans(all))) {
      expect(r.score).toBeNull()
      expect(r.spread).toBeNull()
      expect(r.coverage).toBe(0)
      expect(r.grade).toBe('self')
      expect(r.evidence).toEqual([])
    }
  })

  it('counts weights in the mean', () => {
    const weighted = structuredClone(bank)
    weighted.items.find((i) => i.id === 'f2_1')!.weight = 3
    const r = computeReport(weighted, ans({ f2_1: 'b', f2_2: 'a', f2_3: 'a' })).find((x) => x.axisId === 'f2')!
    expect(r.score).toBe(56) // (80*3 + 20 + 20) / 5
    expect(r.grade).toBe('self')
  })

  it('ignores answers whose option no longer exists', () => {
    const r = byAxis(ans({ ...f1Full, f1_1: 'gone' })).f1!
    expect(r.coverage).toBe(0.8)
  })

  it('returns every axis in bank order, desired layer included', () => {
    expect(computeReport(bank, {}).map((r) => r.axisId)).toEqual(['f1', 'f2', 'f3'])
  })
})
