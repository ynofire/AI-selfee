import { useState } from 'react'
import type { Answer, Audience, Item } from '../../core/types'
import { COPY } from '../copy'

const AUDIENCE_LABEL: Record<Audience, string> = {
  spouse: '배우자', child: '자녀', parent: '부모', boss: '직장 상급자', friend: '친구',
}

interface Props {
  item: Item
  current: Answer | 'skipped' | undefined
  onSubmit: (a: Answer) => void
  onSkip?: () => void
}

export function ItemCard({ item, current, onSubmit, onSkip }: Props) {
  const prev = current && current !== 'skipped' ? current : undefined
  const [picked, setPicked] = useState<string | null>(prev?.optionId ?? null)
  const [note, setNote] = useState(prev?.note ?? '')
  const isRecall = item.format === 'recall'

  return (
    <section className="card" aria-labelledby="item-text">
      {item.audience && (
        <p className="chip" data-testid="audience-chip">
          상대: {AUDIENCE_LABEL[item.audience]}
        </p>
      )}
      <h2 id="item-text" data-testid="item-text">
        {item.text}
      </h2>

      <div className="options" role="group" aria-labelledby="item-text">
        {item.options.map((o) => {
          const selected = isRecall ? picked === o.id : prev?.optionId === o.id
          return (
            <button
              key={o.id}
              type="button"
              className={`option${selected ? ' selected' : ''}`}
              aria-pressed={selected}
              data-testid={`option-${o.id}`}
              onClick={() => (isRecall ? setPicked(o.id) : onSubmit({ optionId: o.id }))}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {isRecall && (
        <>
          <label className="field">
            <span>{COPY.questions.recallNote}</span>
            <textarea
              data-testid="recall-note"
              maxLength={300}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary"
            data-testid="recall-next"
            disabled={picked === null}
            onClick={() => {
              if (picked === null) return
              const trimmed = note.trim()
              onSubmit(trimmed ? { optionId: picked, note: trimmed } : { optionId: picked })
            }}
          >
            {COPY.questions.recallNext}
          </button>
        </>
      )}

      {item.sensitive && onSkip && (
        <button type="button" className="link-button" data-testid="skip" onClick={onSkip}>
          {COPY.questions.skip}
        </button>
      )}
    </section>
  )
}
