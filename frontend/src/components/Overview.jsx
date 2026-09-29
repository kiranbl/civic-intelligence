const label = value => value.charAt(0) + value.slice(1).toLowerCase();
export default function Overview({ data, onRetry, onExplore }) {
  const available = Number.isInteger(data?.totalRequests);
  const categories = available ? [...data.categoryBreakdown].sort((a, b) => b.count - a.count) : [];
  const most = categories[0]?.count ? categories.filter(r => r.count === categories[0].count).map(r => label(r.category)).join(', ') : 'None yet';
  return <><div className="intro"><div><p className="eyebrow">KARNATAKA · CIVIC DEMAND</p><h2>From citizen voices to development intelligence</h2><p>Civic Intelligence converts multilingual citizen requests into development intelligence.</p></div></div><p className="prototype">PROTOTYPE · Synthetic baseline and user submissions; not representative population evidence.</p>
    {!available ? <p role="alert">Citizen demand is temporarily unavailable. <button onClick={onRetry}>Retry citizen demand</button></p> : <>
      <section className="summary" aria-label="Dataset overview">{[['Total citizen requests', data.totalRequests], ['Districts represented', data.districtBreakdown.filter(d => d.totalRequests > 0).length], ['Most reported civic concern', most], ['High/Critical requests', data.urgencyBreakdown.filter(r => ['HIGH', 'CRITICAL'].includes(r.urgency)).reduce((n, r) => n + r.count, 0)]].map(([name, value]) => <article className="card summary-card" key={name}><h3>{name}</h3><strong>{value}</strong></article>)}</section>
      <section className="card"><h3>Reported civic concerns</h3><ul className="overview-categories">{categories.filter(r => r.count > 0).slice(0, 4).map(r => <li key={r.category}>{label(r.category)} <strong>{r.count} · {r.percentage}%</strong></li>)}</ul><button type="button" className="retry" onClick={onExplore}>Explore Citizen Demand</button></section>
      <section className="card"><h3>Recent request preview</h3><p className="fine">Metadata only; reported requests are not district performance measures.</p>{data.recentRequests.length ? <ul>{data.recentRequests.slice(0, 3).map(r => <li key={r.id}>{r.districtName} · {label(r.category)} · {label(r.areaType)}</li>)}</ul> : <p>No recent requests.</p>}</section>
    </>}</>;
}
