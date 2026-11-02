import type { Answers, Bank, Item } from './types'

/** 상대별 차이가 이 값 이상이면 리포트가 "상대에 따라 달라져요"라고 말한다. */
export const SPREAD_NOTABLE = 30

export interface AxisResult {
  axisId: string
  score: number | null
  spread: number | null
  coverage: number
  grade: 'self' | 'behavior' | 'other'
  evidence: string[]
}

export type Report = AxisResult[]

const MIN_ANSWERS_FOR_SCORE = 3

interface Scored {
  item: Item
  value: number
}

export function computeReport(bank: Bank, answers: Answers): Report {
  return bank.axes.map((axis) => {
    const items = bank.items.filter((i) => i.axisId === axis.id)
    const answered: Scored[] = []
    for (const item of items) {
      const a = answers[item.id]
      if (!a || a === 'skipped') continue
      const option = item.options.find((o) => o.id === a.optionId)
      if (option) answered.push({ item, value: option.value })
    }

    let score: number | null = null
    if (answered.length >= MIN_ANSWERS_FOR_SCORE) {
      let sum = 0
      let weights = 0
      for (const { item, value } of answered) {
        const w = item.weight ?? 1
        sum += value * w
        weights += w
      }
      score = Math.round(sum / weights)
    }

    const byAudience = new Map<string, number[]>()
    for (const { item, value } of answered) {
      if (item.format !== 'audience' || !item.audience) continue
      byAudience.set(item.audience, [...(byAudience.get(item.audience) ?? []), value])
    }
    let spread: number | null = null
    if (byAudience.size >= 2) {
      const means = [...byAudience.values()].map((vs) => vs.reduce((a, b) => a + b, 0) / vs.length)
      spread = Math.round(Math.max(...means) - Math.min(...means))
    }

    const behavior = answered.filter((s) => s.item.basis === 'behavior').length
    const grade = answered.length > 0 && behavior * 2 >= answered.length ? 'behavior' : 'self'

    const evidence = [...answered]
      .sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50) || a.item.id.localeCompare(b.item.id))
      .slice(0, 3)
      .map((s) => s.item.id)

    return {
      axisId: axis.id,
      score,
      spread,
      coverage: items.length ? Math.round((answered.length / items.length) * 100) / 100 : 0,
      grade,
      evidence,
    }
  })
}
