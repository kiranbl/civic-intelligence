import { readFileSync } from 'node:fs';
import { normalizeSettlementName as normalize, DISTRICT_NAMES, MUNICIPAL_LOCALITIES } from '../config/settlementNames.js';
import { SETTLEMENT_FUZZY as policy, settlementSimilarity } from '../config/settlementSimilarity.js';

// Compact spacing only for lookup; canonical registry names are never changed.
const key = name => normalize(name).replaceAll(' ', '');
const empty = () => ({ areaType: 'UNKNOWN', method: 'UNRESOLVED', matchedCanonicalName: null, matchedSettlementCode: null, candidateCount: 0, similarityScore: null });
function consensus(candidates, method, similarityScore = null) {
  const result = { ...empty(), candidateCount: candidates.length, similarityScore };
  const types = new Set(candidates.map(row => row.settlementType));
  if (types.size !== 1 || !['RURAL', 'URBAN'].includes([...types][0])) return result;
  return { ...result, areaType: [...types][0], method: candidates.length > 1 ? 'CENSUS_TYPE_CONSENSUS' : method,
    matchedCanonicalName: candidates.length === 1 ? candidates[0].canonicalSettlementName ?? null : null,
    matchedSettlementCode: candidates.length === 1 ? candidates[0].settlementCode : null };
}
export function buildSettlementResolver(registry) {
  const districts = new Map(registry.districts.map(d => [normalize(d.name), d.code]));
  for (const [current, historical] of Object.entries(DISTRICT_NAMES)) {
    if (districts.has(normalize(historical))) districts.set(normalize(current), districts.get(normalize(historical)));
  }
  const byDistrict = new Map();
  for (const row of registry.records) {
    const records = byDistrict.get(row.censusDistrictCode) ?? new Map();
    const existing = records.get(row.settlementCode);
    const names = [row.canonicalSettlementName ?? row.normalizedSettlementName, ...(row.aliases ?? [])].map(key).filter(Boolean);
    if (existing) names.push(...existing.names);
    records.set(row.settlementCode, { ...row, names: new Set(names) });
    byDistrict.set(row.censusDistrictCode, records);
  }
  function explain(analysis, district) {
    if (['RURAL', 'URBAN'].includes(analysis.areaType)) return { ...empty(), areaType: analysis.areaType, method: 'AI_EXPLICIT' };
    if (normalize(district?.state) !== 'karnataka') return empty();
    const districtName = normalize(district.name);
    // A district split is not a spelling alias; no verified boundary crosswalk supplied.
    if (districtName === 'vijayanagara') return empty();
    const code = districts.get(districtName);
    if (!code) return empty();
    const names = [...new Set([analysis.locationText, analysis.locationTextLatin].map(key).filter(Boolean))];
    if (!names.length) return empty();
    const municipal = MUNICIPAL_LOCALITIES.filter(row => districts.get(normalize(row.district)) === code && names.includes(key(row.name)));
    if (municipal.length) return { ...empty(), areaType: 'URBAN', method: 'MUNICIPAL_OVERRIDE', matchedCanonicalName: municipal.length === 1 ? municipal[0].name : null, candidateCount: municipal.length };
    const records = [...(byDistrict.get(code)?.values() ?? [])];
    const exact = records.filter(row => names.some(name => row.names.has(name)));
    if (exact.length) return consensus(exact, 'CENSUS_EXACT');
    const ranked = [];
    for (const row of records) {
      let best = 0;
      for (const name of names) for (const candidate of row.names) {
        // Fuzzy comparisons are Latin-only; the supplied romanization is a hint,
        // not authority. Avoid weak matches, especially short names/shared suffixes.
        if (!/^[a-z]+$/.test(name) || !/^[a-z]+$/.test(candidate) || Math.min(name.length, candidate.length) < policy.minimumLength
          || name[0] !== candidate[0] || Math.abs(name.length - candidate.length) > policy.maximumEdits) continue;
        const similarity = settlementSimilarity(name, candidate);
        // Two substitutions in equal-length names can change the locality
        // entirely (Uttarahalli/Upparahalli). Allow only one in that case.
        const maximumEdits = name.length === candidate.length ? 1 : policy.maximumEdits;
        if (similarity.distance <= maximumEdits) best = Math.max(best, similarity.score);
      }
      if (best) ranked.push({ row, score: best });
    }
    ranked.sort((a, b) => b.score - a.score || a.row.settlementCode.localeCompare(b.row.settlementCode));
    const best = ranked[0];
    if (!best || best.score < policy.minimumSimilarity) return empty();
    // A close runner-up cannot be ignored simply because it narrowly misses
    // the acceptance threshold. Consensus may classify type, never identity.
    const contenders = ranked.filter(r => r.score >= policy.minimumSimilarity || best.score - r.score < policy.identityMargin);
    return consensus(contenders.map(r => r.row), 'CENSUS_FUZZY', best.score);
  }
  function resolve(analysis, district) {
    const result = explain(analysis, district);
    return result.areaType === analysis.areaType ? analysis : { ...analysis, areaType: result.areaType };
  }
  // Internal audit API: normal HTTP responses contain no resolver diagnostics.
  resolve.explain = explain;
  return resolve;
}
let resolver;
export function resolveSettlement(analysis, district) {
  if (analysis.areaType !== 'UNKNOWN' || !district || (!analysis.locationText && !analysis.locationTextLatin)) return analysis;
  if (!resolver) {
    const registry = JSON.parse(readFileSync(new URL('../../data/processed/census2011-karnataka-settlements.json', import.meta.url), 'utf8'));
    if (registry.sourceYear !== 2011 || registry.censusStateCode !== '29' || registry.districts.length !== 30) throw Error('Invalid settlement registry');
    resolver = buildSettlementResolver(registry);
  }
  return resolver(analysis, district);
}
