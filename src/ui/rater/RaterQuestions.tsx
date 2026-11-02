import { useEffect, useState } from 'react'
import type { RaterAnswers, RaterItem } from '../../core/types'
import { COPY } from '../copy'

type Rating = RaterAnswers[string]

interface Props {
  form: RaterItem[]
  answers: RaterAnswers
  skipped: string[]
  onAnswer: (itemId: string, v: Rating) => void
  onSkip: (itemId: string) => void
  onDone: () => void
}

export function RaterQuestions({ form, answers, skipped, onAnswer, onSkip, onDone }: Props) {
  const [cursor, setCursor] = useState(() => {
    const first = form.findIndex((i) => !(i.id in answers) && !skipped.includes(i.id))
    return first === -1 ? form.length : first
  })

  useEffect(() => {
    if (cursor >= form.length) onDone()
  }, [cursor, form.length, onDone])

  const item = form[cursor]
  if (!item) return null
  const current = answers[item.id]
  const pick = (v: Rating) => {
    onAnswer(item.id, v)
    setCursor(cursor + 1)
  }

  return (
    <>
      <p className="progress" data-testid="progress" aria-live="polite">
        {cursor + 1} / {form.length}
      </p>
      <section className="card" aria-labelledby="item-text">
        <h2 id="item-text" data-testid="item-text">
          {item.text}
        </h2>
        {item.kind === 'observe' ? (
          <>
            <p className="muted">{COPY.rater.scaleHint}</p>
            <div className="rate-grid" role="group" aria-labelledby="item-text">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`option${current === n ? ' selected' : ''}`}
                  aria-pressed={current === n}
                  data-testid={`rate-${n}`}
                  onClick={() => pick(n)}
                >
                  {n} · {COPY.rater.scale[n - 1]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="options" role="group" aria-labelledby="item-text">
            {(['a', 'd', 'u'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`option${current === c ? ' selected' : ''}`}
                aria-pressed={current === c}
                data-testid={`choice-${c}`}
                onClick={() => pick(c)}
              >
                {COPY.rater.choices[c]}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="link-button"
          data-testid="skip"
          onClick={() => {
            onSkip(item.id)
            setCursor(cursor + 1)
          }}
        >
          {COPY.questions.skip}
        </button>
      </section>
      <button type="button" className="link-button" data-testid="prev" disabled={cursor === 0} onClick={() => setCursor(cursor - 1)}>
        {COPY.questions.prev}
      </button>
    </>
  )
}
