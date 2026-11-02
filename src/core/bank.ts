import type { Bank } from './types'

export class BankError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BankError'
  }
}

type Obj = Record<string, unknown>

const FORMATS = ['forced', 'frequency', 'audience', 'recall']
const AUDIENCES = ['spouse', 'child', 'parent', 'boss', 'friend']
const BASES = ['self', 'behavior']
const LAYERS = ['actual', 'desired']
const KINDS = ['observe', 'audience']

function fail(message: string): never {
  throw new BankError(message)
}

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown, where: string): string {
  if (typeof v !== 'string' || v.length === 0) fail(`${where}: 문자열이 필요해요`)
  return v
}

function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(`${where}: 배열이 필요해요`)
  return v
}

function oneOf(v: unknown, allowed: string[], where: string): string {
  if (typeof v !== 'string' || !allowed.includes(v)) fail(`${where}: ${allowed.join(', ')} 중 하나여야 해요`)
  return v
}

export function validateBank(raw: unknown): Bank {
  if (!isObj(raw)) fail('은행은 객체여야 해요')
  str(raw.version, 'version')

  const axisIds = new Map<string, { observable: boolean }>()
  for (const a of arr(raw.axes, 'axes')) {
    if (!isObj(a)) fail('axis는 객체여야 해요')
    const id = str(a.id, 'axis.id')
    if (axisIds.has(id)) fail(`axis id 중복: ${id}`)
    str(a.name, `axis ${id}.name`)
    const layer = oneOf(a.layer, LAYERS, `axis ${id}.layer`)
    if (typeof a.observable !== 'boolean') fail(`axis ${id}.observable: boolean이 필요해요`)
    if (layer === 'desired' && a.observable) fail(`axis ${id}: desired 층 축은 observable일 수 없어요`)
    str(a.low, `axis ${id}.low`)
    str(a.high, `axis ${id}.high`)
    if (!isObj(a.summary)) fail(`axis ${id}.summary가 필요해요`)
    for (const k of ['low', 'mid', 'high']) str(a.summary[k], `axis ${id}.summary.${k}`)
    axisIds.set(id, { observable: a.observable })
  }

  const itemIds = new Set<string>()
  for (const it of arr(raw.items, 'items')) {
    if (!isObj(it)) fail('item은 객체여야 해요')
    const id = str(it.id, 'item.id')
    if (itemIds.has(id)) fail(`item id 중복: ${id}`)
    itemIds.add(id)
    if (!axisIds.has(str(it.axisId, `item ${id}.axisId`))) fail(`item ${id}: 알 수 없는 axisId`)
    const format = oneOf(it.format, FORMATS, `item ${id}.format`)
    str(it.text, `item ${id}.text`)
    oneOf(it.basis, BASES, `item ${id}.basis`)
    if (format === 'audience') oneOf(it.audience, AUDIENCES, `item ${id}.audience`)
    const options = arr(it.options, `item ${id}.options`)
    if (options.length < 2) fail(`item ${id}: 선택지는 2개 이상이어야 해요`)
    const optionIds = new Set<string>()
    for (const o of options) {
      if (!isObj(o)) fail(`item ${id}: option은 객체여야 해요`)
      const oid = str(o.id, `item ${id}.option.id`)
      if (optionIds.has(oid)) fail(`item ${id}: option id 중복 ${oid}`)
      optionIds.add(oid)
      str(o.label, `item ${id}.option ${oid}.label`)
      if (typeof o.value !== 'number' || !Number.isFinite(o.value) || o.value < 0 || o.value > 100)
        fail(`item ${id}: option ${oid}.value는 0~100이어야 해요`)
    }
    if (it.weight !== undefined && (typeof it.weight !== 'number' || !(it.weight > 0)))
      fail(`item ${id}.weight는 양수여야 해요`)
  }

  const raterIds = new Set<string>()
  for (const r of arr(raw.raterItems, 'raterItems')) {
    if (!isObj(r)) fail('raterItem은 객체여야 해요')
    const id = str(r.id, 'raterItem.id')
    if (raterIds.has(id)) fail(`raterItem id 중복: ${id}`)
    raterIds.add(id)
    const axis = axisIds.get(str(r.axisId, `raterItem ${id}.axisId`))
    if (!axis) fail(`raterItem ${id}: 알 수 없는 axisId`)
    if (!axis.observable) fail(`raterItem ${id}: 관찰 불가능한 축에는 둘 수 없어요`)
    oneOf(r.kind, KINDS, `raterItem ${id}.kind`)
    str(r.text, `raterItem ${id}.text`)
  }

  return raw as unknown as Bank
}
