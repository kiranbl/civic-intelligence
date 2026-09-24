import { useEffect, useRef, useState } from 'react';
import { hasCoordinates, loadMaps, mapsConfig } from '../services/maps';
import PriorityBadge from './PriorityBadge';
import { score, percent, number } from './format';
export default function DistrictMap({ districts, rows, selected, onSelect }) {
  const container = useRef(null), layer = useRef(null), selection = useRef(selected);
  selection.current = selected;
  const [state, setState] = useState('loading'), [retry, setRetry] = useState(0);
  const missing = districts.filter(d => !hasCoordinates(d));
  function focus(id) {
    const current = layer.current;
    if (!current) return;
    for (const item of current.markers) {
      item.element.classList.toggle('map-selected', item.id === id);
      item.marker.zIndex = item.id === id ? 2 : 1;
    }
    const district = districts.find(d => d.id === id && hasCoordinates(d));
    // Keep the initial regional zoom; selection only pans to a verified point.
    if (district) current.map.panTo({ lat: district.latitude, lng: district.longitude });
  }
  useEffect(() => {
    const points = districts.filter(hasCoordinates);
    if (!mapsConfig.key || !mapsConfig.mapId || !points.length) return;
    let cancelled = false, markers = [];
    setState('loading');
    const timer = setTimeout(() => { if (!cancelled) { cancelled = true; setState('error'); } }, 20000);
    loadMaps().then(({ Map, AdvancedMarkerElement, LatLngBounds }) => {
      if (cancelled) return;
      const bounds = new LatLngBounds();
      points.forEach(d => bounds.extend({ lat: d.latitude, lng: d.longitude }));
      const map = new Map(container.current, { mapId: mapsConfig.mapId, center: bounds.getCenter(), zoom: 7, maxZoom: 12, streetViewControl: false, mapTypeControl: false, gestureHandling: 'cooperative' });
      if (points.length > 1) map.fitBounds(bounds, 40);
      markers = points.map(d => {
        const analysis = rows.find(r => r.districtId === d.id);
        const level = analysis?.priorityLevel || 'INCOMPLETE';
        const title = d.name + ': ' + level + '; score ' + score(analysis?.priorityScore) + '; JJM coverage ' + percent(analysis?.ruralFhtcCoverage) + '; rural water requests ' + number(analysis?.ruralWaterRequestCount);
        const element = document.createElement('span');
        element.className = 'district-marker badge ' + (['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'].includes(level) ? level.toLowerCase() : 'incomplete');
        element.textContent = d.name + ' · ' + level;
        const marker = new AdvancedMarkerElement({ map, position: { lat: d.latitude, lng: d.longitude }, title, gmpClickable: true });
        marker.append(element);
        const click = () => onSelect(d.id);
        marker.addEventListener('gmp-click', click);
        return { id: d.id, marker, element, click };
      });
      layer.current = { map, markers }; focus(selection.current); setState('ready'); clearTimeout(timer);
    }).catch(() => { if (!cancelled) setState('error'); clearTimeout(timer); });
    return () => { cancelled = true; clearTimeout(timer); for (const m of markers) { m.marker.removeEventListener('gmp-click', m.click); m.marker.map = null; } layer.current = null; };
  }, [districts, rows, onSelect, retry]);
  useEffect(() => { focus(selected); }, [selected]);
  const enabled = mapsConfig.key && mapsConfig.mapId && missing.length < districts.length;
  return <section className="district-map" aria-labelledby="map-title"><h3 id="map-title">District Map</h3><p className="fine">District-level analysis in Karnataka. Markers are not citizen or complaint locations.</p>
    {!mapsConfig.key ? <p className="notice">Map unavailable. Configure the Google Maps API key to enable geographic view.</p> : !mapsConfig.mapId ? <p className="notice">Map unavailable. Configure a Google Maps Map ID to enable Advanced Markers.</p> : null}
    {missing.length > 0 && <p className="notice">Verified district coordinates unavailable for: {missing.map(d => d.name).join(', ')}. No locations have been estimated.</p>}
    {missing.some(d => d.id === selected) && <p>The selected district has no verified map position.</p>}
    {enabled && <>{state === 'loading' && <p role="status">Loading district map...</p>}{state === 'error' && <p role="alert">Google Maps could not be loaded. District analysis is still available. <button onClick={() => setRetry(n => n + 1)}>Retry map</button></p>}<div className="map-canvas" ref={container} aria-label="Karnataka district analysis map" hidden={state === 'error'} /></>}
    <div className="map-legend" aria-label="Prototype priority legend">{['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'].map(level => <PriorityBadge key={level} level={level} />)}</div><p className="fine">Prototype levels, not official government classifications. Select districts using the ranking buttons at any time.</p>
  </section>;
}
