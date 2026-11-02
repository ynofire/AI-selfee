import { useMemo, useRef } from 'react'
import type { Answers, Bank } from '../../core/types'
import type { Report } from '../../core/scoring'
import { buildExportMarkdown, formatLocalDate } from '../../core/exportPackage'
import template from '../../data/prompt.v1.md?raw'
import { COPY } from '../copy'
import { downloadText } from '../download'
import { useCopy } from '../hooks/useCopy'
import { useState } from 'react'

interface Props {
  bank: Bank
  answers: Answers
  report: Report
  now: () => number
  onBack: () => void
}

export function ExportScreen({ bank, answers, report, now, onBack }: Props) {
  const generatedAt = useMemo(() => new Date(now()), [now])
  const text = useMemo(
    () => buildExportMarkdown({ bank, answers, report, template, generatedAt }),
    [bank, answers, report, generatedAt],
  )
  const box = useRef<HTMLTextAreaElement>(null)
  const { status, copy } = useCopy(text, () => box.current?.select())
  const [downloadFailed, setDownloadFailed] = useState(false)

  return (
    <section className="card">
      <h1>{COPY.export.title}</h1>
      <ol>
        {COPY.export.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="notice" data-testid="ai-notice">
        {COPY.export.aiNotice}
      </p>
      <p className="muted">{COPY.export.skeletonNotice}</p>

      <textarea
        ref={box}
        className="export-text"
        data-testid="export-text"
        readOnly
        rows={12}
        value={text}
        aria-label="내보내기 내용"
        onFocus={(e) => e.currentTarget.select()}
      />

      <div className="actions">
        <button type="button" className="primary" data-testid="copy-export" onClick={copy}>
          {COPY.export.copy}
        </button>
        <button
          type="button"
          className="secondary"
          data-testid="download-export"
          onClick={() => setDownloadFailed(!downloadText(`persona-export-${formatLocalDate(generatedAt, '')}.md`, text))}
        >
          {COPY.export.download}
        </button>
      </div>
      {status === 'done' && <p data-testid="copy-done">{COPY.export.copyDone}</p>}
      {status === 'failed' && <p role="alert" data-testid="copy-failed">{COPY.export.copyFailed}</p>}
      {downloadFailed && <p role="alert" data-testid="download-failed">{COPY.export.downloadFailed}</p>}

      <button type="button" className="link-button" onClick={onBack}>
        {COPY.export.back}
      </button>
    </section>
  )
}
