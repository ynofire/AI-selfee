import type { Answers, Axis, Bank } from '../../core/types'
import type { AxisResult, Report } from '../../core/scoring'
import { AxisMeter } from '../components/AxisMeter'
import { summaryFor } from '../axisText'
import { COPY } from '../copy'

const GRADE_LABEL: Record<AxisResult['grade'], string> = {
  self: '내가 말한 것 위주', behavior: '실제 행동 위주', other: '지인이 확인함',
}

function answeredCount(bank: Bank, answers: Answers, axisId: string): number {
  return bank.items.filter((i) => i.axisId === axisId && answers[i.id] && answers[i.id] !== 'skipped').length
}

function evidenceLine(bank: Bank, answers: Answers, itemId: string): string | null {
  const item = bank.items.find((i) => i.id === itemId)
  const a = answers[itemId]
  if (!item || !a || a === 'skipped') return null
  const option = item.options.find((o) => o.id === a.optionId)
  return option ? `${item.text} → ${option.label}` : null
}

function AxisRow({ bank, answers, axis, result }: { bank: Bank; answers: Answers; axis: Axis; result: AxisResult }) {
  const { score } = result
  return (
    <li className="axis" data-testid={`axis-${axis.id}`}>
      <h3>{axis.name}</h3>
      {score === null ? (
        <p className="muted" data-testid={`axis-${axis.id}-insufficient`}>
          {COPY.report.insufficient(answeredCount(bank, answers, axis.id))}
        </p>
      ) : (
        <>
          <AxisMeter axis={axis} score={score} />
          <p>{summaryFor(axis, score)}</p>
          {result.spread !== null && (
            <p className="muted">
              {result.spread >= 30 ? `상대에 따라 꽤 달라져요 (차이 ${result.spread})` : '상대에 따라 큰 차이는 없어요'}
            </p>
          )}
          <p className="muted">
            답변 근거 {Math.round(result.coverage * 100)}% · {GRADE_LABEL[result.grade]}
          </p>
          {result.evidence.length > 0 && (
            <details>
              <summary>{COPY.report.evidence}</summary>
              <ul>
                {result.evidence.map((id) => {
                  const line = evidenceLine(bank, answers, id)
                  return line ? <li key={id}>{line}</li> : null
                })}
              </ul>
            </details>
          )}
        </>
      )}
    </li>
  )
}

interface Props {
  bank: Bank
  answers: Answers
  report: Report
  remaining: number
  onExport: () => void
  onInvite: () => void
  onBack: () => void
}

export function ReportScreen({ bank, answers, report, remaining, onExport, onInvite, onBack }: Props) {
  const byId = new Map(report.map((r) => [r.axisId, r]))
  const rows = (layer: Axis['layer']) =>
    bank.axes
      .filter((a) => a.layer === layer)
      .map((axis) => {
        const result = byId.get(axis.id)
        return result ? <AxisRow key={axis.id} bank={bank} answers={answers} axis={axis} result={result} /> : null
      })
  const hasDesired = bank.axes.some((a) => a.layer === 'desired')

  return (
    <section className="card">
      <h1>{COPY.report.title}</h1>
      <p>{COPY.report.lead}</p>
      <ul className="axes">{rows('actual')}</ul>
      {hasDesired && (
        <>
          <h2>{COPY.report.desiredTitle}</h2>
          <p className="muted">{COPY.report.desiredLead}</p>
          <ul className="axes">{rows('desired')}</ul>
        </>
      )}
      <div className="actions">
        <button type="button" className="primary" data-testid="to-export" onClick={onExport}>
          {COPY.report.toExport}
        </button>
        <button type="button" className="primary" data-testid="to-invite" onClick={onInvite}>
          {COPY.report.toInvite}
        </button>
        {remaining > 0 && (
          <button type="button" className="secondary" data-testid="back-to-questions" onClick={onBack}>
            {COPY.report.backToQuestions(remaining)}
          </button>
        )}
      </div>
    </section>
  )
}
