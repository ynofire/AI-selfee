import { useState } from 'react'
import type { Answer, Audience, Item } from '../../core/types'
import { displayOptions } from '../optionOrder'
import { COPY } from '../copy'

const AUDIENCE_LABEL: Record<Audience, string> = {
  spouse: '배우자', child: '자녀', parent: '부모', boss: '직장 상급자', friend: '친구',
}

interface Props {
  item: Item
  current: Answer | 'skipped' | undefined
  onSubmit: (a: Answer) => void
  onSkip?: () => void
  /** 두 선택지를 뒤집어 보여 줄 문항 id 모음(optionFlips). 점수와는 무관하다. */
  flips?: ReadonlySet<string>
}

const NO_FLIPS: ReadonlySet<string> = new Set()

export function ItemCard({ item, current, onSubmit, onSkip, flips = NO_FLIPS }: Props) {
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
        {displayOptions(item, flips).map((o) => {
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

      {/* 민감한 문항은 건너뛸 수 있고, 상대가 정해진 문항은 그런 사람이 없는 경우도 있어 건너뛸 수 있다. */}
      {(item.sensitive || item.audience) && onSkip && (
        <button type="button" className="link-button" data-testid="skip" onClick={onSkip}>
          {item.audience && !item.sensitive ? COPY.questions.skipNoSuchPerson : COPY.questions.skip}
        </button>
      )}
    </section>
  )
}
