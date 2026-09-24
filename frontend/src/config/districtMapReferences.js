// Application-authored labels, not Google-returned content. Follow README before adding IDs.
const targets = [
  ['Bengaluru Urban', 'Bengaluru headquarters city reference', null],
  ['Bengaluru Rural', 'Bengaluru Rural district office reference, Beerasandra, Devanahalli', null],
  ['Mysuru', 'Mysuru headquarters city reference', null],
  ['Mandya', 'Mandya headquarters city reference', null],
  ['Tumakuru', 'Tumakuru headquarters city reference', null],
  ['Hassan', 'Hassan headquarters city reference', null],
  ['Kolar', 'Kolar headquarters city reference', null],
  ['Ramanagara', 'Ramanagara headquarters reference', null],
];
export const DISTRICT_MAP_REFERENCES = targets.map(([districtName, mapReferenceLabel, mapPlaceId]) => ({
  districtName, state: 'Karnataka', mapPlaceId, mapReferenceLabel,
  mapReferenceType: 'DISTRICT_HEADQUARTERS', mapReferenceSource: 'Google Maps Place ID',
}));

export function validateMapReferences(references) {
  const seen = new Set(), ids = new Set();
  const fields = ['districtName', 'state', 'mapPlaceId', 'mapReferenceLabel', 'mapReferenceType', 'mapReferenceSource'];
  if (!Array.isArray(references) || references.length !== targets.length) throw new Error('Expected eight district map references');
  for (const row of references) {
    if (!row || Object.keys(row).some(key => !fields.includes(key))) throw new Error('Unexpected reference fields; do not store Google coordinates or content');
    if (!targets.some(([name]) => name === row.districtName) || row.state !== 'Karnataka') throw new Error('Unknown map reference district');
    if (seen.has(row.districtName)) throw new Error('Duplicate map reference district');
    seen.add(row.districtName);
    if (typeof row.mapReferenceLabel !== 'string' || !row.mapReferenceLabel.trim()
      || row.mapReferenceType !== 'DISTRICT_HEADQUARTERS' || row.mapReferenceSource !== 'Google Maps Place ID') throw new Error('Invalid map reference metadata');
    if (row.mapPlaceId !== null) {
      if (typeof row.mapPlaceId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(row.mapPlaceId)) throw new Error('Invalid Place ID format');
      if (ids.has(row.mapPlaceId)) throw new Error('Duplicate Place ID; review the selected references');
      ids.add(row.mapPlaceId);
    }
  }
  return references;
}
validateMapReferences(DISTRICT_MAP_REFERENCES);
// Exact dataset names only; no automatic/fuzzy search selection.
export function getMapReference(district, references = DISTRICT_MAP_REFERENCES) {
  return references.find(row => row.districtName === district.name && row.state === district.state) ?? null;
}
export const RAMANAGARA_NAMING_NOTE = 'Dataset name: Ramanagara. Current administrative name: Bengaluru South (renamed in 2025). Ramanagara remains the headquarters.';
