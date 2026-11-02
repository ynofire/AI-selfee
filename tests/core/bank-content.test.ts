import { describe, it, expect } from 'vitest'
import bankJson from '../../src/data/bank.v1.json'
import { validateBank } from '../../src/core/bank'
import { computeReport } from '../../src/core/scoring'
import { encodeInvite, makeInvite } from '../../src/core/codec'
import type { Answers, Item } from '../../src/core/types'

const bank = validateBank(bankJson)
const regular = (axisId: string): Item[] => bank.items.filter((i) => i.axisId === axisId && !i.extreme)
const extreme = (axisId: string): Item[] => bank.items.filter((i) => i.axisId === axisId && i.extreme)

const OBSERVABLE = ['filter', 'role', 'threshold', 'relate', 'care', 'voice']
const ABSOLUTE_WORDS = ['항상', '절대', '무조건', '반드시', '전혀', '결코']

describe('question bank v1: shape', () => {
  it('has 15 axes, exactly one of them the desired layer', () => {
    expect(bank.axes).toHaveLength(15)
    expect(bank.axes.filter((a) => a.layer === 'desired').map((a) => a.id)).toEqual(['desired'])
    expect(new Set(bank.axes.map((a) => a.id)).size).toBe(15)
  })

  it('has 140 items with unique ids', () => {
    expect(bank.items).toHaveLength(140)
    expect(new Set(bank.items.map((i) => i.id)).size).toBe(140)
  })

  it('gives each axis 8 regular items: 3 forced, 2 frequency, 2 audience, 1 recall', () => {
    for (const axis of bank.axes) {
      const items = regular(axis.id)
      const count = (f: string) => items.filter((i) => i.format === f).length
      expect([axis.id, items.length, count('forced'), count('frequency'), count('audience'), count('recall')]).toEqual([axis.id, 8, 3, 2, 2, 1])
    }
  })

  it('uses at least two different audiences on every axis', () => {
    for (const axis of bank.axes) {
      const audiences = regular(axis.id).filter((i) => i.format === 'audience').map((i) => i.audience)
      expect(audiences.every(Boolean)).toBe(true)
      expect([axis.id, new Set(audiences).size]).toEqual([axis.id, 2])
    }
  })

  it('has 20 extreme-situation items: recall, sensitive, 1–2 per axis, placed last in their axis', () => {
    const all = bank.items.filter((i) => i.extreme)
    expect(all).toHaveLength(20)
    for (const i of all) {
      expect(i.format).toBe('recall')
      expect(i.sensitive).toBe(true)
    }
    for (const axis of bank.axes) expect([1, 2]).toContain(extreme(axis.id).length)
    for (const axis of bank.axes) {
      const ofAxis = bank.items.filter((i) => i.axisId === axis.id)
      const firstExtreme = ofAxis.findIndex((i) => i.extreme)
      expect(ofAxis.slice(firstExtreme).every((i) => i.extreme)).toBe(true)
    }
  })

  it('flags enough items as sensitive for the skip button to matter', () => {
    expect(bank.items.filter((i) => i.sensitive).length).toBeGreaterThanOrEqual(22)
  })
})

describe('question bank v1: options', () => {
  it('keeps every option value inside 0–100', () => {
    for (const i of bank.items) for (const o of i.options) expect(o.value >= 0 && o.value <= 100).toBe(true)
  })

  it('makes every non-frequency item a two-way choice whose ends are far apart, and every frequency item a 4-step scale', () => {
    for (const i of bank.items) {
      const values = i.options.map((o) => o.value)
      expect(new Set(i.options.map((o) => o.id)).size).toBe(i.options.length)
      if (i.format === 'frequency') {
        expect([i.id, values]).toEqual([i.id, [0, 33, 67, 100]])
      } else {
        expect([i.id, values.length]).toEqual([i.id, 2])
        expect(Math.abs(values[0]! - values[1]!)).toBeGreaterThanOrEqual(40)
      }
    }
  })

  it('writes the high pole as the larger value in every item (a is low, b is high)', () => {
    for (const i of bank.items.filter((x) => x.format !== 'frequency')) {
      expect([i.id, i.options[0]!.value < i.options[1]!.value]).toEqual([i.id, true])
    }
  })
})

describe('question bank v1: wording', () => {
  const words = bank.items.flatMap((i) => [i.text, ...i.options.map((o) => o.label)])

  it('asks every item as a polite question and avoids absolute words', () => {
    for (const i of bank.items) expect([i.id, i.text.endsWith('?')]).toEqual([i.id, true])
    for (const w of words) for (const bad of ABSOLUTE_WORDS) expect([w, w.includes(bad)]).toEqual([w, false])
  })

  it('has no angle brackets or line breaks in any text', () => {
    for (const w of [...words, ...bank.raterItems.map((r) => r.text), ...bank.axes.flatMap((a) => [a.name, a.low, a.high, ...Object.values(a.summary)])]) {
      expect(/[<>\n]/.test(w)).toBe(false)
    }
  })

  it('gives every axis a name, two pole labels and three summaries', () => {
    for (const a of bank.axes) {
      expect(a.name.length).toBeGreaterThan(1)
      expect(a.low).not.toBe(a.high)
      expect(Object.values(a.summary).every((s) => s.length > 10)).toBe(true)
    }
  })
})

describe('question bank v1: observable axes and rater items', () => {
  it('has exactly the six observable axes, all on the actual layer', () => {
    expect(bank.axes.filter((a) => a.observable).map((a) => a.id).sort()).toEqual([...OBSERVABLE].sort())
    expect(bank.axes.filter((a) => a.observable).every((a) => a.layer === 'actual')).toBe(true)
  })

  it('gives each observable axis 3 observe + 1 audience rater item, and no other axis any', () => {
    for (const a of bank.axes) {
      const rs = bank.raterItems.filter((r) => r.axisId === a.id)
      if (a.observable) expect([a.id, rs.filter((r) => r.kind === 'observe').length, rs.filter((r) => r.kind === 'audience').length]).toEqual([a.id, 3, 1])
      else expect([a.id, rs.length]).toEqual([a.id, 0])
    }
    expect(bank.raterItems).toHaveLength(24)
    expect(new Set(bank.raterItems.map((r) => r.id)).size).toBe(24)
  })

  it('writes rater items as polite statements or questions', () => {
    for (const r of bank.raterItems) {
      expect([r.id, r.kind === 'observe' ? r.text.endsWith('요.') : r.text.endsWith('?')]).toEqual([r.id, true])
    }
  })
})

describe('question bank v1: end to end with the real scoring and codec', () => {
  const answerWith = (pick: (i: Item) => string): Answers =>
    Object.fromEntries(bank.items.map((i) => [i.id, { optionId: pick(i) }]))

  it('scores every axis when everything is answered, with the first option at the low end and the last at the high end', () => {
    const low = computeReport(bank, answerWith((i) => i.options[0]!.id))
    const high = computeReport(bank, answerWith((i) => i.options[i.options.length - 1]!.id))
    for (const [k, axis] of bank.axes.entries()) {
      expect(low[k]!.score).not.toBeNull()
      expect(low[k]!.score!).toBeLessThanOrEqual(20)
      expect(high[k]!.score!).toBeGreaterThanOrEqual(80)
      expect(axis.id).toBe(low[k]!.axisId)
    }
  })

  it('fits the invite link under 1,000 characters even with long ids and all axes scored', () => {
    const report = computeReport(bank, answerWith((i) => i.options[i.options.length - 1]!.id))
    const invite = makeInvite(bank, report, '가'.repeat(20), 'abcdefgh1234')
    expect(invite.axes).toHaveLength(14)
    expect(encodeInvite(invite).length).toBeLessThan(1000)
  })
})
