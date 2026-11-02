import { useCallback, useMemo, useState } from 'react'
import type { Bank } from '../../core/types'
import { computeReport } from '../../core/scoring'
import { StatusBanners } from '../components/StatusBanners'
import { WipeButton } from '../components/WipeButton'
import { useOwnerState } from '../hooks/useOwnerState'
import { ExportScreen } from './ExportScreen'
import { InviteScreen } from './InviteScreen'
import { Questionnaire } from './Questionnaire'
import { ReportScreen } from './ReportScreen'
import { StartScreen } from './StartScreen'

type View = 'start' | 'questions' | 'report' | 'export' | 'invite'

interface Props {
  bank: Bank
  store: Storage | null
  now: () => number
}

export function OwnerApp({ bank, store, now }: Props) {
  const o = useOwnerState(bank, store, now)
  const answered = bank.items.filter((i) => i.id in o.state.answers).length
  const remaining = bank.items.length - answered
  const report = useMemo(() => computeReport(bank, o.state.answers), [bank, o.state.answers])

  const [view, setView] = useState<View>(() =>
    o.state.consentAt === null ? 'start' : remaining === 0 ? 'report' : 'questions',
  )
  const finish = useCallback(() => setView('report'), [])

  const consented = o.state.consentAt !== null

  return (
    <main className="app" data-testid="screen-owner">
      <StatusBanners
        storageOk={o.storageOk}
        consented={consented}
        lastActiveAt={o.state.lastActiveAt}
        now={now}
        notice={o.notice}
        atStart={view === 'start'}
      />

      {view === 'start' && (
        <StartScreen
          onStart={() => {
            o.grantConsent()
            setView(remaining === 0 ? 'report' : 'questions')
          }}
        />
      )}
      {view === 'questions' && (
        <Questionnaire
          bank={bank}
          answers={o.state.answers}
          onAnswer={o.setAnswer}
          onViewReport={() => setView('report')}
          onDone={finish}
        />
      )}
      {view === 'report' && (
        <ReportScreen
          bank={bank}
          answers={o.state.answers}
          report={report}
          remaining={remaining}
          onExport={() => setView('export')}
          onInvite={() => setView('invite')}
          onBack={() => setView('questions')}
        />
      )}
      {view === 'export' && (
        <ExportScreen bank={bank} answers={o.state.answers} report={report} now={now} onBack={() => setView('report')} />
      )}
      {view === 'invite' && (
        <InviteScreen bank={bank} report={report} onRemember={o.rememberInvite} onBack={() => setView('report')} />
      )}

      {consented && (
        <footer className="foot">
          <WipeButton
            onWipe={() => {
              o.wipe()
              setView('start')
            }}
          />
        </footer>
      )}
    </main>
  )
}
