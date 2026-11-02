import { useState } from 'react'
import { COPY } from '../copy'

export function StartScreen({ onStart }: { onStart: () => void }) {
  const [agreed, setAgreed] = useState(false)
  return (
    <section className="card">
      <h1>{COPY.start.title}</h1>
      <p>{COPY.start.lead}</p>
      <ul className="points">
        {COPY.start.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <label className="check">
        <input type="checkbox" data-testid="consent" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>{COPY.start.consent}</span>
      </label>
      <button type="button" className="primary" data-testid="start" disabled={!agreed} onClick={onStart}>
        {COPY.start.startButton}
      </button>
    </section>
  )
}
