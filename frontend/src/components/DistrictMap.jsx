import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DISTRICT_LOCATIONS, getDistrictLocation, RAMANAGARA_NAMING_NOTE } from '../config/districtLocations';
import PriorityBadge from './PriorityBadge';
import { score, percent, number } from './format';

class MapErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">The district map could not be displayed. District Intelligence and the ranking remain available.</p> : this.props.children;
  }
}

// React Leaflet keeps MapContainer options immutable; synchronize selection through useMap.
function MapSelection({ points, selected }) {
  const map = useMap();
  const previous = useRef(selected);
  useEffect(() => {
    if (previous.current === selected) return;
    previous.current = selected;
    const point = points.find(p => p.district.id === selected);
    if (point) map.panTo([point.reference.latitude, point.reference.longitude], { animate: false });
  }, [selected, points, map]);
  useEffect(() => {
    const element = map.getContainer();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function ReferenceDetails({ district, reference, row }) {
  return <>
    <strong>District reference location</strong>
    <p>Dataset district: <strong>{district.name}</strong></p>
    <p>Reference: {reference?.label || 'Geographic reference unavailable'}</p>
    <p><PriorityBadge level={row?.priorityLevel} /> · Score: {score(row?.priorityScore)}</p>
    <p>JJM coverage: {percent(row?.ruralFhtcCoverage)} · Rural WATER requests: {number(row?.ruralWaterRequestCount)}</p>
    {district.name === 'Ramanagara' && district.state === 'Karnataka' && <p>{RAMANAGARA_NAMING_NOTE} <a href="https://ramanagara.nic.in/en/history/" target="_blank" rel="noreferrer">District administration naming note</a></p>}
  </>;
}

function markerIcon(level, selected) {
  const labels = { VERY_HIGH: 'VH', HIGH: 'H', MEDIUM: 'M', LOW: 'L' };
  const safeLevel = Object.hasOwn(labels, level) ? level : 'INCOMPLETE';
  return divIcon({
    className: 'reference-marker badge ' + safeLevel.toLowerCase() + (selected ? ' reference-selected' : ''),
    html: `<span>${selected ? '★ ' : ''}${labels[safeLevel] || '?'}</span>`,
    iconSize: [38, 32], iconAnchor: [19, 16], popupAnchor: [0, -18],
  });
}

export default function DistrictMap({ districts, rows, selected, onSelect, locations = DISTRICT_LOCATIONS }) {
  const [tileError, setTileError] = useState(false);
  const points = useMemo(() => districts.map(district => ({ district, reference: getDistrictLocation(district, locations) })).filter(p => p.reference), [districts, locations]);
  const missing = districts.filter(d => !getDistrictLocation(d, locations));
  const selectedDistrict = districts.find(d => d.id === selected);
  const bounds = points.map(p => [p.reference.latitude, p.reference.longitude]);
  // Remount only when the reference set changes, not on selection or analytics updates.
  const mapKey = points.map(p => `${p.district.id}:${p.reference.latitude}:${p.reference.longitude}`).join('|');
  return <section className="district-map" aria-labelledby="map-title">
    <h3 id="map-title">District Map</h3>
    <p>Markers represent district headquarters/reference locations. They are not citizen complaint locations, infrastructure project locations, or exact district centroids.</p>
    {missing.length > 0 && <p className="notice">Geographic reference unavailable for: {missing.map(d => d.name).join(', ')}. Only those markers are omitted.</p>}
    {tileError && <p className="notice" role="status">Some map tiles could not be loaded. Reference markers and district information remain available.</p>}
    {points.length ? <MapErrorBoundary key={mapKey}>
      <MapContainer className="map-canvas" bounds={bounds} boundsOptions={{ padding: [32, 32], maxZoom: 9 }} maxZoom={12} minZoom={5} scrollWheelZoom={false} aria-label="Karnataka district reference map">
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' keepBuffer={0} updateWhenIdle eventHandlers={{ tileerror: () => setTileError(true) }} />
        <MapSelection points={points} selected={selected} />
        {points.map(({ district, reference }) => {
          const row = rows.find(r => r.districtId === district.id);
          // Leaflet title options are immutable; dynamic status is shown in the icon and reference panel.
          const title = `${district.name} district reference location`;
          return <Marker key={district.id} position={[reference.latitude, reference.longitude]} icon={markerIcon(row?.priorityLevel, selected === district.id)} title={title} alt={title} keyboard zIndexOffset={selected === district.id ? 1000 : 0} eventHandlers={{ click: () => onSelect(district.id) }}>
            <Popup><ReferenceDetails district={district} reference={reference} row={row} /></Popup>
          </Marker>;
        })}
      </MapContainer>
    </MapErrorBoundary> : <p className="notice">Map unavailable. No verified district reference locations are available.</p>}
    <p className="fine">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · Headquarters/reference points only.</p>
    {selectedDistrict && <div className="map-reference-panel" aria-label="Selected district map reference"><h4>Selected district reference</h4><ReferenceDetails district={selectedDistrict} reference={getDistrictLocation(selectedDistrict, locations)} row={rows.find(r => r.districtId === selected)} /></div>}
    <div className="map-legend" aria-label="Prototype priority legend">{['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'].map(level => <PriorityBadge key={level} level={level} />)}</div>
    <p className="fine">Marker letters: VH = VERY_HIGH, H = HIGH, M = MEDIUM, L = LOW. A star and outline identify the selected district. Ranking buttons also select districts.</p>
  </section>;
}
