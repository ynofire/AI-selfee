import type { Bank } from './types'
import type { Report } from './scoring'

export interface InvitePayload {
  v: 1
  bank: string
  nonce: string
  label: string
  axes: Array<[axisId: string, score: number, spread: number | null]>
}

export interface ReplyPayload {
  v: 1
  bank: string
  nonce: string
  label: string
  /** observe: 1~5 평균(소수 첫째 자리), spreadCheck: a=맞다 / d=아니다 / u=모르겠다 */
  axes: Array<[axisId: string, observe: number | null, spreadCheck: 'a' | 'd' | 'u' | null]>
}

export type PayloadErrorCode = 'malformed' | 'version' | 'invalid' | 'too_long'

export class PayloadError extends Error {
  readonly code: PayloadErrorCode
  constructor(code: PayloadErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'PayloadError'
    this.code = code
  }
}

const MAX_LENGTH = 1000
const MAX_AXES = 20
const NONCE_RE = /^[A-Za-z0-9_-]{8,32}$/
const AXIS_ID_RE = /^[a-z0-9_]{1,16}$/
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001F\u007F-\u009F]/g

const invalid = (why: string): never => {
  throw new PayloadError('invalid', why)
}

// ---------- base64url (UTF-8 JSON) ----------

function toBase64Url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): unknown {
  if (s.length >= MAX_LENGTH) throw new PayloadError('too_long')
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new PayloadError('malformed')
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new PayloadError('malformed')
  }
}

// ---------- validation ----------

type Obj = Record<string, unknown>

function header(o: unknown): { obj: Obj; bank: string; nonce: string; label: string } {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new PayloadError('malformed')
  const obj = o as Obj
  if (obj.v !== 1) {
    // 'version'은 더 새로운 앱이 만든 링크일 때만. 버전이 없거나 숫자가 아니면 그냥 잘못된 링크다.
    if (typeof obj.v === 'number' && Number.isInteger(obj.v) && obj.v > 1) throw new PayloadError('version')
    invalid('v')
  }
  const bank = obj.bank
  if (typeof bank !== 'string' || bank.length < 1 || bank.length > 32) invalid('bank')
  const nonce = obj.nonce
  if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) invalid('nonce')
  const rawLabel = obj.label
  if (typeof rawLabel !== 'string') invalid('label')
  const label = (rawLabel as string).replace(CONTROL_RE, '').trim()
  const length = Array.from(label).length
  if (length < 1 || length > 20 || /[<>]/.test(label)) invalid('label')
  return { obj, bank: bank as string, nonce: nonce as string, label }
}

const isAxisId = (v: unknown): v is string => typeof v === 'string' && AXIS_ID_RE.test(v)
const isPercent = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100

function axesOf(o: Obj): unknown[][] {
  const axes = o.axes
  if (!Array.isArray(axes) || axes.length > MAX_AXES) invalid('axes')
  for (const e of axes as unknown[]) if (!Array.isArray(e) || e.length !== 3) invalid('axes entry')
  return axes as unknown[][]
}

function validateInvite(raw: unknown): InvitePayload {
  const { obj, bank, nonce, label } = header(raw)
  const axes = axesOf(obj).map(([id, score, spread]): [string, number, number | null] => {
    if (!isAxisId(id) || !isPercent(score) || !(spread === null || isPercent(spread))) invalid('axes entry')
    return [id as string, score as number, spread as number | null]
  })
  return { v: 1, bank, nonce, label, axes }
}

function validateReply(raw: unknown): ReplyPayload {
  const { obj, bank, nonce, label } = header(raw)
  const axes = axesOf(obj).map(([id, observe, check]): [string, number | null, 'a' | 'd' | 'u' | null] => {
    const okObserve = observe === null || (typeof observe === 'number' && Number.isFinite(observe) && observe >= 1 && observe <= 5)
    const okCheck = check === null || check === 'a' || check === 'd' || check === 'u'
    if (!isAxisId(id) || !okObserve || !okCheck) invalid('axes entry')
    return [id as string, observe as number | null, check as 'a' | 'd' | 'u' | null]
  })
  return { v: 1, bank, nonce, label, axes }
}

// ---------- public API ----------

function encode(valid: InvitePayload | ReplyPayload): string {
  const s = toBase64Url(valid)
  if (s.length >= MAX_LENGTH) throw new PayloadError('too_long')
  return s
}

export const encodeInvite = (p: InvitePayload): string => encode(validateInvite(p))
export const decodeInvite = (s: string): InvitePayload => validateInvite(fromBase64Url(s))
export const encodeReply = (p: ReplyPayload): string => encode(validateReply(p))
export const decodeReply = (s: string): ReplyPayload => validateReply(fromBase64Url(s))

/** desired 층 축과 점수가 없는 축은 초대에 넣지 않는다. */
export function makeInvite(bank: Bank, report: Report, label: string, nonce: string): InvitePayload {
  const actual = new Set(bank.axes.filter((a) => a.layer === 'actual').map((a) => a.id))
  const axes: InvitePayload['axes'] = []
  for (const r of report) {
    if (r.score !== null && actual.has(r.axisId)) axes.push([r.axisId, r.score, r.spread])
  }
  return { v: 1, bank: bank.version, nonce, label, axes }
}

export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_')
}

export const inviteUrl = (origin: string, p: InvitePayload): string => `${origin}/r#${encodeInvite(p)}`
export const replyUrl = (origin: string, p: ReplyPayload): string => `${origin}/b#${encodeReply(p)}`
