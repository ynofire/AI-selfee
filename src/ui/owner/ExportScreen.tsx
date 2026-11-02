import { useMemo, useRef } from 'react'
import type { Answers, Bank } from '../../core/types'
import type { Report } from '../../core/scoring'
import type { ReportV2 } from '../../core/rater'
import type { ReplyPayload } from '../../core/codec'
import { buildExportMarkdown, formatLocalDate } from '../../core/exportPackage'
import template from '../../data/prompt.v1.md?raw'
import { COPY } from '../copy'
import { downloadText } from '../download'
import { useCopy } from '../hooks/useCopy'
import { useState } from 'react'

interface Props {
  bank: Bank
  answers: Answers
  report: Report | ReportV2
  /** 있으면 지인의 시각([other:호칭])이 함께 들어간 v2 내보내기가 된다. */
  reply?: ReplyPayload
  now: () => number
  onBack: () => void
}

export function ExportScreen({ bank, answers, report, reply, now, onBack }: Props) {
  const generatedAt = useMemo(() => new Date(now()), [now])
  const text = useMemo(
    () => buildExportMarkdown({ bank, answers, report, reply, template, generatedAt }),
    [bank, answers, report, reply, generatedAt],
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

      <button type="button" className="link-button" data-testid="back" onClick={onBack}>
        {COPY.export.back}
      </button>
    </section>
  )
}
