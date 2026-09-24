import { useEffect, useState } from 'react';
import { getDistrictRequests } from '../services/api';
export default function DistrictRequests({ districtId, revision }) {
  const [result, setResult] = useState({ status: 'loading', rows: [] }), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setResult({ status: 'loading', rows: [] });
    getDistrictRequests(districtId, controller.signal).then(rows => { if (!controller.signal.aborted) setResult({ status: 'ready', rows }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ status: 'error', rows: [] }); });
    return () => controller.abort();
  }, [districtId, revision, retry]);
  return <section className="request-context" aria-labelledby="history-title"><h3 id="history-title">Prototype Citizen Demand</h3><p>Prototype citizen-demand data · up to 5 most recent requests. Only rural WATER requests contribute to this analysis.</p>
    {result.status === 'loading' && <p role="status">Loading district request history...</p>}
    {result.status === 'error' && <p role="alert">Request history is unavailable. <button onClick={() => setRetry(n => n + 1)}>Retry request history</button></p>}
    {result.status === 'ready' && !result.rows.length && <p>No requests recorded for this district.</p>}
    <ul className="request-list">{result.rows.slice(0, 5).map(r => <li key={r.id}>
      <strong>{r.aiModel || r.aiProcessedAt ? 'AI-processed demonstration request' : r.originalText?.startsWith('[DEMO ONLY') ? 'Seeded synthetic demo request' : 'Prototype request · processing provenance unavailable'}</strong>
      <p className="request-tags">{r.category} {r.subcategory && '· ' + r.subcategory} · {r.urgency || 'Urgency unavailable'} · {r.areaType} · {r.language}</p>
      <p>{r.summaryEnglish || r.originalText}</p><small>{r.aiModel && 'AI model: ' + r.aiModel + ' · '}{Number.isNaN(Date.parse(r.createdAt)) ? 'Date unavailable' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(r.createdAt))}</small>
    </li>)}</ul>
  </section>;
}
