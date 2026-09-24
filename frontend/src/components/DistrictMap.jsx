import { useEffect, useMemo, useRef, useState } from 'react';
import { loadMaps, loadPlaces, mapsConfig, resolvePlaceLocation, withMapTimeout, MAP_LOAD_TIMEOUT_MS } from '../services/maps';
import { DISTRICT_MAP_REFERENCES, getMapReference, RAMANAGARA_NAMING_NOTE } from '../config/districtMapReferences';
import PriorityBadge from './PriorityBadge';
import { score, percent, number } from './format';

export default function DistrictMap({ districts, rows, selected, onSelect, references = DISTRICT_MAP_REFERENCES }) {
  const container = useRef(null), layer = useRef(null);
  const latest = useRef({ rows, selected, onSelect });
  latest.current = { rows, selected, onSelect };
  const [result, setResult] = useState({ status: 'loading', failed: [] });
  const [retry, setRetry] = useState(0);
  const entries = useMemo(() => districts.map(d => ({ district: d, reference: getMapReference(d, references) })), [districts, references]);
  const missing = entries.filter(e => !e.reference?.mapPlaceId);
  const selectedEntry = entries.find(e => e.district.id === selected);
  const analysis = rows.find(r => r.districtId === selected);
  const enabled = Boolean(mapsConfig.key && mapsConfig.mapId && missing.length < entries.length);

  function updateMarkers(pan = false) {
    if (!layer.current) return;
    const current = latest.current;
    for (const item of layer.current.markers) {
      const row = current.rows.find(r => r.districtId === item.id);
      const level = row?.priorityLevel || 'INCOMPLETE';
      item.element.className = 'district-marker badge ' + (['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'].includes(level) ? level.toLowerCase() : 'incomplete');
      item.element.classList.toggle('map-selected', item.id === current.selected);
      item.element.textContent = item.name + ' · ' + level;
      item.marker.zIndex = item.id === current.selected ? 2 : 1;
      item.marker.title = `${item.name} district headquarters reference; ${item.label}; ${level}; score ${score(row?.priorityScore)}; JJM coverage ${percent(row?.ruralFhtcCoverage)}; rural WATER requests ${number(row?.ruralWaterRequestCount)}`;
      if (pan && item.id === current.selected) layer.current.map.panTo(item.location);
    }
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const markers = [];
    function clearMarkers() {
      for (const item of markers) { item.marker.removeEventListener('gmp-click', item.click); item.marker.map = null; }
      layer.current = null;
    }
    const previousAuthFailure = window.gm_authFailure;
    const authFailure = () => { cancelled = true; clearMarkers(); setResult({ status: 'maps-error', failed: [] }); };
    window.gm_authFailure = authFailure;
    setResult({ status: 'loading', failed: [] });
    async function start() {
      let api, Place;
      try { api = await withMapTimeout(loadMaps(), MAP_LOAD_TIMEOUT_MS); }
      catch { if (!cancelled) setResult({ status: 'maps-error', failed: [] }); return; }
      if (cancelled) return;
      try { Place = await withMapTimeout(loadPlaces(), MAP_LOAD_TIMEOUT_MS); }
      catch { if (!cancelled) setResult({ status: 'places-error', failed: [] }); return; }
      if (cancelled) return;
      const candidates = entries.filter(e => e.reference?.mapPlaceId);
      const settled = await Promise.allSettled(candidates.map(async entry => ({
        ...entry, location: await resolvePlaceLocation(Place, entry.reference.mapPlaceId),
      })));
      if (cancelled) return;
      const points = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
      const failed = candidates.filter((_, i) => settled[i].status === 'rejected').map(e => e.district.name);
      if (!points.length) { setResult({ status: 'no-markers', failed }); return; }
      try {
        const bounds = new api.LatLngBounds();
        points.forEach(p => bounds.extend(p.location));
        const map = new api.Map(container.current, { mapId: mapsConfig.mapId, center: bounds.getCenter(), zoom: 7, maxZoom: 12, streetViewControl: false, mapTypeControl: false, gestureHandling: 'cooperative' });
        if (points.length > 1) map.fitBounds(bounds, 40);
        for (const { district: d, reference, location } of points) {
          const marker = new api.AdvancedMarkerElement({ map, position: location, title: `${d.name} district headquarters reference`, gmpClickable: true });
          const element = document.createElement('span');
          const click = () => latest.current.onSelect(d.id);
          markers.push({ id: d.id, name: d.name, label: reference.mapReferenceLabel, marker, element, location, click });
          marker.append(element);
          marker.addEventListener('gmp-click', click);
        }
        layer.current = { map, markers };
        updateMarkers(); // Fit the whole district set initially; pan only on selection.
        setResult({ status: 'ready', failed });
      } catch { clearMarkers(); if (!cancelled) setResult({ status: 'maps-error', failed }); }
    }
    start();
    return () => {
      cancelled = true; clearMarkers();
      if (window.gm_authFailure === authFailure) window.gm_authFailure = previousAuthFailure;
    };
  }, [entries, enabled, retry]);
  useEffect(() => { updateMarkers(true); }, [selected]);
  useEffect(() => { updateMarkers(); }, [rows]);

  return <section className="district-map" aria-labelledby="map-title">
    <h3 id="map-title">District Map</h3>
    <p>Map markers represent district headquarters/reference locations, not citizen complaint locations or exact district centroids.</p>
    <p className="fine">They are not infrastructure project locations. Reference locations are resolved at runtime from Google Place IDs.</p>
    {!mapsConfig.key && <p className="notice">Map unavailable. Configure the Google Maps API key to enable geographic view.</p>}
    {!mapsConfig.mapId && <p className="notice">Map unavailable. Configure a Google Maps Map ID to enable Advanced Markers.</p>}
    {missing.length > 0 && <p className="notice">Place IDs still needed for: {missing.map(e => e.district.name).join(', ')}. No reference locations have been invented.</p>}
    {enabled && <>
      {result.status === 'loading' && <p role="status">Resolving district reference locations...</p>}
      {result.status === 'maps-error' && <p role="alert">Google Maps could not be loaded. Check Maps configuration. District analysis is still available.</p>}
      {result.status === 'places-error' && <p role="alert">Places API is unavailable. Check Places API (New) access and key restrictions.</p>}
      {result.status === 'no-markers' && <p role="status">Map unavailable. No district reference locations could be resolved.</p>}
      {result.failed.length > 0 && <p className="notice">Place details unavailable for: {result.failed.join(', ')}. Other resolved references remain available.</p>}
      {(result.failed.length > 0 || ['maps-error', 'places-error'].includes(result.status)) && <button onClick={() => setRetry(n => n + 1)}>Retry map references</button>}
      <div className="map-canvas" ref={container} aria-label="Karnataka district headquarters reference map" hidden={result.status !== 'ready' && result.status !== 'loading'} />
    </>}
    {selectedEntry && <div className="map-reference-panel" aria-label="Selected district map reference">
      <h4>Selected headquarters/reference point</h4>
      <p>Dataset district: <strong>{selectedEntry.district.name}</strong></p>
      <p>Reference: {selectedEntry.reference?.mapReferenceLabel || 'Not configured'}</p>
      {!selectedEntry.reference?.mapPlaceId && <p>No Place ID configured for this reference.</p>}
      <p><PriorityBadge level={analysis?.priorityLevel} /> · Score: {score(analysis?.priorityScore)}</p>
      <p>JJM coverage: {percent(analysis?.ruralFhtcCoverage)} · Rural WATER requests: {number(analysis?.ruralWaterRequestCount)}</p>
      {selectedEntry.district.name === 'Ramanagara' && selectedEntry.district.state === 'Karnataka' && <p>{RAMANAGARA_NAMING_NOTE} <a href="https://ramanagara.nic.in/en/history/" target="_blank" rel="noreferrer">District administration naming note</a></p>}
    </div>}
    <div className="map-legend" aria-label="Prototype priority legend">{['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'].map(level => <PriorityBadge key={level} level={level} />)}</div>
    <p className="fine">Prototype levels, not official government classifications. The ranking buttons also select districts.</p>
  </section>;
}
