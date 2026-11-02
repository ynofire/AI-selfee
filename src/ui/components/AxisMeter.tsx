import type { Axis } from '../../core/types'

/** 두 끝 사이의 위치. 지인의 평가가 있으면 속이 빈 표시로 함께 보여 준다(색에만 기대지 않는다). */
export function AxisMeter({ axis, score, otherScore }: { axis: Axis; score: number; otherScore?: number | null }) {
  const label =
    `${axis.name}: ${axis.low}에서 ${axis.high} 쪽으로 ${score}/100` +
    (otherScore != null ? `, 지인이 본 모습 ${otherScore}/100` : '')
  return (
    <>
      <div className="meter" role="img" aria-label={label}>
        <div className="meter-marker" style={{ left: `${score}%` }} />
        {otherScore != null && <div className="meter-marker other" style={{ left: `${otherScore}%` }} />}
      </div>
      <div className="meter-ends">
        <span>{axis.low}</span>
        <span>{axis.high}</span>
      </div>
    </>
  )
}
