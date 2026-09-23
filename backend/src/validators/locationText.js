// Conservative MVP denylist, not a place-name recognizer. Match whole phrases only:
// never strip generic words out of a genuine name or invent a replacement.
const genericLocations = new Set([
  'village', 'our village', 'the village', 'locality', 'our locality', 'town', 'our town', 'area', 'our area',
  'गांव', 'गाँव', 'हमारे गांव', 'हमारे गाँव', 'इलाके', 'क्षेत्र',
  'ಗ್ರಾಮ', 'ಗ್ರಾಮದ', 'ನಮ್ಮ ಗ್ರಾಮ', 'ನಮ್ಮ ಗ್ರಾಮದ', 'ಊರು', 'ಪ್ರದೇಶ',
]);
export function sanitizeLocationText(value) {
  if (value === null) return null;
  const trimmed = value.trim();
  const comparison = trimmed.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '');
  return genericLocations.has(comparison) ? null : trimmed;
}
