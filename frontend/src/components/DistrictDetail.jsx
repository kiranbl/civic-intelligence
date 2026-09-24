import PriorityBadge from './PriorityBadge';
import MetricBar from './MetricBar';
import DistrictMap from './DistrictMap';
import DistrictRequests from './DistrictRequests';
import { number, score, percent } from './format';
export default function DistrictDetail({ district: d, methodology: m, districts = [], rows = [], onSelect, revision }) {
  if (!d) return null;
  const canCalculate = [d.demandIndex, d.infrastructureGap, m?.demandWeight, m?.infrastructureGapWeight].every(Number.isFinite);
  const rank = rows.findIndex(r => r.districtId === d.districtId) + 1;
  return <section className="card intelligence" aria-labelledby="intelligence-title">
    <p className="eyebrow">SELECTED DISTRICT</p><h2 id="intelligence-title">District Intelligence</h2>
    <div className="intelligence-heading"><div><h3>{d.districtName}</h3><p>{d.state} · {d.dataCompleteness === 'COMPLETE' && rank > 0 ? 'Prototype rank ' + number(rank) : 'Rank unavailable — incomplete data'}</p></div><div><PriorityBadge level={d.priorityLevel} /> <strong>{score(d.priorityScore)} / 100</strong></div></div>
    <div className="intelligence-grid"><div>
      <div className="intelligence-metrics">
        <article><h3>Citizen Demand</h3><strong>{number(d.ruralWaterRequestCount)} rural WATER requests</strong><p>{score(d.ruralWaterRequestsPer100k)} requests / 100k</p><p>Demand index: {score(d.demandIndex)}</p></article>
        <article><h3>Infrastructure</h3><strong>{percent(d.ruralFhtcCoverage)} JJM rural tap coverage</strong><p>Infrastructure gap: {score(d.infrastructureGap)}</p></article>
        <article><h3>Demographics</h3><strong>{number(d.ruralPopulation)}</strong><p>Census rural population · reference year 2011</p></article>
        <article><h3>Data Freshness</h3><p>Census: <strong>2011</strong></p><p>JJM: <strong>21 Sep 2026</strong></p></article>
      </div>
      <div className="calculation"><h3>Why this district has this score</h3><p>{m?.description || 'Methodology unavailable.'}</p>
      {canCalculate ? <><div className="equation"><span>Demand contribution<br />{score(d.demandIndex)} × {m.demandWeight}</span><MetricBar value={d.demandIndex * m.demandWeight} kind="demand" /></div><div className="equation"><span>Infrastructure contribution<br />{score(d.infrastructureGap)} × {m.infrastructureGapWeight}</span><MetricBar value={d.infrastructureGap * m.infrastructureGapWeight} kind="gap" /></div><div className="equation total"><span>Final priority score<br /><small>Demand contribution + infrastructure contribution</small></span><strong>{score(d.priorityScore)}</strong></div><p className="fine">Components use rounded display values. The backend calculates the final score at full precision; displayed components may not sum exactly.</p></> : <p>Insufficient data to explain a complete score. Missing values have not been estimated.</p>}
      <h4>Relative demand note</h4><p>Demand index is normalized relative to the districts currently included. Adding requests to one district may change normalized demand scores for other districts.</p><p className="fine">{m?.normalization}</p></div>
    </div><DistrictMap districts={districts} rows={rows} selected={d.districtId} onSelect={onSelect} /></div>
    <div className="intelligence-bottom"><DistrictRequests key={d.districtId} districtId={d.districtId} revision={revision} /><section className="provenance"><h3>Data provenance & limitations</h3><dl>
      <dt>Demographic source</dt><dd>Census of India · Reference year: 2011</dd><dt>Infrastructure source</dt><dd>Jal Jeevan Mission · Snapshot: 21 Sep 2026</dd><dt>Citizen demand</dt><dd>Synthetic seeded requests + locally created AI demonstration requests</dd><dt>Analysis method</dt><dd>{m?.description || 'Prototype relative infrastructure-priority heuristic'}</dd>
    </dl><p>{m?.coverageData}</p><p>2011 population is historical context. Reported tap connections do not independently verify water-service functionality. Request records are demonstration data, not live public complaints.</p><strong>Not an official government ranking or policy recommendation.</strong></section></div>
  </section>;
}
