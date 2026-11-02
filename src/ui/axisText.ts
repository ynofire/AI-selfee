import type { Axis } from '../core/types'

/** 0~100 위치를 세 구간 중 하나의 문장으로 바꾼다. */
export function summaryFor(axis: Axis, score: number): string {
  return score < 34 ? axis.summary.low : score < 67 ? axis.summary.mid : axis.summary.high
}
