import { useCallback, useRef, useState } from 'react'
import { load, removeKey, save } from '../../core/storage'

/** 'expired': 7일이 지나 지움 · 'incompatible': 다른 버전의 질문지로 만든 값이라 버림 */
export type PersistNotice = 'expired' | 'incompatible' | null

interface Options<T extends { lastActiveAt: number }> {
  key: string
  store: Storage | null
  now: () => number
  fresh: (t: number) => T
  /** 저장돼 있던 값을 그대로 쓸지('ok'), 버전이 달라 버릴지('incompatible'), 깨졌는지('broken') */
  check: (value: unknown) => 'ok' | 'incompatible' | 'broken'
  /** false이면 저장소에 쓰지 않는다(동의 전). */
  persistable: (state: T) => boolean
}

function boot<T extends { lastActiveAt: number }>(o: Options<T>): { state: T; notice: PersistNotice } {
  const t = o.now()
  const { value, expired } = load<T>(o.store, o.key, t)
  if (expired) return { state: o.fresh(t), notice: 'expired' }
  if (value === null) return { state: o.fresh(t), notice: null }
  const verdict = o.check(value)
  if (verdict === 'ok') return { state: value, notice: null }
  removeKey(o.store, o.key)
  return { state: o.fresh(t), notice: verdict === 'incompatible' ? 'incompatible' : null }
}

/**
 * 한 개의 저장 키에 묶인 상태. 저장소를 못 쓰거나 쓰기가 실패해도 메모리에서 계속 동작하고,
 * 돌려주는 함수들은 렌더마다 바뀌지 않는다(효과 안에서 불러도 다시 렌더 루프에 빠지지 않는다).
 */
export function usePersisted<T extends { lastActiveAt: number }>(options: Options<T>) {
  const opts = useRef(options)
  opts.current = options

  const [initial] = useState(() => boot(options))
  const [state, setState] = useState<T>(initial.state)
  const [notice, setNotice] = useState<PersistNotice>(initial.notice)
  const [writeFailed, setWriteFailed] = useState(false)
  const latest = useRef(state)

  const commit = useCallback((mutate: (s: T) => T) => {
    const { store, key, now, persistable } = opts.current
    const next: T = { ...mutate(latest.current), lastActiveAt: now() }
    latest.current = next
    setState(next)
    if (store && persistable(next) && !save(store, key, next)) setWriteFailed(true)
  }, [])

  /** 상태를 처음으로 되돌린다. 저장소에서 지우는 일은 부르는 쪽이 한다. */
  const reset = useCallback(() => {
    const { now, fresh } = opts.current
    const f = fresh(now())
    latest.current = f
    setState(f)
    setNotice(null)
    setWriteFailed(false)
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  return { state, notice, storageOk: options.store !== null && !writeFailed, commit, reset, dismissNotice }
}
