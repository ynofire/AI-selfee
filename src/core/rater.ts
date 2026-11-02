import type { Bank, RaterAnswers, RaterItem } from './types'
import type { AxisResult, Report } from './scoring'
import type { InvitePayload, ReplyPayload } from './codec'

export const MAX_RATER_ITEMS = 20

export interface AxisResultV2 extends AxisResult {
  other: number | null
  spreadCheck: 'a' | 'd' | 'u' | null
  gap: number | null
}
export type ReportV2 = AxisResultV2[]

export class MergeError extends Error {
  readonly code: 'bank' | 'nonce'
  constructor(code: 'bank' | 'nonce') {
    super(code === 'bank' ? '문항 은행 버전이 달라요' : '다른 초대에 대한 답장이에요')
    this.name = 'MergeError'
    this.code = code
  }
}

/** 받는 사람이 평가할 수 있는 축: 초대에 들어 있고, 은행에서 관찰 가능한 실제 층 축. */
function ratedAxisIds(bank: Bank, invite: InvitePayload): string[] {
  const inInvite = new Set(invite.axes.map(([id]) => id))
  return bank.axes.filter((a) => a.observable && a.layer === 'actual' && inInvite.has(a.id)).map((a) => a.id)
}

export function buildRaterForm(bank: Bank, invite: InvitePayload): RaterItem[] {
  const rated = ratedAxisIds(bank, invite)
  const order = new Map(bank.axes.map((a, i) => [a.id, i]))
  const spreadOf = new Map(invite.axes.map(([id, , spread]) => [id, spread]))
  const eligible = bank.raterItems.filter((r) => rated.includes(r.axisId))

  const observe = eligible
    .filter((r) => r.kind === 'observe')
    .sort((a, b) => (order.get(a.axisId) ?? 0) - (order.get(b.axisId) ?? 0))
  const audience = eligible
    .filter((r) => r.kind === 'audience')
    .sort(
      (a, b) =>
        (spreadOf.get(b.axisId) ?? -1) - (spreadOf.get(a.axisId) ?? -1) ||
        (order.get(a.axisId) ?? 0) - (order.get(b.axisId) ?? 0),
    )
  return [...observe, ...audience].slice(0, MAX_RATER_ITEMS)
}

/** 문항별 원답은 담지 않고 축마다 평균 1개와 상대별 차이 확인 1개만 담는다. */
export function buildReply(bank: Bank, invite: InvitePayload, answers: RaterAnswers, label: string): ReplyPayload {
  const axes: ReplyPayload['axes'] = ratedAxisIds(bank, invite).map((axisId) => {
    const items = bank.raterItems.filter((r) => r.axisId === axisId)
    const scores = items
      .filter((r) => r.kind === 'observe')
      .map((r) => answers[r.id])
      .filter((v): v is 1 | 2 | 3 | 4 | 5 => typeof v === 'number')
    const observe = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null
    const check = items
      .filter((r) => r.kind === 'audience')
      .map((r) => answers[r.id])
      .find((v): v is 'a' | 'd' | 'u' => v === 'a' || v === 'd' || v === 'u')
    return [axisId, observe, check ?? null]
  })
  return { v: 1, bank: invite.bank, nonce: invite.nonce, label, axes }
}

export function mergeReply(bank: Bank, report: Report, invite: InvitePayload, reply: ReplyPayload): ReportV2 {
  if (invite.bank !== bank.version || reply.bank !== bank.version) throw new MergeError('bank')
  if (reply.nonce !== invite.nonce) throw new MergeError('nonce')

  const rated = new Set(ratedAxisIds(bank, invite))
  const byAxis = new Map(reply.axes.map(([id, observe, check]) => [id, { observe, check }]))

  return report.map((r) => {
    const e = rated.has(r.axisId) ? byAxis.get(r.axisId) : undefined
    const other = e && e.observe !== null ? Math.round((e.observe - 1) * 25) : null
    return {
      ...r,
      other,
      spreadCheck: e?.check ?? null,
      gap: other !== null && r.score !== null ? Math.abs(r.score - other) : null,
      grade: other !== null ? 'other' : r.grade,
    }
  })
}
