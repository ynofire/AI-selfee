import { useCallback, useRef, useState } from 'react'
import type { Answer, Bank } from '../../core/types'
import { OWNER_KEY, clearAll, load, save } from '../../core/storage'
import type { OwnerState } from '../../core/storage'

/** 시작 화면에 알려야 하는 사정. */
export type StartNotice = 'expired' | 'bank' | null

const fresh = (bank: Bank, t: number): OwnerState => ({
  v: 1, bank: bank.version, answers: {}, consentAt: null, startedAt: t, lastActiveAt: t, invites: {},
})

function isOwnerState(v: unknown): v is OwnerState {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    o.v === 1 &&
    typeof o.bank === 'string' &&
    typeof o.lastActiveAt === 'number' &&
    typeof o.startedAt === 'number' &&
    (o.consentAt === null || typeof o.consentAt === 'number') &&
    typeof o.answers === 'object' && o.answers !== null &&
    typeof o.invites === 'object' && o.invites !== null
  )
}

function dropSaved(store: Storage | null): void {
  try {
    store?.removeItem(OWNER_KEY)
  } catch {
    /* 지울 수 없어도 흐름을 막지 않는다 */
  }
}

function boot(bank: Bank, store: Storage | null, t: number): { state: OwnerState; notice: StartNotice } {
  const { value, expired } = load<OwnerState>(store, OWNER_KEY, t)
  if (expired) return { state: fresh(bank, t), notice: 'expired' }
  if (value === null) return { state: fresh(bank, t), notice: null }
  if (!isOwnerState(value)) {
    dropSaved(store)
    return { state: fresh(bank, t), notice: null }
  }
  if (value.bank !== bank.version) {
    dropSaved(store)
    return { state: fresh(bank, t), notice: 'bank' }
  }
  return { state: value, notice: null }
}

/**
 * 보낸 사람의 상태. 동의하기 전에는 저장소에 아무것도 쓰지 않고,
 * 저장소를 못 쓰거나 쓰기가 실패해도 메모리에서 계속 동작한다.
 */
export function useOwnerState(bank: Bank, store: Storage | null, now: () => number) {
  const [initial] = useState(() => boot(bank, store, now()))
  const [state, setState] = useState<OwnerState>(initial.state)
  const [notice, setNotice] = useState<StartNotice>(initial.notice)
  const [writeFailed, setWriteFailed] = useState(false)
  const latest = useRef(state)

  const commit = useCallback(
    (mutate: (s: OwnerState) => OwnerState) => {
      const next: OwnerState = { ...mutate(latest.current), lastActiveAt: now() }
      latest.current = next
      setState(next)
      if (next.consentAt !== null && store && !save(store, OWNER_KEY, next)) setWriteFailed(true)
    },
    [store, now],
  )

  const grantConsent = useCallback(() => {
    const t = now()
    setNotice(null)
    commit((s) => ({ ...s, consentAt: t, startedAt: t }))
  }, [commit, now])

  const setAnswer = useCallback(
    (itemId: string, a: Answer | 'skipped') => commit((s) => ({ ...s, answers: { ...s.answers, [itemId]: a } })),
    [commit],
  )

  const rememberInvite = useCallback(
    (nonce: string, label: string) =>
      commit((s) => ({
        ...s,
        invites: { ...s.invites, [nonce]: { label, createdAt: s.invites[nonce]?.createdAt ?? now() } },
      })),
    [commit, now],
  )

  const wipe = useCallback(() => {
    clearAll(store)
    const f = fresh(bank, now())
    latest.current = f
    setState(f)
    setNotice(null)
    setWriteFailed(false)
  }, [bank, store, now])

  return {
    state,
    notice,
    storageOk: store !== null && !writeFailed,
    grantConsent,
    setAnswer,
    rememberInvite,
    wipe,
  }
}
