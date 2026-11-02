import { useMemo, useState } from 'react'
import type { Answers, Bank } from '../../core/types'
import { decodeReply, makeInvite } from '../../core/codec'
import type { ReplyPayload } from '../../core/codec'
import { MergeError, mergeReply } from '../../core/rater'
import type { ReportV2 } from '../../core/rater'
import { computeReport } from '../../core/scoring'
import { OWNER_KEY, isOwnerState, load } from '../../core/storage'
import type { OwnerState } from '../../core/storage'
import { AxisMeter } from '../components/AxisMeter'
import { ErrorScreen } from '../components/ErrorScreen'
import { COPY } from '../copy'
import { tryDecode } from '../linkErrors'
import { ExportScreen } from './ExportScreen'

/** 두 시각의 차이가 이 값 이상이면 "꽤 달라요"라고 말한다. */
const GAP_NOTABLE = 20

type Resolved =
  | { kind: 'error'; message: string }
  | { kind: 'no-owner' }
  | { kind: 'other-invite' }
  | { kind: 'ok'; reply: ReplyPayload; v2: ReportV2; answers: Answers }

function resolve(hash: string, bank: Bank, store: Storage | null, nowMs: number): Resolved {
  const decoded = tryDecode(decodeReply, hash)
  if (!decoded.ok) return { kind: 'error', message: decoded.message }
  const reply = decoded.value

  const { value } = load<OwnerState>(store, OWNER_KEY, nowMs)
  if (!isOwnerState(value) || value.consentAt === null) return { kind: 'no-owner' }
  if (value.bank !== bank.version) return { kind: 'error', message: COPY.errors.bankMismatch }
  const sent = value.invites[reply.nonce]
  if (!sent) return { kind: 'other-invite' }

  const report = computeReport(bank, value.answers)
  const invite = makeInvite(bank, report, sent.label, reply.nonce)
  try {
    return { kind: 'ok', reply, v2: mergeReply(bank, report, invite, reply), answers: value.answers }
  } catch (e) {
    if (e instanceof MergeError) {
      return e.code === 'bank' ? { kind: 'error', message: COPY.errors.bankMismatch } : { kind: 'other-invite' }
    }
    throw e
  }
}

interface Props {
  hash: string
  bank: Bank
  store: Storage | null
  now: () => number
}

/** 읽기만 한다. 저장소에는 아무것도 쓰지 않는다. */
export function ReplyScreen({ hash, bank, store, now }: Props) {
  const r = useMemo(() => resolve(hash, bank, store, now()), [hash, bank, store, now])
  const [exporting, setExporting] = useState(false)

  return (
    <main className="app" data-testid="screen-reply">
      {r.kind === 'error' && <ErrorScreen message={r.message} />}
      {r.kind === 'no-owner' && (
        <section className="card" role="alert" data-testid="reply-no-owner">
          <p>{COPY.reply.noOwner}</p>
        </section>
      )}
      {r.kind === 'other-invite' && (
        <section className="card" role="alert" data-testid="reply-other-invite">
          <p>{COPY.reply.otherInvite}</p>
        </section>
      )}
      {r.kind === 'ok' && !exporting && <ReplyView bank={bank} reply={r.reply} v2={r.v2} onExport={() => setExporting(true)} />}
      {r.kind === 'ok' && exporting && (
        <ExportScreen bank={bank} answers={r.answers} report={r.v2} reply={r.reply} now={now} onBack={() => setExporting(false)} />
      )}
    </main>
  )
}

function ReplyView({ bank, reply, v2, onExport }: { bank: Bank; reply: ReplyPayload; v2: ReportV2; onExport: () => void }) {
  const rows = v2.flatMap((res) => {
    const axis = bank.axes.find((a) => a.id === res.axisId)
    return axis && axis.layer === 'actual' && (res.other !== null || res.spreadCheck !== null) ? [{ axis, res }] : []
  })
  return (
    <section className="card">
      <h1>{COPY.reply.title(reply.label)}</h1>
      <p>{COPY.reply.lead}</p>
      <ul className="axes">
        {rows.map(({ axis, res }) => (
          <li key={axis.id} className="axis" data-testid={`v2-axis-${axis.id}`}>
            <h3>{axis.name}</h3>
            {res.score !== null && <AxisMeter axis={axis} score={res.score} otherScore={res.other} />}
            <p>
              {COPY.reply.mine} {res.score ?? '—'}/100 · {COPY.reply.theirs(reply.label)} {res.other ?? '—'}/100
            </p>
            {res.gap !== null && (
              <p>{res.gap >= GAP_NOTABLE ? COPY.reply.gapNotable(res.gap) : COPY.reply.gapSmall(res.gap)}</p>
            )}
            {res.spreadCheck && <p className="muted">{COPY.reply.spreadCheck[res.spreadCheck]}</p>}
          </li>
        ))}
      </ul>
      <p className="muted">{COPY.reply.notRated}</p>
      <div className="actions">
        <button type="button" className="primary" data-testid="to-export-v2" onClick={onExport}>
          {COPY.reply.toExport}
        </button>
      </div>
      <a href="/">{COPY.reply.back}</a>
    </section>
  )
}
