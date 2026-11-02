import { useState } from 'react'
import type { Bank } from '../../core/types'
import type { InvitePayload } from '../../core/codec'
import { SPREAD_NOTABLE } from '../../core/scoring'
import { AxisMeter } from '../components/AxisMeter'
import { summaryFor } from '../axisText'
import { COPY } from '../copy'

/** 수집 항목, 전달 범위, 자유, 보관 방식을 동의 전에 모두 보여 준다. */
export function RaterIntro({ sender, onStart }: { sender: string; onStart: () => void }) {
  const [agreed, setAgreed] = useState(false)
  const d = COPY.rater.disclosure
  return (
    <section className="card">
      <h1>{COPY.rater.introTitle(sender)}</h1>
      <ul className="points">
        <li data-testid="disclosure-sender">{d.sender(sender)}</li>
        <li data-testid="disclosure-collected">{d.collected}</li>
        <li data-testid="disclosure-returned">{d.returned}</li>
        <li data-testid="disclosure-skip">{d.skip}</li>
        <li data-testid="disclosure-local">{d.local}</li>
      </ul>
      <label className="check">
        <input type="checkbox" data-testid="consent" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>{COPY.rater.consent}</span>
      </label>
      <button type="button" className="primary" data-testid="start" disabled={!agreed} onClick={onStart}>
        {COPY.rater.start}
      </button>
    </section>
  )
}

export function RaterSummary({ bank, invite, onBegin }: { bank: Bank; invite: InvitePayload; onBegin: () => void }) {
  const rows = invite.axes.flatMap(([axisId, score, spread]) => {
    const axis = bank.axes.find((a) => a.id === axisId)
    return axis ? [{ axis, score, spread }] : []
  })
  return (
    <section className="card">
      <h1>{COPY.rater.summaryTitle(invite.label)}</h1>
      <p>{COPY.rater.summaryLead}</p>
      <ul className="axes">
        {rows.map(({ axis, score, spread }) => (
          <li key={axis.id} className="axis" data-testid={`summary-${axis.id}`}>
            <h3>{axis.name}</h3>
            <AxisMeter axis={axis} score={score} />
            <p>{summaryFor(axis, score)}</p>
            {spread !== null && spread >= SPREAD_NOTABLE && (
              <p className="muted" data-testid={`summary-${axis.id}-spread`}>
                {COPY.rater.spreadClaim}
              </p>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="primary" data-testid="begin" onClick={onBegin}>
        {COPY.rater.begin}
      </button>
    </section>
  )
}
