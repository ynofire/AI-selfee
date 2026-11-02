import { PayloadError } from '../core/codec'
import { COPY } from './copy'

/** location.hash("#…")에서 # 를 뗀다. */
export const payloadOf = (hash: string): string => (hash.startsWith('#') ? hash.slice(1) : hash)

/** 링크를 읽다 실패한 이유를 사용자가 할 수 있는 일로 바꿔 말한다. 어떤 오류든 던지지 않는다. */
export function linkErrorMessage(e: unknown): string {
  if (e instanceof PayloadError && e.code === 'version') return COPY.errors.newerLink
  return COPY.errors.invalidLink
}

export function tryDecode<T>(decode: (s: string) => T, hash: string): { ok: true; value: T } | { ok: false; message: string } {
  try {
    return { ok: true, value: decode(payloadOf(hash)) }
  } catch (e) {
    return { ok: false, message: linkErrorMessage(e) }
  }
}
