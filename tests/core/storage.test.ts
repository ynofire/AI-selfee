import { describe, it, expect, vi, afterEach } from 'vitest'
import { EXPIRY_MS, getStore, load, save, clearAll, expiryInfo } from '../../src/core/storage'

class MemStore implements Storage {
  private m = new Map<string, string>()
  failWrites = false
  get length() { return this.m.size }
  clear() { this.m.clear() }
  getItem(k: string) { return this.m.get(k) ?? null }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  removeItem(k: string) { this.m.delete(k) }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError')
    this.m.set(k, v)
  }
}

const KEY = 'pq:owner:v1'
const HOUR = 3_600_000

afterEach(() => vi.restoreAllMocks())

describe('save / load', () => {
  it('roundtrips a value', () => {
    const s = new MemStore()
    expect(save(s, KEY, { lastActiveAt: 1000, n: 1 })).toBe(true)
    expect(load<{ lastActiveAt: number; n: number }>(s, KEY, 1005)).toEqual({ value: { lastActiveAt: 1000, n: 1 }, expired: false })
  })

  it('treats exactly 7 days as alive and 7 days + 1ms as expired (and deletes the key)', () => {
    const s = new MemStore()
    save(s, KEY, { lastActiveAt: 0 })
    expect(load(s, KEY, EXPIRY_MS)).toEqual({ value: { lastActiveAt: 0 }, expired: false })
    expect(load(s, KEY, EXPIRY_MS + 1)).toEqual({ value: null, expired: true })
    expect(s.getItem(KEY)).toBeNull()
  })

  it('returns an empty result for a missing key', () => {
    expect(load(new MemStore(), KEY, 0)).toEqual({ value: null, expired: false })
  })

  it('deletes corrupt JSON and reports it as not expired', () => {
    const s = new MemStore()
    s.setItem(KEY, '{not json')
    expect(load(s, KEY, 0)).toEqual({ value: null, expired: false })
    expect(s.getItem(KEY)).toBeNull()
  })

  it('treats a value without lastActiveAt as corrupt', () => {
    const s = new MemStore()
    s.setItem(KEY, '{}')
    expect(load(s, KEY, 0)).toEqual({ value: null, expired: false })
    expect(s.getItem(KEY)).toBeNull()
  })

  it('works without a store', () => {
    expect(load(null, KEY, 0)).toEqual({ value: null, expired: false })
    expect(save(null, KEY, { lastActiveAt: 0 })).toBe(false)
  })

  it('returns false instead of throwing when the write fails', () => {
    const s = new MemStore()
    s.failWrites = true
    expect(save(s, KEY, { lastActiveAt: 0 })).toBe(false)
  })
})

describe('clearAll', () => {
  it('removes only pq: keys', () => {
    const s = new MemStore()
    s.setItem('pq:owner:v1', '1')
    s.setItem('pq:rater:abc', '1')
    s.setItem('other', '1')
    clearAll(s)
    expect(s.length).toBe(1)
    expect(s.getItem('other')).toBe('1')
  })
})

describe('expiryInfo', () => {
  it('reports whole hours left, rounding down', () => {
    expect(expiryInfo(0, EXPIRY_MS - 23.5 * HOUR)).toEqual({ expired: false, hoursLeft: 23 })
  })
  it('is alive at exactly 7 days and expired one ms later', () => {
    expect(expiryInfo(0, EXPIRY_MS)).toEqual({ expired: false, hoursLeft: 0 })
    expect(expiryInfo(0, EXPIRY_MS + 1)).toEqual({ expired: true, hoursLeft: 0 })
  })
})

describe('getStore', () => {
  it('returns localStorage when it works and leaves nothing behind', () => {
    const s = getStore()
    expect(s).not.toBeNull()
    expect(window.localStorage.length).toBe(0)
  })
  it('returns null when localStorage access throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(getStore()).toBeNull()
  })
})
