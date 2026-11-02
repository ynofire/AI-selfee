import { useCallback, useRef } from 'react'
import type { RaterAnswers } from '../../core/types'
import { isRaterState, raterKey, removeKey } from '../../core/storage'
import type { RaterState } from '../../core/storage'
import { usePersisted } from './usePersisted'

type Rating = RaterAnswers[string]

/** 받는 사람의 상태. 초대마다(nonce) 따로 저장하고, 지울 때도 그 키만 지운다. */
export function useRaterState(nonce: string, store: Storage | null, now: () => number) {
  const nowRef = useRef(now)
  nowRef.current = now
  const key = raterKey(nonce)
  const p = usePersisted<RaterState>({
    key,
    store,
    now,
    fresh: (t) => ({ v: 1, nonce, answers: {}, skipped: [], consentAt: null, lastActiveAt: t }),
    check: (v) => (isRaterState(v) && v.nonce === nonce ? 'ok' : 'broken'),
    persistable: (s) => s.consentAt !== null,
  })
  const { commit, reset, dismissNotice } = p

  const grantConsent = useCallback(() => {
    const t = nowRef.current()
    dismissNotice()
    commit((s) => ({ ...s, consentAt: t }))
  }, [commit, dismissNotice])

  const answer = useCallback(
    (itemId: string, v: Rating) =>
      commit((s) => ({
        ...s,
        answers: { ...s.answers, [itemId]: v },
        skipped: (s.skipped ?? []).filter((id) => id !== itemId),
      })),
    [commit],
  )

  const skip = useCallback(
    (itemId: string) =>
      commit((s) => {
        const { [itemId]: _dropped, ...rest } = s.answers
        return { ...s, answers: rest, skipped: [...new Set([...(s.skipped ?? []), itemId])] }
      }),
    [commit],
  )

  const wipe = useCallback(() => {
    removeKey(store, key)
    reset()
  }, [store, key, reset])

  return { state: p.state, notice: p.notice, storageOk: p.storageOk, grantConsent, answer, skip, wipe }
}
