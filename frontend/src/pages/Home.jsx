import { useEffect, useRef, useState } from 'react';
import { loadDashboard } from '../services/api';
import CitizenDemand from '../components/CitizenDemand';
import CitizenRequestForm from '../components/CitizenRequestForm';
import PriorityTable from '../components/PriorityTable';
import DistrictDetail from '../components/DistrictDetail';
import DistrictMap from '../components/DistrictMap';
import DataMethodology from '../components/DataMethodology';
import Overview from '../components/Overview';

const views = ['Overview', 'Citizen Demand', 'Rural Water', 'District Intelligence', 'Submit Request', 'Methodology'];
export default function Home() {
  const [data, setData] = useState(null), [status, setStatus] = useState('loading'), [revision, setRevision] = useState(0), [selected, setSelected] = useState(null);
  const [refreshError, setRefreshError] = useState(false);
  const [active, setActive] = useState(0);
  const content = useRef(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  useEffect(() => { if (content.current) content.current.scrollTop = 0; }, [active]);
  const [visited, setVisited] = useState([0]);
  function activate(index) { setActive(index); setVisited(previous => previous.includes(index) ? previous : [...previous, index]); }
  function navigate(event, index) {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : event.key === 'ArrowRight' ? (index + 1) % views.length : event.key === 'ArrowLeft' ? (index + views.length - 1) % views.length : null;
    if (next === null) return;
    event.preventDefault(); activate(next); document.getElementById(`view-tab-${next}`).focus();
  }
  useEffect(() => {
    const controller = new AbortController(); setStatus(previous => previous === 'ready' ? 'ready' : 'loading'); setRefreshError(false);
    loadDashboard(controller.signal).then(value => { if (!controller.signal.aborted) { setData(value); setSelected(previous => value.analytics.data.some(d => d.districtId === previous) ? previous : value.analytics.data[0]?.districtId ?? null); setStatus('ready'); } }).catch(() => { if (!controller.signal.aborted) { setRefreshError(true); setStatus(previous => previous === 'ready' ? 'ready' : 'error'); } });
    return () => controller.abort();
  }, [revision]);
  const retry = () => setRevision(r => r + 1);
  return <div className="dashboard-shell"><header className="site-header"><div className="brand"><span className="brand-icon" aria-hidden="true">CI</span><div><h1>Civic Intelligence</h1><p>Citizen demand and public data</p></div></div><span className={'connection ' + (status === 'ready' && data.connected ? 'online' : '')}><i />{status === 'loading' ? 'Checking connection…' : status === 'ready' && data.connected ? 'Backend connected' : 'Backend connection unavailable'}</span></header>
    <nav aria-label="Dashboard views"><div className="dashboard-tabs" role="tablist" aria-label="Civic Intelligence views">{views.map((name, index) => <button key={name} id={`view-tab-${index}`} role="tab" aria-selected={active === index} aria-controls="active-view" tabIndex={active === index ? 0 : -1} onClick={() => activate(index)} onKeyDown={event => navigate(event, index)}>{name}</button>)}</div></nav>
    <main ref={content} id="active-view" role="tabpanel" aria-labelledby={`view-tab-${active}`} tabIndex={0}>
      {voiceBusy && active !== 4 && <p className="notice" role="status">Voice recording or transcription is active. <button onClick={() => activate(4)}>Return to voice controls</button></p>}
      {status === 'loading' && <div className="card state" role="status">Loading civic infrastructure data...</div>}
      {status === 'error' && <div className="card state" role="alert"><h2>Data is temporarily unavailable</h2><p>Check that the backend is running and try again.</p><button onClick={retry}>Retry</button></div>}
      {status === 'ready' && <>
        {data.districtsFailed && <div className="notice" role="alert">District details could not be loaded. <button onClick={retry}>Retry districts</button></div>}
        {refreshError && <div className="notice" role="alert">Dashboard refresh failed. Your submitted request has not been resubmitted. <button onClick={retry}>Retry dashboard refresh</button></div>}
        <div className={`view-layout view-${active}`}>
          <div hidden={active !== 0} className="overview-content"><Overview data={data.citizenDemand} onRetry={retry} onExplore={() => activate(1)} /></div>
          {/* One map instance survives view changes; the existing loader and selection logic are unchanged. */}
          <div className="shared-map card" hidden={active !== 0 && active !== 3}><DistrictMap districts={data.districts} rows={data.analytics.data} selected={selected} onSelect={setSelected} /></div>
          <div hidden={active !== 1}>{visited.includes(1) && <CitizenDemand data={data.citizenDemand} onRetry={retry} />}</div>
          <div hidden={active !== 2} className="water-ranking"><section className="card ranking" aria-labelledby="ranking-title"><p className="eyebrow">EXPLAINABLE PRIORITIES · RURAL SCOPE</p><h2 id="ranking-title">Rural Water Evidence Analysis</h2><p>Only rural WATER requests contribute to this score because the JJM infrastructure indicator used here measures rural household tap-water coverage. Urban water requests remain included in Citizen Demand Intelligence.</p>{data.analyticsFailed && <p className="notice" role="alert">Water-priority analytics could not be loaded. <button onClick={retry}>Retry analytics</button></p>}<PriorityTable rows={data.analytics.data} selected={selected} onSelect={setSelected} /><p className="table-note">Prototype indicators, not official government classifications. Missing values are never treated as zero.</p></section></div>
          <div className="shared-detail" hidden={active !== 2 && active !== 3}>
            <label htmlFor="explore-district">Explore district</label><select className="civic-select" id="explore-district" value={selected ?? ''} onChange={event => setSelected(Number(event.target.value))}>{data.analytics.data.map(d => <option key={d.districtId} value={d.districtId}>{d.districtName}</option>)}</select>
            {(visited.includes(2) || visited.includes(3)) && <DistrictDetail district={data.analytics.data.find(d => d.districtId === selected)} methodology={data.analytics.methodology} districts={data.districts} rows={data.analytics.data} onSelect={setSelected} revision={revision} mode={active === 3 ? 'geography' : 'water'} />}
          </div>
          <div hidden={active !== 4}>{visited.includes(4) && !data.districtsFailed && <CitizenRequestForm districts={data.districts} onSubmitted={retry} onVoiceBusyChange={setVoiceBusy} />}</div>
        </div>
      </>}
      <div hidden={active !== 5}><DataMethodology /></div>
    </main><footer>Civic Intelligence <span>Google Build with AI · Code for Communities</span><small>Built by Kiran Bhaskaran Lakshman</small></footer></div>;
}
