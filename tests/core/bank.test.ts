import { describe, it, expect } from 'vitest'
import fixture from '../fixtures/bank.fixture.json'
import { validateBank, BankError } from '../../src/core/bank'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clone = (): any => structuredClone(fixture)

describe('validateBank', () => {
  it('accepts the fixture', () => {
    const bank = validateBank(fixture)
    expect(bank.axes).toHaveLength(3)
    expect(bank.items).toHaveLength(11)
    expect(bank.raterItems).toHaveLength(4)
  })

  it('rejects an option value above 100', () => {
    const b = clone()
    b.items[0].options[1].value = 101
    expect(() => validateBank(b)).toThrow(BankError)
  })

  it('rejects an option value below 0', () => {
    const b = clone()
    b.items[0].options[0].value = -1
    expect(() => validateBank(b)).toThrow(BankError)
  })

  it('rejects duplicate item ids', () => {
    const b = clone()
    b.items[1].id = b.items[0].id
    expect(() => validateBank(b)).toThrow(BankError)
  })

  it('rejects an item with an unknown axisId', () => {
    const b = clone()
    b.items[0].axisId = 'nope'
    expect(() => validateBank(b)).toThrow(BankError)
  })

  it('rejects an audience item without an audience', () => {
    const b = clone()
    delete b.items[3].audience
    expect(() => validateBank(b)).toThrow(BankError)
  })

  it('rejects an item with fewer than 2 options', () => {
    const b = clone()
    b.items[0].options = [b.items[0].options[0]]
    expect(() => validateBank(b)).toThrow(BankError)
  })

  it('rejects a rater item for a non-observable axis', () => {
    const b = clone()
    b.raterItems[0].axisId = 'f2'
    expect(() => validateBank(b)).toThrow(BankError)
  })

  it('rejects an observable axis in the desired layer', () => {
    const b = clone()
    b.axes[2].observable = true
    expect(() => validateBank(b)).toThrow(BankError)
  })
})
