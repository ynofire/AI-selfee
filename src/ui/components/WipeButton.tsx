import { useState } from 'react'
import { COPY } from '../copy'

/** 실수로 한 번 눌러 지우지 않도록 한 번 더 묻는다. */
export function WipeButton({ onWipe }: { onWipe: () => void }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className="link-button" data-testid="wipe" onClick={() => setAsking(true)}>
        {COPY.wipe.button}
      </button>
    )
  }
  return (
    <div className="wipe-ask" role="alert">
      <p>{COPY.wipe.ask}</p>
      <button type="button" className="danger" data-testid="wipe-confirm" onClick={onWipe}>
        {COPY.wipe.confirm}
      </button>
      <button type="button" className="secondary" onClick={() => setAsking(false)}>
        {COPY.wipe.cancel}
      </button>
    </div>
  )
}
