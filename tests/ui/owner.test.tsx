import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import fixture from '../fixtures/bank.fixture.json'
import { validateBank } from '../../src/core/bank'
import { EXPIRY_MS, OWNER_KEY } from '../../src/core/storage'
import type { OwnerState } from '../../src/core/storage'
import { formatLocalDate } from '../../src/core/exportPackage'
import type { Bank } from '../../src/core/types'
import { OwnerApp } from '../../src/ui/owner/OwnerApp'
import { SESSION_SIZE } from '../../src/ui/owner/Questionnaire'
import { MemStore } from '../helpers/memStore'

const T0 = 1_800_000_000_000
const HOUR = 3_600_000

const baseBank = (): Bank => structuredClone(validateBank(fixture))

/** 18문항을 넘기도록 결정 방식 축에 문항을 더한 은행 */
function bigBank(extra = 30): Bank {
  const b = baseBank()
  for (let i = 1; i <= extra; i++) {
    b.items.push({
      id: `x${i}`, axisId: 'f2', format: 'forced', basis: 'self', text: `추가 문항 ${i}`,
      options: [{ id: 'a', label: '가', value: 20 }, { id: 'b', label: '나', value: 80 }],
    })
  }
  return b
}

function mount(opts: { bank?: Bank; store?: Storage | null; t?: number } = {}) {
  const store = opts.store === undefined ? new MemStore() : opts.store
  const clock = { t: opts.t ?? T0 }
  const utils = render(<OwnerApp bank={opts.bank ?? baseBank()} store={store} now={() => clock.t} />)
  return { ...utils, store, clock }
}

const agree = () => {
  fireEvent.click(screen.getByTestId('consent'))
  fireEvent.click(screen.getByTestId('start'))
}

/** 지금 보이는 문항에 첫 번째 선택지로 답한다. recall은 "다음"까지 누른다. */
function answerOne() {
  const isRecall = !!screen.queryByTestId('recall-note')
  fireEvent.click(screen.getAllByTestId(/^option-/)[0]!)
  if (isRecall) fireEvent.click(screen.getByTestId('recall-next'))
}

function answerAll(max = 300) {
  for (let i = 0; i < max && screen.queryByTestId('item-text'); i++) {
    const skip = screen.queryByTestId('skip')
    if (skip) fireEvent.click(skip)
    else answerOne()
  }
}

const stored = (store: Storage | null) => JSON.parse(store!.getItem(OWNER_KEY)!) as OwnerState

const ownerState = (over: Partial<OwnerState> = {}): OwnerState => ({
  v: 1, bank: 'fixture-1', answers: { f1_1: { optionId: 'a' } }, consentAt: T0 - 2 * HOUR,
  startedAt: T0 - 2 * HOUR, lastActiveAt: T0 - HOUR, invites: {}, ...over,
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete (navigator as unknown as { clipboard?: unknown }).clipboard
})

describe('start and consent', () => {
  it('keeps start disabled until the consent box is checked, and stores nothing before consent', () => {
    const { store } = mount()
    const start = screen.getByTestId('start') as HTMLButtonElement
    expect(start.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('consent'))
    expect(start.disabled).toBe(false)
    expect((store as MemStore).length).toBe(0)
    fireEvent.click(start)
    expect(screen.getByTestId('item-text')).toBeTruthy()
    expect(stored(store).consentAt).toBe(T0)
  })
})

describe('questionnaire sessions', () => {
  it('stops after each 18 items with session-done, continues on request, and resumes after a remount', () => {
    expect(SESSION_SIZE).toBe(18)
    const bank = bigBank()
    const { store, unmount, clock } = mount({ bank })
    agree()
    for (let i = 0; i < SESSION_SIZE; i++) answerOne()
    expect(screen.getByTestId('session-done')).toBeTruthy()
    expect(screen.queryByTestId('item-text')).toBeNull()

    fireEvent.click(screen.getByTestId('continue'))
    expect(screen.queryByTestId('session-done')).toBeNull()
    expect(screen.getByTestId('progress').textContent).toContain('19')
    answerOne()
    answerOne()
    unmount()

    clock.t += HOUR
    render(<OwnerApp bank={bank} store={store} now={() => clock.t} />)
    expect(screen.queryByTestId('start')).toBeNull()
    expect(screen.getByTestId('progress').textContent).toContain('21')
    expect(Object.keys(stored(store).answers)).toHaveLength(20)
  })

  it('shows a report option at session end and lets the user come back to the questions', () => {
    mount({ bank: bigBank() })
    agree()
    for (let i = 0; i < SESSION_SIZE; i++) answerOne()
    fireEvent.click(screen.getByTestId('view-report'))
    expect(screen.getByTestId('axis-f1')).toBeTruthy()
    fireEvent.click(screen.getByTestId('back-to-questions'))
    expect(screen.getByTestId('session-done')).toBeTruthy()
  })

  it('offers skip only on sensitive items and stores "skipped"', () => {
    const bank = baseBank()
    bank.items[0]!.sensitive = true
    const { store } = mount({ bank })
    agree()
    fireEvent.click(screen.getByTestId('skip'))
    expect(stored(store).answers[bank.items[0]!.id]).toBe('skipped')
    expect(screen.queryByTestId('skip')).toBeNull()
  })

  it('also offers skip on audience items, since the user may have no such person', () => {
    const bank = baseBank()
    Object.assign(bank.items[0]!, { format: 'audience', audience: 'child' })
    const { store } = mount({ bank })
    agree()
    expect(screen.getByTestId('skip').textContent).toContain('해당')
    fireEvent.click(screen.getByTestId('skip'))
    expect(stored(store).answers[bank.items[0]!.id]).toBe('skipped')
    expect(screen.queryByTestId('skip')).toBeNull()
  })

  it('lets the user go back and change the previous answer', () => {
    const { store } = mount()
    agree()
    fireEvent.click(screen.getByTestId('option-a'))
    expect(stored(store).answers.f1_1).toEqual({ optionId: 'a' })
    fireEvent.click(screen.getByTestId('prev'))
    expect(screen.getByTestId('option-a').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('option-b'))
    expect(stored(store).answers.f1_1).toEqual({ optionId: 'b' })
  })

  it('shows the two options of different items in alternating order but scores by option, not by position', () => {
    const bank = bigBank()
    bank.items = bank.items.filter((i) => i.format === 'forced')
    const { store } = mount({ bank })
    agree()
    const firstShown: string[] = []
    for (let i = 0; i < 6; i++) {
      firstShown.push(screen.getAllByTestId(/^option-/)[0]!.getAttribute('data-testid')!)
      fireEvent.click(screen.getByTestId('option-b'))
    }
    expect(new Set(firstShown).size).toBe(2)
    expect(Object.values(stored(store).answers).every((a) => a !== 'skipped' && a.optionId === 'b')).toBe(true)
  })

  it('stores a recall note of at most 300 characters', () => {
    const bank = baseBank()
    bank.items.unshift({
      id: 'r1', axisId: 'f1', format: 'recall', basis: 'behavior', text: '최근 크게 다툰 일이 있었다면',
      options: [{ id: 'a', label: '바로 풀었다', value: 20 }, { id: 'b', label: '시간이 지나서 풀었다', value: 80 }],
    })
    const { store } = mount({ bank })
    agree()
    expect((screen.getByTestId('recall-next') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('option-b'))
    const note = screen.getByTestId('recall-note') as HTMLTextAreaElement
    expect(note.maxLength).toBe(300)
    fireEvent.change(note, { target: { value: '지난달 빨래 문제로' } })
    fireEvent.click(screen.getByTestId('recall-next'))
    expect(stored(store).answers.r1).toEqual({ optionId: 'b', note: '지난달 빨래 문제로' })
  })
})

describe('report', () => {
  it('lists every axis without type labels', () => {
    mount()
    agree()
    answerAll()
    for (const id of ['f1', 'f2', 'f3']) expect(screen.getByTestId(`axis-${id}`)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/\b[EI][SN][TF][JP]\b/)
    expect(screen.queryByTestId('axis-f1-insufficient')).toBeNull()
  })

  it('marks an axis with too little evidence as insufficient instead of scoring it', () => {
    const bank = baseBank()
    for (const i of bank.items.filter((x) => x.axisId === 'f1')) i.sensitive = true
    mount({ bank })
    agree()
    answerAll()
    expect(screen.getByTestId('axis-f1-insufficient')).toBeTruthy()
    expect(screen.queryByTestId('axis-f2-insufficient')).toBeNull()
  })
})

describe('export', () => {
  const toExport = () => {
    mount()
    agree()
    answerAll()
    fireEvent.click(screen.getByTestId('to-export'))
  }

  it('copies the filled-in package and explains where to paste it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    toExport()
    expect(screen.getByTestId('ai-notice')).toBeTruthy()
    fireEvent.click(screen.getByTestId('copy-export'))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const text = writeText.mock.calls[0]![0] as string
    expect(text).toContain('# 지시')
    expect(text).not.toContain('{{')
    expect(await screen.findByTestId('copy-done')).toBeTruthy()
  })

  it('tells the user to select the text by hand when copying fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    toExport()
    fireEvent.click(screen.getByTestId('copy-export'))
    expect(await screen.findByTestId('copy-failed')).toBeTruthy()
    expect((screen.getByTestId('export-text') as HTMLTextAreaElement).value).toContain('# 지시')
  })

  it('downloads persona-export-YYYYMMDD.md', () => {
    const create = vi.fn(() => 'blob:x')
    Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download) })
    toExport()
    fireEvent.click(screen.getByTestId('download-export'))
    expect(create).toHaveBeenCalledTimes(1)
    expect(names).toEqual([`persona-export-${formatLocalDate(new Date(T0), '')}.md`])
  })
})

describe('invite', () => {
  const toInvite = (bank?: Bank) => {
    const m = mount({ bank })
    agree()
    answerAll()
    fireEvent.click(screen.getByTestId('to-invite'))
    return m
  }
  const setLabel = (v: string) => fireEvent.change(screen.getByTestId('invite-label'), { target: { value: v } })
  const url = () => (screen.getByTestId('invite-url') as HTMLInputElement).value

  it('shows no link for an empty, 21-character or angle-bracket label', () => {
    toInvite()
    expect(screen.queryByTestId('invite-url')).toBeNull()
    setLabel('가'.repeat(21))
    expect(screen.queryByTestId('invite-url')).toBeNull()
    setLabel('<b>민준</b>')
    expect(screen.queryByTestId('invite-url')).toBeNull()
  })

  it('builds a /r# link under 1,000 characters with the sharing notice, and remembers the nonce', () => {
    const { store } = toInvite()
    setLabel('민준')
    const u = new URL(url())
    expect(u.pathname).toBe('/r')
    expect(u.hash.length).toBeGreaterThan(1)
    expect(u.hash.length - 1).toBeLessThan(1000)
    expect(screen.getByTestId('invite-warning')).toBeTruthy()
    const invites = Object.values(stored(store).invites)
    expect(invites).toHaveLength(1)
    expect(invites[0]!.label).toBe('민준')
  })

  it('keeps the same nonce while the label is edited', () => {
    const { store } = toInvite()
    setLabel('민')
    setLabel('민준')
    expect(Object.keys(stored(store).invites)).toHaveLength(1)
  })

  it('says so instead of making a link when no axis has a score', () => {
    const bank = baseBank()
    for (const i of bank.items) i.sensitive = true
    toInvite(bank)
    setLabel('민준')
    expect(screen.queryByTestId('invite-url')).toBeNull()
    expect(screen.getByTestId('invite-empty')).toBeTruthy()
  })
})

describe('storage problems and expiry', () => {
  it('works from memory with a banner when storage is unavailable', () => {
    mount({ store: null })
    expect(screen.getByTestId('banner-nostore')).toBeTruthy()
    agree()
    answerOne()
    expect(screen.getByTestId('progress').textContent).toContain('2')
    expect(screen.getByTestId('banner-nostore')).toBeTruthy()
  })

  it('shows the same banner when a write fails', () => {
    const store = new MemStore()
    store.failWrites = true
    mount({ store })
    expect(screen.queryByTestId('banner-nostore')).toBeNull()
    agree()
    expect(screen.getByTestId('banner-nostore')).toBeTruthy()
    answerOne()
    expect(screen.getByTestId('progress').textContent).toContain('2')
  })

  it('treats exactly 7 days as alive and 7 days + 1ms as expired', () => {
    const alive = new MemStore()
    alive.setItem(OWNER_KEY, JSON.stringify(ownerState({ lastActiveAt: T0 - EXPIRY_MS })))
    mount({ store: alive })
    expect(screen.queryByTestId('banner-expired')).toBeNull()
    expect(screen.getByTestId('banner-expiring')).toBeTruthy()
    expect(screen.queryByTestId('start')).toBeNull()
    cleanup()

    const dead = new MemStore()
    dead.setItem(OWNER_KEY, JSON.stringify(ownerState({ lastActiveAt: T0 - EXPIRY_MS - 1 })))
    mount({ store: dead })
    expect(screen.getByTestId('banner-expired')).toBeTruthy()
    expect(screen.getByTestId('start')).toBeTruthy()
    expect(dead.getItem(OWNER_KEY)).toBeNull()
  })

  it('warns when less than a day is left, and not otherwise', () => {
    const soon = new MemStore()
    soon.setItem(OWNER_KEY, JSON.stringify(ownerState({ lastActiveAt: T0 - EXPIRY_MS + 23 * HOUR })))
    mount({ store: soon })
    expect(screen.getByTestId('banner-expiring')).toBeTruthy()
    cleanup()

    const fine = new MemStore()
    fine.setItem(OWNER_KEY, JSON.stringify(ownerState()))
    mount({ store: fine })
    expect(screen.queryByTestId('banner-expiring')).toBeNull()
    expect(screen.queryByTestId('banner-expired')).toBeNull()
  })

  it('starts over with a notice when the saved answers belong to another question bank', () => {
    const store = new MemStore()
    store.setItem(OWNER_KEY, JSON.stringify(ownerState({ bank: 'older-bank' })))
    mount({ store })
    expect(screen.getByTestId('banner-bankchanged')).toBeTruthy()
    expect(screen.getByTestId('start')).toBeTruthy()
    expect(store.getItem(OWNER_KEY)).toBeNull()
  })
})

describe('wipe', () => {
  it('asks once more, then removes every pq: key and returns to the start screen', () => {
    const { store } = mount()
    agree()
    answerOne()
    store!.setItem('pq:rater:abc', '{}')
    store!.setItem('other-site-key', 'keep')

    fireEvent.click(screen.getByTestId('wipe'))
    expect(store!.getItem(OWNER_KEY)).not.toBeNull()
    fireEvent.click(screen.getByTestId('wipe-confirm'))

    expect(store!.getItem(OWNER_KEY)).toBeNull()
    expect(store!.getItem('pq:rater:abc')).toBeNull()
    expect(store!.getItem('other-site-key')).toBe('keep')
    expect((screen.getByTestId('start') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('consent') as HTMLInputElement).checked).toBe(false)
  })
})
