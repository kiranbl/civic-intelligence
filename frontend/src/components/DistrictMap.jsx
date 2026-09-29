import { useEffect, useMemo, useRef, useState } from 'react';
import { DISTRICT_LOCATIONS, getDistrictLocation, RAMANAGARA_NAMING_NOTE } from '../config/districtLocations';
import { loadMaps, mapsConfig } from '../services/maps';
import PriorityBadge from './PriorityBadge';
import { score, percent, number } from './format';

function details(district, reference, row) {
  return `District reference location\n${district.name}\n${reference.label}\nPriority: ${row?.priorityLevel || 'INCOMPLETE'} · Score: ${score(row?.priorityScore)}\nJJM coverage: ${percent(row?.ruralFhtcCoverage)} · Rural WATER requests: ${number(row?.ruralWaterRequestCount)}`;
}
export default function DistrictMap({ districts, rows, selected, onSelect, locations = DISTRICT_LOCATIONS }) {
  const container = useRef(null), instance = useRef(null);
  const latest = useRef({ rows, selected, onSelect }); latest.current = { rows, selected, onSelect };
  const [status, setStatus] = useState('loading');
  const points = useMemo(() => districts.map(district => ({ district, reference: getDistrictLocation(district, locations) })).filter(p => p.reference), [districts, locations]);
  const missing = districts.filter(d => !getDistrictLocation(d, locations));
  const enabled = Boolean(mapsConfig.key && mapsConfig.mapId && points.length);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false, timer, state;
    setStatus('loading');
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Map load timeout')), 20000); });
    Promise.race([loadMaps(), timeout]).then(({ Map, AdvancedMarkerElement, InfoWindow, LatLngBounds }) => {
      if (cancelled) return;
      const map = new Map(container.current, { mapId: mapsConfig.mapId, center: { lat: points[0].reference.latitude, lng: points[0].reference.longitude }, zoom: 7,
        maxZoom: 9, minZoom: 5, gestureHandling: 'cooperative', mapTypeControl: false, streetViewControl: false });
      const info = new InfoWindow();
      state = { map, info, entries: [], previous: latest.current.selected };
      const bounds = new LatLngBounds();
      for (const point of points) {
        const position = { lat: point.reference.latitude, lng: point.reference.longitude };
        const node = document.createElement('span');
        const marker = new AdvancedMarkerElement({ map, position, title: `${point.district.name} district reference location` });
        marker.append(node);
        const listener = marker.addListener('click', () => {
          state.openDistrict = point.district.id;
          latest.current.onSelect(point.district.id);
          const content = document.createElement('div'); content.className = 'map-info';
          content.textContent = details(point.district, point.reference, latest.current.rows.find(r => r.districtId === point.district.id))
            + (point.district.name === 'Ramanagara' ? '\n' + RAMANAGARA_NAMING_NOTE : '');
          info.setContent(content); info.open({ map, anchor: marker });
        });
        state.entries.push({ ...point, marker, node, listener, position }); bounds.extend(position);
      }
      map.fitBounds(bounds, 32);
      state.idle = map.addListener('idle', () => { map.setOptions({ maxZoom: 12 }); state.idle?.remove(); });
      instance.current = state; setStatus('ready');
    }).catch(() => { if (!cancelled) setStatus('error'); }).finally(() => clearTimeout(timer));
    return () => {
      cancelled = true; clearTimeout(timer);
      state?.info.close(); state?.idle?.remove();
      state?.entries.forEach(({ marker, listener }) => { listener.remove(); marker.map = null; });
      instance.current = null;
    };
  }, [enabled, points]);
  useEffect(() => {
    const state = instance.current; if (!state || status !== 'ready') return;
    for (const entry of state.entries) {
      const level = rows.find(r => r.districtId === entry.district.id)?.priorityLevel;
      const labels = { VERY_HIGH: 'VH', HIGH: 'H', MEDIUM: 'M', LOW: 'L' };
      const safe = Object.hasOwn(labels, level) ? level : 'INCOMPLETE';
      const active = selected === entry.district.id;
      entry.node.className = `reference-marker badge ${safe.toLowerCase()}${active ? ' reference-selected' : ''}`;
      entry.node.textContent = `${active ? '★ ' : ''}${labels[safe] || '?'}`;
      entry.marker.zIndex = active ? 1000 : 0;
      if (active && state.previous !== selected) { if (state.openDistrict !== selected) state.info.close(); state.map.panTo(entry.position); }
    }
    state.previous = selected;
  }, [rows, selected, status]);
  const district = districts.find(d => d.id === selected);
  const reference = district && getDistrictLocation(district, locations);
  const row = rows.find(r => r.districtId === selected);
  return <section className="district-map" aria-labelledby="map-title">
    <h3 id="map-title">District Map</h3>
    <p>Markers represent district headquarters/reference locations. They are not citizen complaint locations, infrastructure project locations, or exact district centroids.</p>
    {!mapsConfig.key || !mapsConfig.mapId ? <p className="notice">Map unavailable. Configure the Google Maps browser API key and Map ID.</p> : null}
    {missing.length > 0 && <p className="notice">Geographic reference unavailable for: {missing.map(d => d.name).join(', ')}.</p>}
    {!points.length && <p className="notice">No verified district reference locations are available.</p>}
    {enabled && <>
      {status === 'loading' && <p role="status">Loading district map…</p>}
      {status === 'error' && <p role="alert">The map could not be loaded. District Intelligence and ranking remain available.</p>}
      <div className="map-canvas" ref={container} aria-label="Karnataka district reference map" hidden={status === 'error'} />
    </>}
    {district && <div className="map-reference-panel" aria-label="Selected district map reference"><h4>Selected district reference</h4>
      <p className="map-info">{details(district, reference || { label: 'Geographic reference unavailable' }, row)}</p>
      {district.name === 'Ramanagara' && <p>{RAMANAGARA_NAMING_NOTE} <a href="https://ramanagara.nic.in/en/history/" target="_blank" rel="noreferrer">District administration naming note</a></p>}
    </div>}
    <p className="fine">Reference coordinates: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>. Map imagery: Google. Headquarters/reference points only.</p>
    <div className="map-legend" aria-label="Prototype priority legend">{['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'].map(level => <PriorityBadge key={level} level={level} />)}</div>
    <p className="fine">Marker letters: VH = VERY_HIGH, H = HIGH, M = MEDIUM, L = LOW. A star and outline identify the selected district. Ranking buttons also select districts.</p>
  </section>;
}
