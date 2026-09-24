import { useEffect, useState } from 'react';
import { loadDashboard } from '../services/api';
import { number } from '../components/format';
import PriorityTable from '../components/PriorityTable';
import DistrictDetail from '../components/DistrictDetail';
import DataMethodology from '../components/DataMethodology';
export default function Home() {
  const [data, setData] = useState(null), [status, setStatus] = useState('loading'), [revision, setRevision] = useState(0), [selected, setSelected] = useState(null);
  useEffect(() => {
    const controller = new AbortController(); setStatus('loading');
    loadDashboard(controller.signal).then(value => { if (!controller.signal.aborted) { setData(value); setSelected(value.analytics.data[0]?.districtId ?? null); setStatus('ready'); } }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [revision]);
  return <><header className="site-header"><div className="brand"><span className="brand-icon" aria-hidden="true">CI</span><div><h1>Civic Intelligence</h1><p>AI-assisted infrastructure planning from citizen demand and public data</p></div></div><span className={'connection ' + (status === 'ready' && data.connected ? 'online' : '')}><i />{status === 'loading' ? 'Checking connection…' : status === 'ready' && data.connected ? 'Backend connected' : 'Backend connection unavailable'}</span></header>
    <main><div className="intro"><div><p className="eyebrow">KARNATAKA · RURAL WATER</p><h2>Public data. Clearer priorities.</h2><p>Citizen demand + demographic context + infrastructure coverage</p></div><span className="prototype">PROTOTYPE / DEMONSTRATION</span></div>
    {status === 'loading' && <div className="card state" role="status">Loading civic infrastructure data...</div>}
    {status === 'error' && <div className="card state" role="alert"><h2>Data is temporarily unavailable</h2><p>We couldn't load the Civic Intelligence data. Check that the backend is running and try again.</p><button className="retry" onClick={() => setRevision(r => r + 1)}>Retry</button></div>}
    {status === 'ready' && <><section className="summary" aria-label="Dataset overview">{[
      ['Districts', number(data.districts.length), 'Districts in the dataset'], ['Citizen Requests', number(data.requestCount), 'Prototype citizen-demand dataset'], ['Demographic Context', '2011', 'Census of India'], ['Infrastructure Snapshot', '21 Sep 2026', 'Jal Jeevan Mission'],
    ].map(([label,value,note]) => <article className="card summary-card" key={label}><h3>{label}</h3><strong>{value}</strong><p>{note}</p></article>)}</section>
    {data.requestCount === null && <div className="notice" role="status">Some district requests could not be loaded. The total is unavailable. <button onClick={() => setRevision(r => r + 1)}>Retry data</button></div>}
    <section className="card ranking" aria-labelledby="ranking-title"><div className="section-heading"><div><p className="eyebrow">EXPLAINABLE PRIORITIES</p><h2 id="ranking-title">Rural Water Infrastructure Priority</h2><p>Prototype ranking combining citizen water demand with reported rural household tap-connection coverage.</p></div><span className="scope-label">Rural scope</span></div><PriorityTable rows={data.analytics.data} selected={selected} onSelect={setSelected} /><p className="table-note">Priority labels are prototype indicators, not official government classifications. Unavailable values are never treated as zero.</p></section>
    <DistrictDetail district={data.analytics.data.find(d => d.districtId === selected)} methodology={data.analytics.methodology} /></>}
    <DataMethodology /></main><footer>Civic Intelligence <span>Google Build with AI · Code for Communities</span></footer></>;
}
