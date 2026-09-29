// Exact normalization only. Preserve letters/marks in every script; no transliteration.
export const normalizeSettlementName = value => typeof value === 'string'
  ? value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, ' ').trim() : '';

// Remove only inspected Census administrative suffixes, not arbitrary parenthetical place names.
export const censusTownBaseName = value => value.replace(/\s*\((?:M Corp\.|CMC|TMC|TP|CT|NAC|CB)(?: \+ OG)?\)(?:\s*\(Part\))?\s*$/i, '').trim();

// Name reconciliation, not a boundary crosswalk. Existing Census aliases plus
// MHA's 2014 naming list: https://www.mha.gov.in/MHA1/Par2017/pdfs/par2014-pdfs/ls-161214/3797.pdf
export const DISTRICT_NAMES = {
  'Bengaluru Urban': 'Bangalore', 'Bengaluru Rural': 'Bangalore Rural', Mysuru: 'Mysore', Tumakuru: 'Tumkur',
  Belagavi: 'Belgaum', Vijayapura: 'Bijapur', Kalaburagi: 'Gulbarga', Ballari: 'Bellary',
  Shivamogga: 'Shimoga', Chikkamagaluru: 'Chikmagalur',
};

// Separately sourced municipal localities, NOT Census town records.
// BBMP zonal classification lists Jayanagar and ward 184 Uttarahalli:
// https://site.bbmp.gov.in/zonalclassification.html
export const MUNICIPAL_LOCALITIES = [
  { district: 'Bangalore', name: 'Uttarahalli', settlementType: 'URBAN', source: 'BBMP zonal classification', sourceUrl: 'https://site.bbmp.gov.in/zonalclassification.html' },
  { district: 'Bangalore', name: 'Jayanagar', settlementType: 'URBAN', source: 'BBMP zonal classification', sourceUrl: 'https://site.bbmp.gov.in/zonalclassification.html' },
];
