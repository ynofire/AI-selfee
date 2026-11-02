import { useEffect, useMemo, useState } from 'react'
import type { Bank } from '../../core/types'
import type { Report } from '../../core/scoring'
import { PayloadError, inviteUrl, makeInvite, newNonce } from '../../core/codec'
import { COPY } from '../copy'
import { useCopy } from '../hooks/useCopy'

type Built =
  | { status: 'blank' }
  | { status: 'invalid' | 'too_long' | 'empty' }
  | { status: 'ok'; url: string; label: string }

function build(bank: Bank, report: Report, rawLabel: string, nonce: string): Built {
  const label = rawLabel.trim()
  if (!label) return { status: 'blank' }
  try {
    const invite = makeInvite(bank, report, label, nonce)
    if (invite.axes.length === 0) return { status: 'empty' }
    return { status: 'ok', url: inviteUrl(window.location.origin, invite), label }
  } catch (e) {
    if (e instanceof PayloadError) return { status: e.code === 'too_long' ? 'too_long' : 'invalid' }
    throw e
  }
}

interface Props {
  bank: Bank
  report: Report
  onRemember: (nonce: string, label: string) => void
  onBack: () => void
}

export function InviteScreen({ bank, report, onRemember, onBack }: Props) {
  const [nonce] = useState(newNonce)
  const [label, setLabel] = useState('')
  const built = useMemo(() => build(bank, report, label, nonce), [bank, report, label, nonce])
  const url = built.status === 'ok' ? built.url : ''
  const { status, copy } = useCopy(url)

  // 답장이 돌아왔을 때 어떤 초대에 대한 것인지 알아보려고 nonce를 기억해 둔다.
  const remembered = built.status === 'ok' ? built.label : null
  useEffect(() => {
    if (remembered !== null) onRemember(nonce, remembered)
  }, [remembered, nonce, onRemember])

  return (
    <section className="card">
      <h1>{COPY.invite.title}</h1>
      <p>{COPY.invite.lead}</p>
      <p className="notice" data-testid="invite-warning">
        {COPY.invite.warning}
      </p>

      <label className="field">
        <span>{COPY.invite.labelLabel}</span>
        <input
          type="text"
          data-testid="invite-label"
          value={label}
          placeholder={COPY.invite.labelHint}
          autoComplete="off"
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      {built.status === 'invalid' && <p role="alert">{COPY.invite.labelInvalid}</p>}
      {built.status === 'too_long' && <p role="alert">{COPY.invite.tooLong}</p>}
      {built.status === 'empty' && (
        <p role="alert" data-testid="invite-empty">
          {COPY.invite.empty}
        </p>
      )}

      {built.status === 'ok' && (
        <>
          <input className="url-box" data-testid="invite-url" readOnly value={url} aria-label="초대 링크" onFocus={(e) => e.currentTarget.select()} />
          <div className="actions">
            <button type="button" className="primary" data-testid="copy-invite" onClick={copy}>
              {COPY.invite.copy}
            </button>
          </div>
          {status === 'done' && <p>{COPY.export.copyDone}</p>}
          {status === 'failed' && <p role="alert">{COPY.export.copyFailed}</p>}
          <p className="muted">{COPY.invite.replyHint}</p>
        </>
      )}

      <button type="button" className="link-button" onClick={onBack}>
        {COPY.invite.back}
      </button>
    </section>
  )
}
