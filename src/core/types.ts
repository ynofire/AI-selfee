export type Audience = 'spouse' | 'child' | 'parent' | 'boss' | 'friend'
export type ItemFormat = 'forced' | 'frequency' | 'audience' | 'recall'

/** value는 축 위의 위치 (0~100). */
export interface Option {
  id: string
  label: string
  value: number
}

export interface Item {
  id: string
  axisId: string
  format: ItemFormat
  text: string
  options: Option[]
  basis: 'self' | 'behavior'
  audience?: Audience
  sensitive?: boolean
  extreme?: boolean
  weight?: number
}

/** observe 문항은 "동의할수록 축의 높은 쪽" 방향으로 쓴다. */
export interface RaterItem {
  id: string
  axisId: string
  kind: 'observe' | 'audience'
  text: string
}

export interface Axis {
  id: string
  name: string
  layer: 'actual' | 'desired'
  observable: boolean
  low: string
  high: string
  summary: { low: string; mid: string; high: string }
}

export interface Bank {
  version: string
  axes: Axis[]
  items: Item[]
  raterItems: RaterItem[]
}

export interface Answer {
  optionId: string
  note?: string
}
export type Answers = Record<string, Answer | 'skipped'>

/** observe는 1~5, audience는 a=맞다 / d=아니다 / u=모르겠다 */
export type RaterAnswers = Record<string, 1 | 2 | 3 | 4 | 5 | 'a' | 'd' | 'u'>
