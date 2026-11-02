import { describe, it, expect } from 'vitest'
import bankJson from '../../src/data/bank.v1.json'
import { validateBank } from '../../src/core/bank'
import { displayOptions, optionFlips } from '../../src/ui/optionOrder'

const bank = validateBank(bankJson)
const flips = optionFlips(bank)
const twoWay = bank.items.filter((i) => i.format !== 'frequency')
const highFirst = (i: (typeof bank.items)[number]) => displayOptions(i, flips)[0]!.value > displayOptions(i, flips)[1]!.value

describe('optionFlips / displayOptions', () => {
  it('is deterministic: the same bank always gives the same order', () => {
    expect([...optionFlips(bank)].sort()).toEqual([...flips].sort())
  })

  it('never reorders a frequency scale', () => {
    for (const i of bank.items.filter((x) => x.format === 'frequency')) {
      expect(flips.has(i.id)).toBe(false)
      expect(displayOptions(i, flips).map((o) => o.value)).toEqual([0, 33, 67, 100])
    }
  })

  it('keeps every option and does not touch the stored order', () => {
    for (const i of bank.items) {
      const before = i.options.map((o) => o.id)
      expect([...displayOptions(i, flips)].map((o) => o.id).sort()).toEqual([...before].sort())
      expect(i.options.map((o) => o.id)).toEqual(before)
    }
  })

  it('splits every axis evenly (within one item) between "high pole first" and "low pole first"', () => {
    for (const axis of bank.axes) {
      const items = twoWay.filter((i) => i.axisId === axis.id)
      const hi = items.filter(highFirst).length
      expect([axis.id, Math.abs(hi - (items.length - hi)) <= 1]).toEqual([axis.id, true])
    }
  })

  it('is balanced overall, so always picking the first option does not tilt the whole report', () => {
    const share = twoWay.filter(highFirst).length / twoWay.length
    expect(share).toBeGreaterThanOrEqual(0.4)
    expect(share).toBeLessThanOrEqual(0.6)
  })
})
