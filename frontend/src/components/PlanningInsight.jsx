import { useEffect, useState } from 'react';
import { getWaterPlanning } from '../services/api';
import { number, score, percent } from './format';

export default function PlanningInsight({ districtId, revision }) {
  const [result, setResult] = useState({ status: 'loading', row: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ status: 'loading', row: null });
    getWaterPlanning(controller.signal).then(rows => {
      if (controller.signal.aborted) return;
      const row = rows.find(d => d.districtId === districtId);
      setResult({ status: row ? 'ready' : 'missing', row });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ status: 'error', row: null });
    });
    return () => controller.abort();
  }, [districtId, revision, retry]);
  const row = result.row;
  return <section className="planning-insight" aria-labelledby="planning-title">
    <p className="eyebrow">Prototype planning consideration</p>
    <h3 id="planning-title">Planning Insight</h3>
    <p><strong>Not an official government recommendation.</strong> Deterministic evidence rules, not a Gemini-generated recommendation.</p>
    {result.status === 'loading' && <p role="status">Loading planning evidence...</p>}
    {['error', 'missing'].includes(result.status) && <p role="status">{result.status === 'missing' ? 'Planning evidence is unavailable for this district.' : 'Planning insights could not be loaded. Other district information remains available.'} <button onClick={() => setRetry(n => n + 1)}>Retry planning</button></p>}
    {row && <>
      <p>Planning profile: <strong>{row.planningProfile.replaceAll('_', ' ')}</strong></p>
      <h4>Suggested planning consideration</h4><strong>{row.planningAction.title}</strong><p>{row.planningAction.description}</p>
      <h4>Why?</h4><ul>{row.rationale.map(item => <li key={item}>{item}</li>)}</ul>
      <h4>Evidence</h4><dl className="planning-evidence">
        <div><dt>Citizen demand index</dt><dd>{score(row.evidence.demandIndex)}</dd></div>
        <div><dt>Infrastructure gap</dt><dd>{score(row.evidence.infrastructureGap)}</dd></div>
        <div><dt>JJM coverage</dt><dd>{percent(row.evidence.ruralFhtcCoverage)}</dd></div>
        <div><dt>Rural water requests</dt><dd>{number(row.evidence.ruralWaterRequestCount)}</dd></div>
        <div><dt>Requests per 100k</dt><dd>{score(row.evidence.ruralWaterRequestsPer100k)}</dd></div>
      </dl>
      <details><summary>Limitations of this planning aid</summary><ul>{row.limitations.map(item => <li key={item}>{item}</li>)}</ul></details>
    </>}
  </section>;
}
