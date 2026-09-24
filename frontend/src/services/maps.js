import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
let configured = false;
export const mapsConfig = {
  key: import.meta.env?.VITE_GOOGLE_MAPS_API_KEY?.trim() || '',
  mapId: import.meta.env?.VITE_GOOGLE_MAPS_MAP_ID?.trim() || '',
};
// Require a real project Map ID; no silent development fallback.
export async function loadMaps() {
  if (!configured) { setOptions({ key: mapsConfig.key, v: 'weekly' }); configured = true; }
  const [maps, marker, core] = await Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('core')]);
  return { Map: maps.Map, AdvancedMarkerElement: marker.AdvancedMarkerElement, LatLngBounds: core.LatLngBounds };
}

export async function loadPlaces() {
  const { Place } = await importLibrary('places');
  return Place;
}
export const MAP_LOAD_TIMEOUT_MS = 20000;
export const PLACE_DETAILS_TIMEOUT_MS = 10000;
export async function withMapTimeout(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Map operation timed out')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
export async function resolvePlaceLocation(Place, id) {
  const place = new Place({ id });
  // Our curated metadata supplies labels; rendering needs only location.
  await withMapTimeout(place.fetchFields({ fields: ['location'] }), PLACE_DETAILS_TIMEOUT_MS);
  const location = place.location;
  if (!location || !Number.isFinite(location.lat()) || !Number.isFinite(location.lng())
    || Math.abs(location.lat()) > 90 || Math.abs(location.lng()) > 180) throw new Error('Place location unavailable');
  return location; // In-memory only: never localStorage, files or database.
}
