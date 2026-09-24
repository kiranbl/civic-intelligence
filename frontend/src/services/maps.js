import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
let configured = false;
export const mapsConfig = {
  key: import.meta.env?.VITE_GOOGLE_MAPS_API_KEY?.trim() || '',
  mapId: import.meta.env?.VITE_GOOGLE_MAPS_MAP_ID?.trim() || '',
};
export function hasCoordinates(d) {
  return Number.isFinite(d.latitude) && Math.abs(d.latitude) <= 90
    && Number.isFinite(d.longitude) && Math.abs(d.longitude) <= 180;
}
export async function loadMaps() {
  if (!configured) { setOptions({ key: mapsConfig.key, v: 'weekly' }); configured = true; }
  const [maps, marker, core] = await Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('core')]);
  return { Map: maps.Map, AdvancedMarkerElement: marker.AdvancedMarkerElement, LatLngBounds: core.LatLngBounds };
}
