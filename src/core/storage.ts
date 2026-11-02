import type { Answers, RaterAnswers } from './types'

export const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
export const OWNER_KEY = 'pq:owner:v1'
export const raterKey = (nonce: string): string => `pq:rater:${nonce}`

export interface OwnerState {
  v: 1
  bank: string
  answers: Answers
  consentAt: number | null
  startedAt: number
  lastActiveAt: number
  invites: Record<string, { label: string; createdAt: number }>
}

export interface RaterState {
  v: 1
  nonce: string
  answers: RaterAnswers
  /** 건너뛴 문항. 다시 열었을 때 같은 문항이 되돌아오지 않게 한다. */
  skipped?: string[]
  consentAt: number | null
  lastActiveAt: number
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** 저장소에서 읽은 값이 쓸 수 있는 모양인지. 깨진 값으로 화면이 죽지 않게 한다. */
export function isOwnerState(v: unknown): v is OwnerState {
  return (
    isObject(v) &&
    v.v === 1 &&
    typeof v.bank === 'string' &&
    typeof v.lastActiveAt === 'number' &&
    typeof v.startedAt === 'number' &&
    (v.consentAt === null || typeof v.consentAt === 'number') &&
    isObject(v.answers) &&
    isObject(v.invites)
  )
}

export function isRaterState(v: unknown): v is RaterState {
  return (
    isObject(v) &&
    v.v === 1 &&
    typeof v.nonce === 'string' &&
    typeof v.lastActiveAt === 'number' &&
    (v.consentAt === null || typeof v.consentAt === 'number') &&
    isObject(v.answers) &&
    (v.skipped === undefined || (Array.isArray(v.skipped) && v.skipped.every((x) => typeof x === 'string')))
  )
}

/** 쓸 수 없는 환경(사생활 보호 모드, 인앱 브라우저 등)이면 null. */
export function getStore(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    const s = window.localStorage
    s.setItem('pq:probe', '1')
    s.removeItem('pq:probe')
    return s
  } catch {
    return null
  }
}

function safeRemove(store: Storage, key: string): void {
  try {
    store.removeItem(key)
  } catch {
    /* 지울 수 없어도 흐름을 막지 않는다 */
  }
}

/** 키 하나만 지운다. 저장소가 없거나 지울 수 없어도 던지지 않는다. */
export function removeKey(store: Storage | null, key: string): void {
  if (store) safeRemove(store, key)
}

export function load<T extends { lastActiveAt: number }>(
  store: Storage | null,
  key: string,
  now: number,
): { value: T | null; expired: boolean } {
  const none = { value: null, expired: false }
  if (!store) return none
  let raw: string | null
  try {
    raw = store.getItem(key)
  } catch {
    return none
  }
  if (raw === null) return none

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    safeRemove(store, key)
    return none
  }
  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { lastActiveAt?: unknown }).lastActiveAt !== 'number') {
    safeRemove(store, key)
    return none
  }
  const value = parsed as T
  if (now - value.lastActiveAt > EXPIRY_MS) {
    safeRemove(store, key)
    return { value: null, expired: true }
  }
  return { value, expired: false }
}

export function save(store: Storage | null, key: string, value: unknown): boolean {
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** 접두사 pq: 키만 지운다. */
export function clearAll(store: Storage | null): void {
  if (!store) return
  try {
    const keys: string[] = []
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k !== null && k.startsWith('pq:')) keys.push(k)
    }
    for (const k of keys) safeRemove(store, k)
  } catch {
    /* noop */
  }
}

export function expiryInfo(lastActiveAt: number, now: number): { expired: boolean; hoursLeft: number } {
  const left = lastActiveAt + EXPIRY_MS - now
  return { expired: now - lastActiveAt > EXPIRY_MS, hoursLeft: Math.max(0, Math.floor(left / 3_600_000)) }
}
