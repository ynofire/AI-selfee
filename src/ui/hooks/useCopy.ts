import { useCallback, useState } from 'react'

export type CopyStatus = 'idle' | 'done' | 'failed'

/** 클립보드 복사. 막히거나 실패하면 'failed'로 알려 사용자가 직접 복사하게 한다. */
export function useCopy(text: string, onFail?: () => void) {
  const [status, setStatus] = useState<CopyStatus>('idle')
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('done')
    } catch {
      setStatus('failed')
      onFail?.()
    }
  }, [text, onFail])
  return { status, copy }
}
