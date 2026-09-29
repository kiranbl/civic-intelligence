import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
export const mapsConfig = { key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '', mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '' };
let loading;
export function loadMaps() {
  if (!loading) {
    setOptions({ key: mapsConfig.key, v: 'weekly' });
    loading = Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('core')])
      .then(([maps, marker, core]) => ({ ...maps, ...marker, ...core }));
  }
  return loading;
}
