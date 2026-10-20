import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DISTRICT_LOCATIONS, getDistrictLocation, RAMANAGARA_NAMING_NOTE } from '../config/districtLocations';
import PriorityBadge from './PriorityBadge';
import { score, percent, number } from './format';

function details(district, reference, row) {
  return `District reference location\n${district.name}\n${reference.label}\nPriority: ${row?.priorityLevel || 'INCOMPLETE'} · Score: ${score(row?.priorityScore)}\nJJM coverage: ${percent(row?.ruralFhtcCoverage)} · Rural WATER requests: ${number(row?.ruralWaterRequestCount)}`;
}
export function MapView({ points, selected, viewKey }) {
  const map = useMap(), previous = useRef(selected);
  useEffect(() => {
    map.fitBounds(points.map(p => [p.reference.latitude, p.reference.longitude]), { padding: [32, 32], maxZoom: 9, animate: false });
  }, [map, points]);
  useEffect(() => {
    const point = points.find(p => p.district.id === selected);
    if (previous.current !== selected && point) map.panTo([point.reference.latitude, point.reference.longitude], { animate: false });
    previous.current = selected;
  }, [map, points, selected]);
  useEffect(() => {
    const resize = () => map.invalidateSize({ pan: false });
    const frame = requestAnimationFrame(resize);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(map.getContainer());
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [map, viewKey]);
  return null;
}
export default function DistrictMap({ districts, rows, selected, onSelect, locations = DISTRICT_LOCATIONS, viewKey }) {
  const [tileError, setTileError] = useState(false);
  const points = useMemo(() => districts.map(district => ({ district, reference: getDistrictLocation(district, locations) })).filter(p => p.reference), [districts, locations]);
  const missing = districts.filter(d => !getDistrictLocation(d, locations));
  const district = districts.find(d => d.id === selected);
  const reference = district && getDistrictLocation(district, locations);
  const row = rows.find(r => r.districtId === selected);
  return <section className="district-map" aria-labelledby="map-title">
    <h3 id="map-title">District Map</h3>
    <p>Markers represent district headquarters/reference locations. They are not citizen complaint locations, infrastructure project locations, or exact district centroids.</p>
    {missing.length > 0 && <p className="notice">Geographic reference unavailable for: {missing.map(d => d.name).join(', ')}.</p>}
    {!points.length && <p className="notice">No verified district reference locations are available.</p>}
    {tileError && <p role="status">Map tiles are unavailable. District references and selection remain available.</p>}
    {points.length > 0 && <MapContainer className="map-canvas" center={[points[0].reference.latitude, points[0].reference.longitude]} zoom={7} minZoom={5} maxZoom={12} scrollWheelZoom={false}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'} eventHandlers={{ tileerror: () => setTileError(true), load: () => setTileError(false) }} />
      <MapView points={points} selected={selected} viewKey={viewKey} />
      {points.map(point => {
        const result = rows.find(r => r.districtId === point.district.id);
        const labels = { VERY_HIGH: 'VH', HIGH: 'H', MEDIUM: 'M', LOW: 'L' };
        const level = Object.hasOwn(labels, result?.priorityLevel) ? result.priorityLevel : 'INCOMPLETE';
        const active = selected === point.district.id;
        const icon = divIcon({ className: 'district-reference-icon', html: `<span class="reference-marker badge ${level.toLowerCase()}${active ? ' reference-selected' : ''}">${active ? '★ ' : ''}${labels[level] || '?'}</span>`, iconSize: [48, 28], iconAnchor: [24, 14] });
        return <Marker key={point.district.id} position={[point.reference.latitude, point.reference.longitude]} icon={icon} title={`${point.district.name} district reference location`} zIndexOffset={active ? 1000 : 0} eventHandlers={{ click: () => onSelect(point.district.id) }}>
          <Tooltip>{point.district.name}</Tooltip><Popup><p className="map-info">{details(point.district, point.reference, result)}</p>{point.district.name === 'Ramanagara' && <p>{RAMANAGARA_NAMING_NOTE}</p>}</Popup>
        </Marker>;
      })}
    </MapContainer>}
    {district && <div className="map-reference-panel" aria-label="Selected district map reference"><h4>Selected district reference</h4><p className="map-info">{details(district, reference || { label: 'Geographic reference unavailable' }, row)}</p>{district.name === 'Ramanagara' && <p>{RAMANAGARA_NAMING_NOTE} <a href="https://ramanagara.nic.in/en/history/" target="_blank" rel="noreferrer">District administration naming note</a></p>}</div>}
    <p className="fine">Map tiles and reference coordinates: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>. Headquarters/reference points only.</p>
    <div className="map-legend" aria-label="Prototype priority legend">{['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'].map(level => <PriorityBadge key={level} level={level} />)}</div>
    <p className="fine">Marker letters: VH = VERY_HIGH, H = HIGH, M = MEDIUM, L = LOW. A star and outline identify the selected district. Ranking buttons also select districts.</p>
  </section>;
}
