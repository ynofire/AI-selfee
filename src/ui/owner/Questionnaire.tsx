import { useEffect, useMemo, useState } from 'react'
import type { Answer, Bank, Item } from '../../core/types'
import type { OwnerState } from '../../core/storage'
import { ItemCard } from '../components/ItemCard'
import { optionFlips } from '../optionOrder'
import { COPY } from '../copy'

export const SESSION_SIZE = 18

/**
 * 출제 순서: 실제 모습 축을 돌아가며 한 문항씩, 그다음 되고 싶은 나 축.
 * 축 안의 순서는 은행 순서를 지킨다. 한 세션(18문항)이 여러 축에 근거를 보태도록 하려는 것이다.
 */
export function orderItems(bank: Bank): Item[] {
  const axisPos = new Map(bank.axes.map((a, i) => [a.id, i]))
  const desired = new Set(bank.axes.filter((a) => a.layer === 'desired').map((a) => a.id))
  const seen = new Map<string, number>()
  const keyed = bank.items.map((item) => {
    const pos = seen.get(item.axisId) ?? 0
    seen.set(item.axisId, pos + 1)
    return { item, pos, axis: axisPos.get(item.axisId) ?? 0, desired: desired.has(item.axisId) }
  })
  keyed.sort((a, b) => Number(a.desired) - Number(b.desired) || a.pos - b.pos || a.axis - b.axis)
  return keyed.map((k) => k.item)
}

interface Props {
  bank: Bank
  answers: OwnerState['answers']
  onAnswer: (itemId: string, a: Answer | 'skipped') => void
  onViewReport: () => void
  onDone: () => void
}

export function Questionnaire({ bank, answers, onAnswer, onViewReport, onDone }: Props) {
  const items = useMemo(() => orderItems(bank), [bank])
  const flips = useMemo(() => optionFlips(bank), [bank])
  const [cursor, setCursor] = useState(() => {
    const first = items.findIndex((i) => !(i.id in answers))
    return first === -1 ? items.length : first
  })
  const [restedAt, setRestedAt] = useState(-1)

  useEffect(() => {
    if (cursor >= items.length) onDone()
  }, [cursor, items.length, onDone])

  if (cursor >= items.length) return null

  if (cursor > 0 && cursor % SESSION_SIZE === 0 && restedAt !== cursor) {
    return (
      <section className="card" data-testid="session-done">
        <p>{COPY.questions.sessionDone(cursor)}</p>
        <button type="button" className="primary" data-testid="continue" onClick={() => setRestedAt(cursor)}>
          {COPY.questions.continue}
        </button>
        <button type="button" className="secondary" data-testid="view-report" onClick={onViewReport}>
          {COPY.questions.viewReport}
        </button>
      </section>
    )
  }

  const item = items[cursor]
  if (!item) return null
  const submit = (a: Answer | 'skipped') => {
    onAnswer(item.id, a)
    setCursor(cursor + 1)
  }

  return (
    <>
      <p className="progress" data-testid="progress" aria-live="polite">
        {cursor + 1} / {items.length}
      </p>
      <ItemCard
        key={item.id}
        item={item}
        current={answers[item.id]}
        onSubmit={submit}
        onSkip={() => submit('skipped')}
        flips={flips}
      />
      <button
        type="button"
        className="link-button"
        data-testid="prev"
        disabled={cursor === 0}
        onClick={() => setCursor(cursor - 1)}
      >
        {COPY.questions.prev}
      </button>
    </>
  )
}
