import PriorityBadge from './PriorityBadge';
import MetricBar from './MetricBar';
import { number, score, percent } from './format';
export default function PriorityTable({ rows, selected, onSelect }) {
  if (!rows.length) return <div className="empty">No district analysis is available yet. Add the required district data in the backend to begin.</div>;
  return <div className="table-scroll" tabIndex="0" role="region" aria-label="District priorities, scroll horizontally for all metrics"><table>
    <caption>District ranking · Select a district to explore its score</caption>
    <thead><tr>{['Rank', 'District / State', 'Rural population', 'Rural water requests', 'Requests / 100k', 'JJM coverage', 'Infrastructure gap', 'Demand index', 'Priority score', 'Priority level'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
    <tbody>{rows.map((d, i) => <tr key={d.districtId} className={selected === d.districtId ? 'selected' : ''}>
      <td className="rank">{d.dataCompleteness === 'COMPLETE' ? number(i + 1) : '—'}</td>
      <th scope="row"><button className="district-button" aria-pressed={selected === d.districtId} onClick={() => onSelect(d.districtId)}>{d.districtName}</button><small>{d.state}</small>{d.dataCompleteness !== 'COMPLETE' && <small>Incomplete data</small>}</th>
      <td>{number(d.ruralPopulation)}</td><td>{number(d.ruralWaterRequestCount)}</td><td>{score(d.ruralWaterRequestsPer100k)}</td><td>{percent(d.ruralFhtcCoverage)}</td>
      <td><MetricBar value={d.infrastructureGap} kind="gap" /></td><td><MetricBar value={d.demandIndex} kind="demand" /></td><td className="priority-score">{score(d.priorityScore)}</td><td><PriorityBadge level={d.priorityLevel} /></td>
    </tr>)}</tbody>
  </table></div>;
}
