import { describe, it, expect } from 'vitest'
import fixture from '../fixtures/bank.fixture.json'
import { validateBank } from '../../src/core/bank'
import type { Report } from '../../src/core/scoring'
import {
  PayloadError, encodeInvite, decodeInvite, encodeReply, decodeReply,
  makeInvite, newNonce, inviteUrl, replyUrl,
  type InvitePayload, type ReplyPayload,
} from '../../src/core/codec'

const NONCE = 'abcdefgh1234'
const invite: InvitePayload = { v: 1, bank: 'v1', nonce: NONCE, label: '민준💛', axes: [['a01', 65, 60], ['a02', 40, null]] }
const reply: ReplyPayload = { v: 1, bank: 'v1', nonce: NONCE, label: '와이프', axes: [['a01', 4, 'a'], ['a02', null, null]] }

/** 검증을 거치지 않고 임의 객체를 payload로 만든다 */
const raw = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const codeOf = (fn: () => unknown): string => {
  try { fn() } catch (e) { return e instanceof PayloadError ? e.code : `other:${String(e)}` }
  return 'no-throw'
}

describe('payload roundtrip', () => {
  it('roundtrips an invite with a Korean and emoji label', () => {
    expect(decodeInvite(encodeInvite(invite))).toEqual(invite)
  })
  it('roundtrips a reply', () => {
    expect(decodeReply(encodeReply(reply))).toEqual(reply)
  })
  it('encodes an invite for 14 axes under 600 chars', () => {
    const axes = Array.from({ length: 14 }, (_, i) => [`a${String(i + 1).padStart(2, '0')}`, 65, 60] as [string, number, number])
    expect(encodeInvite({ ...invite, axes }).length).toBeLessThan(600)
  })
})

describe('decode rejects bad input', () => {
  it('rejects non-base64url text as malformed', () => {
    expect(codeOf(() => decodeInvite('not-base64!!'))).toBe('malformed')
  })
  it('rejects a truncated payload with a PayloadError', () => {
    expect(codeOf(() => decodeInvite(encodeInvite(invite).slice(0, -5)))).toMatch(/^(malformed|invalid)$/)
  })
  it('rejects version 2', () => {
    expect(codeOf(() => decodeInvite(raw({ ...invite, v: 2 })))).toBe('version')
  })
  it('rejects a score above 100', () => {
    expect(codeOf(() => decodeInvite(raw({ ...invite, axes: [['a01', 101, null]] })))).toBe('invalid')
  })
  it('rejects a label that contains HTML', () => {
    expect(codeOf(() => decodeInvite(raw({ ...invite, label: '<img src=x onerror=alert(1)>' })))).toBe('invalid')
  })
  it('rejects an empty or 21-character label', () => {
    expect(codeOf(() => decodeInvite(raw({ ...invite, label: '   ' })))).toBe('invalid')
    expect(codeOf(() => decodeInvite(raw({ ...invite, label: 'ㄱ'.repeat(21) })))).toBe('invalid')
  })
  it('rejects an invalid nonce', () => {
    expect(codeOf(() => decodeInvite(raw({ ...invite, nonce: 'short' })))).toBe('invalid')
  })
  it('rejects input of 1,001 chars as too_long', () => {
    expect(codeOf(() => decodeInvite('A'.repeat(1001)))).toBe('too_long')
  })
  it('rejects a reply with observe 6 or an unknown spreadCheck', () => {
    expect(codeOf(() => decodeReply(raw({ ...reply, axes: [['a01', 6, null]] })))).toBe('invalid')
    expect(codeOf(() => decodeReply(raw({ ...reply, axes: [['a01', 3, 'x']] })))).toBe('invalid')
  })
  it('strips control characters and trims the label', () => {
    expect(decodeInvite(raw({ ...invite, label: ' 민\u0007준 ' })).label).toBe('민준')
  })
  it('refuses to encode an invalid payload', () => {
    expect(codeOf(() => encodeInvite({ ...invite, label: '' }))).toBe('invalid')
  })
})

describe('invite construction', () => {
  const bank = validateBank(fixture)
  const report: Report = [
    { axisId: 'f1', score: 65, spread: 60, coverage: 1, grade: 'behavior', evidence: [] },
    { axisId: 'f2', score: null, spread: null, coverage: 0, grade: 'self', evidence: [] },
    { axisId: 'f3', score: 50, spread: null, coverage: 1, grade: 'self', evidence: [] },
  ]

  it('makeInvite excludes desired-layer and null-score axes', () => {
    expect(makeInvite(bank, report, '민준', NONCE)).toEqual({
      v: 1, bank: 'fixture-1', nonce: NONCE, label: '민준', axes: [['f1', 65, 60]],
    })
  })
  it('inviteUrl and replyUrl carry the payload after the hash', () => {
    const iu = inviteUrl('https://example.test', invite)
    expect(iu.startsWith('https://example.test/r#')).toBe(true)
    expect(decodeInvite(iu.split('#')[1]!)).toEqual(invite)
    expect(replyUrl('https://example.test', reply).startsWith('https://example.test/b#')).toBe(true)
  })
  it('newNonce matches the nonce pattern and differs between calls', () => {
    const a = newNonce()
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,32}$/)
    expect(a).not.toBe(newNonce())
  })
})
