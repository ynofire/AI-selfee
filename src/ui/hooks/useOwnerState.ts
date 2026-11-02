import { useCallback, useRef } from 'react'
import type { Answer, Bank } from '../../core/types'
import { OWNER_KEY, clearAll, isOwnerState } from '../../core/storage'
import type { OwnerState } from '../../core/storage'
import { usePersisted } from './usePersisted'

export type { PersistNotice } from './usePersisted'

const fresh = (bank: Bank, t: number): OwnerState => ({
  v: 1, bank: bank.version, answers: {}, consentAt: null, startedAt: t, lastActiveAt: t, invites: {},
})

/** 보낸 사람의 상태. 동의하기 전에는 저장소에 아무것도 쓰지 않는다. */
export function useOwnerState(bank: Bank, store: Storage | null, now: () => number) {
  const nowRef = useRef(now)
  nowRef.current = now
  const p = usePersisted<OwnerState>({
    key: OWNER_KEY,
    store,
    now,
    fresh: (t) => fresh(bank, t),
    check: (v) => (!isOwnerState(v) ? 'broken' : v.bank !== bank.version ? 'incompatible' : 'ok'),
    persistable: (s) => s.consentAt !== null,
  })
  const { commit, reset, dismissNotice } = p

  const grantConsent = useCallback(() => {
    const t = nowRef.current()
    dismissNotice()
    commit((s) => ({ ...s, consentAt: t, startedAt: t }))
  }, [commit, dismissNotice])

  const setAnswer = useCallback(
    (itemId: string, a: Answer | 'skipped') => commit((s) => ({ ...s, answers: { ...s.answers, [itemId]: a } })),
    [commit],
  )

  const rememberInvite = useCallback(
    (nonce: string, label: string) =>
      commit((s) => ({
        ...s,
        invites: { ...s.invites, [nonce]: { label, createdAt: s.invites[nonce]?.createdAt ?? nowRef.current() } },
      })),
    [commit],
  )

  /** 이 앱이 이 기기에 남긴 pq: 키를 모두 지운다(받는 사람으로서 남긴 것 포함). */
  const wipe = useCallback(() => {
    clearAll(store)
    reset()
  }, [store, reset])

  return {
    state: p.state,
    notice: p.notice,
    storageOk: p.storageOk,
    grantConsent,
    setAnswer,
    rememberInvite,
    wipe,
  }
}
