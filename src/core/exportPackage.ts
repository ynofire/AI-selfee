import type { Answers, Audience, Axis, Bank, Item, Option } from './types'
import type { AxisResult, Report } from './scoring'
import type { ReportV2 } from './rater'
import type { ReplyPayload } from './codec'

const AUDIENCE_LABEL: Record<Audience, string> = {
  spouse: '배우자', child: '자녀', parent: '부모', boss: '직장 상급자', friend: '친구',
}
const GRADE_LABEL: Record<AxisResult['grade'], string> = { self: '자기 보고', behavior: '행동 기반', other: '타인 확인' }
const CHECK_LABEL = { a: '맞다', d: '아니다', u: '모르겠다' } as const

interface Entry {
  item: Item
  option: Option
  note?: string
}

function answeredEntries(bank: Bank, answers: Answers, axis: Axis): Entry[] {
  const out: Entry[] = []
  for (const item of bank.items.filter((i) => i.axisId === axis.id)) {
    const a = answers[item.id]
    if (!a || a === 'skipped') continue
    const option = item.options.find((o) => o.id === a.optionId)
    if (option) out.push({ item, option, note: a.note })
  }
  return out
}

const oneLine = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim()

function answerSection(bank: Bank, answers: Answers, layer: Axis['layer']): string {
  const blocks: string[] = []
  for (const axis of bank.axes.filter((a) => a.layer === layer)) {
    const entries = answeredEntries(bank, answers, axis)
    if (!entries.length) continue
    const lines = entries.flatMap(({ item, option, note }) => {
      const who = item.audience ? `(${AUDIENCE_LABEL[item.audience]}) ` : ''
      const tag = layer === 'desired' ? '[desired]' : `[stated · ${item.basis === 'behavior' ? '행동 기반' : '자기 보고'}]`
      const line = `- ${who}${item.text} → ${option.label} ${tag}`
      return note && note.trim() ? [line, `  - 메모: ${oneLine(note)}`] : [line]
    })
    blocks.push(`## ${axis.name}\n${lines.join('\n')}`)
  }
  return blocks.length ? blocks.join('\n\n') : layer === 'desired' ? '(없음)' : '(답변 없음)'
}

function reportSection(bank: Bank, report: Report | ReportV2): string {
  const byId = new Map(bank.axes.map((a) => [a.id, a]))
  const lines: string[] = []
  for (const r of report) {
    const axis = byId.get(r.axisId)
    if (!axis || axis.layer !== 'actual') continue
    let line =
      r.score === null
        ? `- ${axis.name}: 근거 부족`
        : `- ${axis.name}: ${r.score}/100 (${axis.low} ↔ ${axis.high}), 상대별 차이 ${r.spread ?? '측정 안 됨'}, 근거 ${Math.round(r.coverage * 100)}%, 신뢰도 ${GRADE_LABEL[r.grade]}`
    if ('other' in r && r.other !== null) {
      line += ` · 타인 평가 ${r.other}/100${r.gap !== null ? ` (차이 ${r.gap})` : ''}`
      if (r.spreadCheck) line += ` · 상대별 차이 확인: ${CHECK_LABEL[r.spreadCheck]}`
    }
    lines.push(line)
  }
  return lines.length ? lines.join('\n') : '(리포트 없음)'
}

function otherSection(bank: Bank, reply?: ReplyPayload): string {
  if (!reply) return '(지인 평가 없음)'
  const byId = new Map(bank.axes.map((a) => [a.id, a]))
  const lines: string[] = []
  for (const [axisId, observe, check] of reply.axes) {
    const axis = byId.get(axisId)
    // 내면 축과 되고 싶은 나는 자기 보고만 쓴다(스펙 §4.2). 조작된 답장이 이 축에 [other:] 줄을 붙이지 못하게 막는다.
    if (!axis || !axis.observable || axis.layer !== 'actual' || (observe === null && check === null)) continue
    const obs = observe === null ? '관찰 평균 없음' : `관찰 평균 ${observe}/5 (0~100 환산 ${Math.round((observe - 1) * 25)})`
    lines.push(`- [other:${reply.label}] ${axis.name}: ${obs}, 상대별 차이 확인: ${check ? CHECK_LABEL[check] : '없음'}`)
  }
  return lines.length ? lines.join('\n') : '(지인 평가 없음)'
}

/** 사용자 기기의 달력 날짜. UTC로 자르면 한국 새벽에 하루 전 날짜가 나온다. */
export function formatLocalDate(d: Date, sep = '-'): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return [String(d.getFullYear()), pad(d.getMonth() + 1), pad(d.getDate())].join(sep)
}

export function buildExportMarkdown(args: {
  bank: Bank
  answers: Answers
  report: Report | ReportV2
  reply?: ReplyPayload
  template: string
  generatedAt: Date
}): string {
  const { bank, answers, report, reply, template, generatedAt } = args
  const parts: Record<string, string> = {
    DATE: formatLocalDate(generatedAt),
    REPORT: reportSection(bank, report),
    ANSWERS: answerSection(bank, answers, 'actual'),
    DESIRED: answerSection(bank, answers, 'desired'),
    OTHER: otherSection(bank, reply),
  }
  // 한 번에 치환해서, 사용자 텍스트 안의 {{...}}나 $& 가 다시 해석되지 않게 한다.
  return template.replace(/\{\{(DATE|REPORT|ANSWERS|DESIRED|OTHER)\}\}/g, (_m, key: string) => parts[key] ?? '')
}
