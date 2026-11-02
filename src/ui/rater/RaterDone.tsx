import { useMemo, useState } from 'react'
import type { Bank, RaterAnswers } from '../../core/types'
import { PayloadError, replyUrl } from '../../core/codec'
import type { InvitePayload } from '../../core/codec'
import { buildReply } from '../../core/rater'
import { COPY } from '../copy'
import { useCopy } from '../hooks/useCopy'

type Built = { status: 'blank' | 'invalid' | 'too_long' } | { status: 'ok'; url: string }

function build(bank: Bank, invite: InvitePayload, answers: RaterAnswers, rawLabel: string): Built {
  const label = rawLabel.trim()
  if (!label) return { status: 'blank' }
  try {
    return { status: 'ok', url: replyUrl(window.location.origin, buildReply(bank, invite, answers, label)) }
  } catch (e) {
    if (e instanceof PayloadError) return { status: e.code === 'too_long' ? 'too_long' : 'invalid' }
    throw e
  }
}

interface Props {
  bank: Bank
  invite: InvitePayload
  answers: RaterAnswers
}

export function RaterDone({ bank, invite, answers }: Props) {
  const [label, setLabel] = useState('')
  const nothing = Object.keys(answers).length === 0
  const built = useMemo(() => (nothing ? ({ status: 'blank' } as const) : build(bank, invite, answers, label)), [nothing, bank, invite, answers, label])
  const url = built.status === 'ok' ? built.url : ''
  const { status, copy } = useCopy(url)

  return (
    <section className="card">
      <h1>{COPY.rater.doneTitle}</h1>
      {nothing ? (
        <p role="alert" data-testid="reply-empty">
          {COPY.rater.empty}
        </p>
      ) : (
        <>
          <p>{COPY.rater.doneLead}</p>
          <label className="field">
            <span>{COPY.rater.labelLabel}</span>
            <input
              type="text"
              data-testid="rater-label"
              value={label}
              placeholder={COPY.rater.labelHint}
              autoComplete="off"
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          {(built.status === 'invalid' || built.status === 'too_long') && <p role="alert">{COPY.invite.labelInvalid}</p>}
          {built.status === 'ok' && (
            <>
              <input className="url-box" data-testid="reply-url" readOnly value={url} aria-label="답장 링크" onFocus={(e) => e.currentTarget.select()} />
              <div className="actions">
                <button type="button" className="primary" data-testid="copy-reply" onClick={copy}>
                  {COPY.rater.copy}
                </button>
              </div>
              {status === 'done' && <p>{COPY.export.copyDone}</p>}
              {status === 'failed' && <p role="alert">{COPY.export.copyFailed}</p>}
              <p className="muted">{COPY.rater.returnedNote}</p>
            </>
          )}
        </>
      )}
    </section>
  )
}
