import type { Bank, Item, Option } from '../core/types'

/**
 * 양자택일의 낮은 쪽이 늘 첫 번째로 보이면, 첫 번째만 고르는 습관이 모든 축을 한쪽으로 기울인다.
 * 축마다 두 선택지 문항을 번갈아 뒤집어 보여 준다. 빈도 척도는 순서가 뜻이라 그대로 둔다.
 * 점수는 선택지의 value로 계산하므로 보이는 순서와 무관하다.
 */
export function optionFlips(bank: Bank): Set<string> {
  const flips = new Set<string>()
  const seen = new Map<string, number>()
  for (const item of bank.items) {
    if (item.format === 'frequency') continue
    const k = seen.get(item.axisId) ?? 0
    seen.set(item.axisId, k + 1)
    if (k % 2 === 1) flips.add(item.id)
  }
  return flips
}

export function displayOptions(item: Item, flips: ReadonlySet<string>): Option[] {
  return flips.has(item.id) ? [...item.options].reverse() : item.options
}
