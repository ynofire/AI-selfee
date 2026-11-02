import { useCallback, useMemo, useState } from 'react'
import type { Bank } from '../../core/types'
import { decodeInvite } from '../../core/codec'
import type { InvitePayload } from '../../core/codec'
import { buildRaterForm } from '../../core/rater'
import { ErrorScreen } from '../components/ErrorScreen'
import { StatusBanners } from '../components/StatusBanners'
import { WipeButton } from '../components/WipeButton'
import { COPY } from '../copy'
import { useRaterState } from '../hooks/useRaterState'
import { tryDecode } from '../linkErrors'
import { RaterDone } from './RaterDone'
import { RaterIntro, RaterSummary } from './RaterIntro'
import { RaterQuestions } from './RaterQuestions'

type View = 'intro' | 'summary' | 'questions' | 'done'

interface Props {
  hash: string
  bank: Bank
  store: Storage | null
  now: () => number
}

export function RaterApp({ hash, bank, store, now }: Props) {
  const decoded = useMemo(() => tryDecode(decodeInvite, hash), [hash])
  return (
    <main className="app" data-testid="screen-rater">
      {!decoded.ok ? (
        <ErrorScreen message={decoded.message} />
      ) : decoded.value.bank !== bank.version ? (
        <ErrorScreen message={COPY.errors.bankMismatch} />
      ) : (
        <RaterSession invite={decoded.value} bank={bank} store={store} now={now} />
      )}
    </main>
  )
}

function RaterSession({ invite, bank, store, now }: { invite: InvitePayload; bank: Bank; store: Storage | null; now: () => number }) {
  const r = useRaterState(invite.nonce, store, now)
  const form = useMemo(() => buildRaterForm(bank, invite), [bank, invite])
  const skipped = r.state.skipped ?? []
  const settled = form.filter((i) => i.id in r.state.answers || skipped.includes(i.id)).length

  const [view, setView] = useState<View>(() =>
    r.state.consentAt === null ? 'intro' : settled === 0 ? 'summary' : settled < form.length ? 'questions' : 'done',
  )
  const finish = useCallback(() => setView('done'), [])
  const consented = r.state.consentAt !== null

  return (
    <>
      <StatusBanners
        storageOk={r.storageOk}
        consented={consented}
        lastActiveAt={r.state.lastActiveAt}
        now={now}
        notice={r.notice}
        atStart={view === 'intro'}
      />
      {view === 'intro' && (
        <RaterIntro
          sender={invite.label}
          onStart={() => {
            r.grantConsent()
            setView('summary')
          }}
        />
      )}
      {view === 'summary' && <RaterSummary bank={bank} invite={invite} onBegin={() => setView('questions')} />}
      {view === 'questions' && (
        <RaterQuestions
          form={form}
          answers={r.state.answers}
          skipped={skipped}
          onAnswer={r.answer}
          onSkip={r.skip}
          onDone={finish}
        />
      )}
      {view === 'done' && <RaterDone bank={bank} invite={invite} answers={r.state.answers} />}

      {consented && (
        <footer className="foot">
          <WipeButton
            onWipe={() => {
              r.wipe()
              setView('intro')
            }}
          />
        </footer>
      )}
    </>
  )
}
