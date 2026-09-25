// Verified against OpenStreetMap on 2026-09-25. Reference points only, never complaints.
// OSM data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright
export const DISTRICT_LOCATIONS = {
  'Bengaluru Urban': { label: 'Bengaluru city reference', latitude: 12.9767936, longitude: 77.5900820, osm: 'relation/7902476' },
  'Bengaluru Rural': { label: 'Devanahalli DC Office administrative reference', latitude: 13.2809804, longitude: 77.6227856, osm: 'way/1193268145' },
  Mysuru: { label: 'Mysuru city reference', latitude: 12.3051828, longitude: 76.6553609, osm: 'node/2068274800' },
  Mandya: { label: 'Mandya city reference', latitude: 12.5238888, longitude: 76.8961961, osm: 'node/652721136' },
  Tumakuru: { label: 'Tumakuru city reference', latitude: 13.3400771, longitude: 77.1006208, osm: 'node/571400151' },
  Hassan: { label: 'Hassan city reference', latitude: 13.0070817, longitude: 76.0992703, osm: 'node/340748436' },
  Kolar: { label: 'Kolar city reference', latitude: 13.1367201, longitude: 78.1337246, osm: 'node/245618507' },
  Ramanagara: { label: 'Ramanagara headquarters reference', latitude: 12.7252766, longitude: 77.2804797, osm: 'node/245609255' },
};
for (const reference of Object.values(DISTRICT_LOCATIONS)) {
  reference.referenceType = 'DISTRICT_HEADQUARTERS';
  reference.source = 'OpenStreetMap';
  reference.sourceUrl = 'https://www.openstreetmap.org/' + reference.osm;
  reference.verifiedAt = '2026-09-25';
  Object.freeze(reference);
}
Object.freeze(DISTRICT_LOCATIONS);
export function getDistrictLocation(district, locations = DISTRICT_LOCATIONS) {
  if (district.state !== 'Karnataka' || !Object.hasOwn(locations, district.name)) return null;
  const r = locations[district.name];
  return r && Number.isFinite(r.latitude) && Math.abs(r.latitude) <= 90
    && Number.isFinite(r.longitude) && Math.abs(r.longitude) <= 180 ? r : null;
}
export const RAMANAGARA_NAMING_NOTE = 'Dataset name: Ramanagara. Current administrative name: Bengaluru South / Bangalore South (renamed in 2025). Ramanagara remains the headquarters.';
