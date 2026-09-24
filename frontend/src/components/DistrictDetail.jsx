import PriorityBadge from './PriorityBadge';
import { number, score, percent } from './format';
export default function DistrictDetail({ district: d, methodology: m }) {
  if (!d) return null;
  const canCalculate = [d.demandIndex, d.infrastructureGap, m?.demandWeight, m?.infrastructureGapWeight].every(Number.isFinite);
  return <section className="detail card" aria-labelledby="detail-title">
    <div><p className="eyebrow">DISTRICT EXPLAINER</p><h2 id="detail-title">{d.districtName}</h2><p className="muted">{d.state} · <PriorityBadge level={d.priorityLevel} /></p>
      <dl className="detail-metrics">{[['Rural population', number(d.ruralPopulation)], ['Rural WATER requests', number(d.ruralWaterRequestCount)], ['Requests / 100k', score(d.ruralWaterRequestsPer100k)], ['JJM coverage', percent(d.ruralFhtcCoverage)], ['Infrastructure gap', score(d.infrastructureGap)], ['Demand index', score(d.demandIndex)], ['Priority score', score(d.priorityScore)]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </div><div className="calculation"><h3>How this score is calculated</h3><p>{m?.description || 'Methodology unavailable.'}</p>
      {canCalculate ? <><div className="equation"><span>Demand component</span><strong>{score(d.demandIndex)} × {m.demandWeight} = {score(d.demandIndex * m.demandWeight)}</strong></div><div className="equation"><span>Infrastructure component</span><strong>{score(d.infrastructureGap)} × {m.infrastructureGapWeight} = {score(d.infrastructureGap * m.infrastructureGapWeight)}</strong></div><div className="equation total"><span>Combined priority score</span><strong>{score(d.priorityScore)} <small>/ 100</small></strong></div><p className="fine">Components above use rounded display values; the backend calculates the final score at full precision.</p></> : <p>Insufficient data to explain a complete score. Missing values have not been estimated.</p>}
      <p className="fine">{m?.normalization}</p>
    </div>
  </section>;
}
