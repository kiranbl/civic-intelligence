const label = value => value.charAt(0) + value.slice(1).toLowerCase();
function Breakdown({ title, rows, field }) {
  return <section><h3>{title}</h3><ul className="demand-bars">{rows.map(row => <li key={row[field]}>
    <div><span>{label(row[field])}</span><strong>{row.count} <small>({row.percentage}%)</small></strong></div>
    <div className="demand-track" aria-hidden="true"><span style={{ width: `${row.percentage}%` }} /></div>
  </li>)}</ul></section>;
}
export default function CitizenDemand({ data, onRetry }) {
  const available = data && Number.isInteger(data.totalRequests);
  const most = available ? [...data.categoryBreakdown].sort((a, b) => b.count - a.count) : [];
  const mostReported = most[0]?.count ? most.filter(row => row.count === most[0].count).map(row => label(row.category)).join(', ') : 'None yet';
  return <section className="card citizen-demand" aria-labelledby="demand-title">
    <p className="eyebrow">ALL CIVIC CATEGORIES · URBAN + RURAL + UNKNOWN</p>
    <h2 id="demand-title">Citizen Demand Intelligence</h2>
    <p>Aggregates multilingual citizen requests across urban and rural communities to surface recurring civic concerns, including requests whose area type is unknown.</p>
    <p className="notice"><strong>Prototype citizen-request dataset.</strong> Baseline requests are synthetic demo data; this distribution does not represent Karnataka’s population. Official Census/JJM indicators are sourced data. Records are not labelled as demo or live submissions because the schema does not reliably distinguish them.</p>
    {!available ? <p role="alert">Citizen demand is temporarily unavailable. <button onClick={onRetry}>Retry citizen demand</button></p> : <>
      <div className="demand-summary">{[
        ['Total citizen requests', data.totalRequests], ['Represented districts', data.districtBreakdown.filter(d => d.totalRequests > 0).length],
        ['Most reported category', mostReported], ['High/Critical requests', data.urgencyBreakdown.filter(r => ['HIGH', 'CRITICAL'].includes(r.urgency)).reduce((n, r) => n + r.count, 0)],
      ].map(([name, value]) => <article key={name}><h3>{name}</h3><strong>{value}</strong></article>)}</div>
      {data.totalRequests === 0 && <p>No citizen requests yet.</p>}
      <div className="demand-grid"><Breakdown title="Civic concerns" rows={data.categoryBreakdown} field="category" />
        <Breakdown title="Area type" rows={data.areaTypeBreakdown} field="areaType" />
        <Breakdown title="Urgency" rows={data.urgencyBreakdown} field="urgency" />
        <section><h3>District demand</h3><p className="fine">Reported requests · raw volume, not a district performance score</p><ul className="demand-bars">{data.districtBreakdown.map(d => <li key={d.districtId}><div><span>{d.districtName}</span><strong>{d.totalRequests}</strong></div></li>)}</ul></section>
      </div>
      {data.recentRequests.length > 0 && <section><h3>Recent citizen requests</h3><p className="fine">Metadata only; request text and locations are omitted for privacy.</p><ul className="demand-recent">{data.recentRequests.map(r => <li key={r.id}><strong>{r.districtName}</strong> · {label(r.category)} · {label(r.areaType)} · {r.urgency ? label(r.urgency) : 'Unspecified'} urgency <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</time></li>)}</ul></section>}
      <p className="fine">Counts include every area type and civic category. Percentages use all requests as the denominator; rounding may prevent totals of exactly 100%. No weighted priority scores are assigned here.</p>
    </>}
  </section>;
}
