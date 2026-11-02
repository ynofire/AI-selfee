import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import fixture from '../fixtures/bank.fixture.json'
import { validateBank } from '../../src/core/bank'
import { computeReport } from '../../src/core/scoring'
import { buildReply, MAX_RATER_ITEMS } from '../../src/core/rater'
import { decodeReply, encodeInvite, encodeReply, makeInvite } from '../../src/core/codec'
import type { InvitePayload, ReplyPayload } from '../../src/core/codec'
import { EXPIRY_MS, OWNER_KEY, raterKey } from '../../src/core/storage'
import type { OwnerState, RaterState } from '../../src/core/storage'
import type { Answers, Bank } from '../../src/core/types'
import { RaterApp } from '../../src/ui/rater/RaterApp'
import { ReplyScreen } from '../../src/ui/owner/ReplyScreen'
import { MemStore } from '../helpers/memStore'

const T0 = 1_800_000_000_000
const HOUR = 3_600_000
const NONCE = 'abcdefgh1234'
const bank: Bank = validateBank(fixture)

const ownerAnswers: Answers = {
  f1_1: { optionId: 'b' }, f1_2: { optionId: 'a' }, f1_3: { optionId: 'n1' }, f1_4: { optionId: 'a' }, f1_5: { optionId: 'a' },
  f2_1: { optionId: 'b' }, f2_2: { optionId: 'b' }, f2_3: { optionId: 'b' },
}
const ownerReport = computeReport(bank, ownerAnswers)
const invite: InvitePayload = makeInvite(bank, ownerReport, '민준', NONCE)
const inviteHash = `#${encodeInvite(invite)}`

const ownerState = (over: Partial<OwnerState> = {}): OwnerState => ({
  v: 1, bank: bank.version, answers: ownerAnswers, consentAt: T0 - 5 * HOUR, startedAt: T0 - 5 * HOUR,
  lastActiveAt: T0 - HOUR, invites: { [NONCE]: { label: '민준', createdAt: T0 - 2 * HOUR } }, ...over,
})

const replyFor = (over: Partial<ReplyPayload> = {}): ReplyPayload => ({
  ...buildReply(bank, invite, { f1_r1: 5, f1_r2: 4, f1_r3: 3, f1_ra: 'a' }, '와이프'), ...over,
})

function mountRater(opts: { hash?: string; store?: Storage | null; t?: number; bank?: Bank } = {}) {
  const store = opts.store === undefined ? new MemStore() : opts.store
  const clock = { t: opts.t ?? T0 }
  const utils = render(<RaterApp hash={opts.hash ?? inviteHash} bank={opts.bank ?? bank} store={store} now={() => clock.t} />)
  return { ...utils, store, clock }
}

function mountReply(opts: { hash: string; store?: Storage | null; t?: number }) {
  const store = opts.store === undefined ? new MemStore() : opts.store
  const utils = render(<ReplyScreen hash={opts.hash} bank={bank} store={store} now={() => opts.t ?? T0} />)
  return { ...utils, store }
}

const agree = () => {
  fireEvent.click(screen.getByTestId('consent'))
  fireEvent.click(screen.getByTestId('start'))
}
const begin = () => fireEvent.click(screen.getByTestId('begin'))
const rate = (n: number) => fireEvent.click(screen.getByTestId(`rate-${n}`))
const choose = (c: 'a' | 'd' | 'u') => fireEvent.click(screen.getByTestId(`choice-${c}`))
/** 픽스처 문항: 관찰 3개 → 상대별 차이 확인 1개 */
const answerFixtureForm = () => { rate(5); rate(4); rate(3); choose('a') }
const setLabel = (v: string) => fireEvent.change(screen.getByTestId('rater-label'), { target: { value: v } })
const replyUrlValue = () => (screen.getByTestId('reply-url') as HTMLInputElement).value
const raterStored = (store: Storage | null) => JSON.parse(store!.getItem(raterKey(NONCE))!) as RaterState

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete (navigator as unknown as { clipboard?: unknown }).clipboard
})

describe('rater: bad or unusable links (Review Focus 1, 5)', () => {
  const b64 = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const cases: [string, string][] = [
    ['empty hash', ''],
    ['bare #', '#'],
    ['garbage characters', '#%%%@@@'],
    ['truncated link', inviteHash.slice(0, 40)],
    ['valid base64 but not JSON', `#${b64('hello')}`],
    ['JSON of the wrong shape', `#${b64('{"a":1}')}`],
    ['link with trailing junk', `${inviteHash}%20%20)`],
  ]
  for (const [name, hash] of cases) {
    it(`shows the error screen instead of throwing: ${name}`, () => {
      mountRater({ hash })
      expect(screen.getByTestId('error-screen').textContent).toContain('링크가 올바르지 않아요')
      expect(screen.queryByTestId('consent')).toBeNull()
    })
  }

  it('refuses an invite made for another question-bank version', () => {
    mountRater({ hash: `#${encodeInvite({ ...invite, bank: 'older-bank' })}` })
    expect(screen.getByTestId('error-screen').textContent).toContain('질문지')
  })
})

describe('rater: disclosure and consent', () => {
  it('shows all five disclosures, names the sender, and hides the questions until consent', () => {
    const { store } = mountRater()
    for (const id of ['sender', 'collected', 'returned', 'skip', 'local']) expect(screen.getByTestId(`disclosure-${id}`)).toBeTruthy()
    expect(screen.getByTestId('disclosure-sender').textContent).toContain('민준')
    expect(screen.getByTestId('disclosure-returned').textContent).toContain('축별 요약')
    expect(screen.queryByTestId('item-text')).toBeNull()
    expect((screen.getByTestId('start') as HTMLButtonElement).disabled).toBe(true)
    expect((store as MemStore).length).toBe(0)
    expect(document.querySelectorAll('input[type=email]')).toHaveLength(0)
  })

  it("shows the sender's axis summaries after consent and before the questions", () => {
    mountRater()
    agree()
    expect(screen.getByTestId('summary-f1')).toBeTruthy()
    expect(screen.getByTestId('summary-f2')).toBeTruthy()
    expect(screen.queryByTestId('item-text')).toBeNull()
    begin()
    expect(screen.getByTestId('item-text')).toBeTruthy()
  })
})

describe('rater: questions', () => {
  it('asks at most 20 questions', () => {
    const syn: Bank = {
      version: 'syn',
      axes: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i + 1}`, name: `s${i + 1}`, layer: 'actual' as const, observable: true, low: 'l', high: 'h', summary: { low: 'l', mid: 'm', high: 'h' },
      })),
      items: [],
      raterItems: Array.from({ length: 6 }, (_, i) => [
        ...[1, 2, 3].map((k) => ({ id: `s${i + 1}_r${k}`, axisId: `s${i + 1}`, kind: 'observe' as const, text: 't' })),
        { id: `s${i + 1}_ra`, axisId: `s${i + 1}`, kind: 'audience' as const, text: 't' },
      ]).flat(),
    }
    const inv: InvitePayload = { v: 1, bank: 'syn', nonce: NONCE, label: '민준', axes: syn.axes.map((a) => [a.id, 50, 10]) }
    mountRater({ hash: `#${encodeInvite(inv)}`, bank: syn })
    agree()
    begin()
    expect(MAX_RATER_ITEMS).toBe(20)
    expect(screen.getByTestId('progress').textContent).toContain('/ 20')
  })

  it('lets every question be skipped and goes back to change an answer', () => {
    const { store } = mountRater()
    agree()
    begin()
    rate(5)
    fireEvent.click(screen.getByTestId('prev'))
    rate(2)
    expect(raterStored(store).answers.f1_r1).toBe(2)
    fireEvent.click(screen.getByTestId('skip'))
    expect(raterStored(store).answers.f1_r2).toBeUndefined()
    expect(screen.getByTestId('progress').textContent).toContain('3 /')
  })

  it('resumes from the saved state after a remount, without bringing skipped questions back', () => {
    const { store, unmount, clock } = mountRater()
    agree()
    begin()
    rate(5)
    fireEvent.click(screen.getByTestId('skip'))
    unmount()

    clock.t += HOUR
    render(<RaterApp hash={inviteHash} bank={bank} store={store} now={() => clock.t} />)
    expect(screen.queryByTestId('consent')).toBeNull()
    expect(screen.getByTestId('progress').textContent).toContain('3 /')
    expect(Object.keys(raterStored(store).answers)).toEqual(['f1_r1'])
  })

  it('ignores a corrupted saved state and starts over', () => {
    const store = new MemStore()
    store.setItem(raterKey(NONCE), JSON.stringify({ lastActiveAt: T0, answers: 'nope' }))
    mountRater({ store })
    expect(screen.getByTestId('consent')).toBeTruthy()
  })
})

describe('rater: reply link', () => {
  const finish = () => {
    agree()
    begin()
    answerFixtureForm()
  }

  it('builds a /b# link with axis-level aggregates only, once a name is entered', () => {
    mountRater()
    finish()
    expect(screen.queryByTestId('reply-url')).toBeNull()
    setLabel('와이프')
    const url = new URL(replyUrlValue())
    expect(url.pathname).toBe('/b')
    expect(url.hash.length - 1).toBeLessThan(1000)
    const reply = decodeReply(url.hash.slice(1))
    expect(reply).toMatchObject({ nonce: NONCE, label: '와이프', axes: [['f1', 4, 'a']] })
    expect(JSON.stringify(reply)).not.toContain('_r')
  })

  it('rejects an empty, 21-character or angle-bracket name', () => {
    mountRater()
    finish()
    for (const bad of ['', '가'.repeat(21), '<i>와이프</i>']) {
      setLabel(bad)
      expect(screen.queryByTestId('reply-url')).toBeNull()
    }
  })

  it('says there is nothing to send when every question was skipped', () => {
    mountRater()
    agree()
    begin()
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByTestId('skip'))
    expect(screen.getByTestId('reply-empty')).toBeTruthy()
    expect(screen.queryByTestId('reply-url')).toBeNull()
  })

  it('wipe removes only this invite\'s saved answers and returns to the first screen', () => {
    const { store } = mountRater()
    finish()
    store!.setItem(OWNER_KEY, JSON.stringify(ownerState()))
    store!.setItem('pq:rater:another', '{}')
    fireEvent.click(screen.getByTestId('wipe'))
    fireEvent.click(screen.getByTestId('wipe-confirm'))
    expect(store!.getItem(raterKey(NONCE))).toBeNull()
    expect(store!.getItem(OWNER_KEY)).not.toBeNull()
    expect(store!.getItem('pq:rater:another')).toBe('{}')
    expect((screen.getByTestId('consent') as HTMLInputElement).checked).toBe(false)
  })
})

describe('rater: storage problems and expiry', () => {
  it('shows the no-storage banner and keeps working from memory', () => {
    mountRater({ store: null })
    expect(screen.getByTestId('banner-nostore')).toBeTruthy()
    agree()
    begin()
    rate(5)
    expect(screen.getByTestId('progress').textContent).toContain('2 /')
  })

  it('drops answers older than 7 days with a notice, but keeps them at exactly 7 days', () => {
    const state: RaterState = { v: 1, nonce: NONCE, answers: { f1_r1: 5 }, skipped: [], consentAt: T0 - EXPIRY_MS, lastActiveAt: T0 - EXPIRY_MS }
    const alive = new MemStore()
    alive.setItem(raterKey(NONCE), JSON.stringify(state))
    mountRater({ store: alive })
    expect(screen.queryByTestId('banner-expired')).toBeNull()
    expect(screen.getByTestId('banner-expiring')).toBeTruthy()
    cleanup()

    const dead = new MemStore()
    dead.setItem(raterKey(NONCE), JSON.stringify({ ...state, lastActiveAt: T0 - EXPIRY_MS - 1 }))
    mountRater({ store: dead })
    expect(screen.getByTestId('banner-expired')).toBeTruthy()
    expect(screen.getByTestId('consent')).toBeTruthy()
    expect(dead.getItem(raterKey(NONCE))).toBeNull()
  })
})

describe('reply viewer (/b#)', () => {
  const hashOf = (r: ReplyPayload) => `#${encodeReply(r)}`
  const withOwner = (state: OwnerState = ownerState()) => {
    const s = new MemStore()
    s.setItem(OWNER_KEY, JSON.stringify(state))
    return s
  }

  it('shows the v2 comparison for a reply to one of my invites', () => {
    mountReply({ hash: hashOf(replyFor()), store: withOwner() })
    const row = screen.getByTestId('v2-axis-f1')
    const mine = ownerReport.find((r) => r.axisId === 'f1')!.score!
    expect(row.textContent).toContain(`${mine}`)
    expect(row.textContent).toContain('75')
    expect(row.textContent).toContain('와이프')
    expect(screen.queryByTestId('v2-axis-f2')).toBeNull()
  })

  it('does not write anything while viewing', () => {
    const store = withOwner()
    const before = store.getItem(OWNER_KEY)
    mountReply({ hash: hashOf(replyFor()), store })
    expect(store.getItem(OWNER_KEY)).toBe(before)
    expect(store.length).toBe(1)
  })

  it('says it is a reply to another invite when the nonce is unknown', () => {
    mountReply({ hash: hashOf(replyFor({ nonce: 'zzzzzzzz9999' })), store: withOwner() })
    expect(screen.getByTestId('reply-other-invite').textContent).toContain('다른 초대의 답장')
    expect(screen.queryByTestId('v2-axis-f1')).toBeNull()
  })

  it('asks to open it on the original device when there is no sender state here', () => {
    mountReply({ hash: hashOf(replyFor()), store: new MemStore() })
    expect(screen.getByTestId('reply-no-owner').textContent).toContain('원래')
  })

  it('also explains the 7-day limit when the sender state has expired', () => {
    mountReply({ hash: hashOf(replyFor()), store: withOwner(ownerState({ lastActiveAt: T0 - EXPIRY_MS - 1 })) })
    expect(screen.getByTestId('reply-no-owner').textContent).toContain('7일')
  })

  it('works without storage by asking to use the original browser', () => {
    mountReply({ hash: hashOf(replyFor()), store: null })
    expect(screen.getByTestId('reply-no-owner')).toBeTruthy()
  })

  it('shows the error screen for a broken reply link or another bank version', () => {
    mountReply({ hash: hashOf(replyFor()).slice(0, 30), store: withOwner() })
    expect(screen.getByTestId('error-screen').textContent).toContain('링크가 올바르지 않아요')
    cleanup()
    mountReply({ hash: hashOf(replyFor({ bank: 'older-bank' })), store: withOwner() })
    expect(screen.getByTestId('error-screen').textContent).toContain('질문지')
  })

  it('offers the v2 export with the [other:호칭] lines', () => {
    mountReply({ hash: hashOf(replyFor()), store: withOwner() })
    fireEvent.click(screen.getByTestId('to-export-v2'))
    const text = (screen.getByTestId('export-text') as HTMLTextAreaElement).value
    expect(text).toContain('[other:와이프] 표현 필터')
    expect(text).toMatch(/타인 평가 75\/100 \(차이 \d+\)/)
    expect(text).not.toContain('{{')
  })
})
