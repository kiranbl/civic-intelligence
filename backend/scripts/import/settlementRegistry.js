import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSettlementRows } from './settlementWorkbook.js';
import { normalizeSettlementName, censusTownBaseName } from '../../src/config/settlementNames.js';

export async function extractSettlements(rows, type) {
  const expectedLevel = type === 'RURAL' ? 'VILLAGE' : 'TOWN';
  const expectedTru = type === 'RURAL' ? 'Rural' : 'Urban';
  const districts = new Map(), subdistricts = new Map(), records = [], codes = new Set();
  const levels = new Set();
  for await (const row of rows) {
    if (row.State !== '29') continue;
    levels.add(row.Level);
    if (row.Level === 'DISTRICT' && row.TRU === 'Total') {
      if (districts.has(row.District)) throw Error('Duplicate district parent');
      districts.set(row.District, row.Name);
    }
    if (row.Level === 'SUB-DISTRICT' && row.TRU === 'Total') {
      const key = `${row.District}/${row.Subdistt}`;
      if (subdistricts.has(key)) throw Error('Duplicate subdistrict parent');
      subdistricts.set(key, row.Name);
    }
    if (['TOWN', 'VILLAGE'].includes(row.Level) && row.Level !== expectedLevel) throw Error('Wrong settlement source type');
    if (row.Level !== expectedLevel) continue;
    if (row.TRU !== expectedTru || !/^0+$/.test(row.Ward) || !/^0+$/.test(row.EB)
      || !/^[0-9]{6}$/.test(row['Town/Village']) || /^0+$/.test(row['Town/Village'])
      || !/^[0-9]{3}$/.test(row.District) || !/^[0-9]{5}$/.test(row.Subdistt) || !normalizeSettlementName(row.Name)) throw Error('Invalid settlement geography');
    const identity = type === 'RURAL' ? row['Town/Village'] : `${row.District}/${row.Subdistt}/${row['Town/Village']}/${row.Name}`;
    if (codes.has(identity)) throw Error('Duplicate settlement row');
    codes.add(identity);
    records.push({ censusStateCode: '29', censusDistrictCode: row.District, censusSubDistrictCode: row.Subdistt,
      settlementCode: row['Town/Village'], canonicalSettlementName: row.Name,
      normalizedSettlementName: normalizeSettlementName(row.Name), settlementType: type,
      aliases: type === 'URBAN' && censusTownBaseName(row.Name) !== row.Name ? [censusTownBaseName(row.Name)] : [] });
  }
  if (!records.length) throw Error('No Karnataka settlement records');
  for (const record of records) {
    record.censusDistrictName = districts.get(record.censusDistrictCode);
    record.censusSubDistrictName = subdistricts.get(`${record.censusDistrictCode}/${record.censusSubDistrictCode}`);
    if (!record.censusDistrictName || !record.censusSubDistrictName) throw Error('Missing geographic parent');
  }
  return { records, districts, levels: [...levels] };
}

async function sha256(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
export async function importSettlements({ dryRun = false } = {}) {
  const raw = new URL('../../data/raw/census-settlements/', import.meta.url);
  const sources = [], records = []; let districtMap;
  for (const [name, type] of [['2011-IndiaStateDistSbDistVill-0000.xlsx', 'RURAL'], ['2011-IndiaStateDistSbDistTwn-0000.xlsx', 'URBAN']]) {
    const file = fileURLToPath(new URL(name, raw)); const before = await sha256(file);
    const extracted = await extractSettlements(readSettlementRows(file), type);
    if (extracted.districts.size !== 30) throw Error('Expected 30 historical Karnataka districts');
    const entries = [...extracted.districts].sort();
    if (districtMap && JSON.stringify(entries) !== JSON.stringify(districtMap)) throw Error('District sources disagree');
    districtMap = entries;
    if (before !== await sha256(file)) throw Error('Source changed during import');
    sources.push({ file: name, sha256: before, settlementType: type, records: extracted.records.length }); records.push(...extracted.records);
    console.log(JSON.stringify({ file: name, records: extracted.records.length, levels: extracted.levels }));
  }
  const codes = new Map();
  for (const row of records) {
    const previous = codes.get(row.settlementCode);
    if (previous && (previous.settlementType !== row.settlementType || previous.censusDistrictCode !== row.censusDistrictCode
      || censusTownBaseName(previous.canonicalSettlementName) !== censusTownBaseName(row.canonicalSettlementName))) throw Error('Conflicting settlement code');
    codes.set(row.settlementCode, row);
  }
  records.sort((a, b) => a.settlementCode.localeCompare(b.settlementCode) || a.censusSubDistrictCode.localeCompare(b.censusSubDistrictCode) || a.canonicalSettlementName.localeCompare(b.canonicalSettlementName));
  const registry = { source: 'Census of India 2011 PCA', sourceYear: 2011, censusStateCode: '29', sources,
    districts: districtMap.map(([code, name]) => ({ code, name })), records };
  if (!dryRun) {
    const target = new URL('../../data/processed/census2011-karnataka-settlements.json', import.meta.url);
    await mkdir(new URL('.', target), { recursive: true });
    // One record per line keeps the statewide file diffable without excessive indentation.
    const output = JSON.stringify({ ...registry, records: [] }, null, 2).replace('"records": []', `"records": [\n${records.map(r => JSON.stringify(r)).join(',\n')}\n]`);
    await writeFile(target, output + '\n');
  }
  console.log(JSON.stringify({ dryRun, records: records.length, districts: districtMap.length }));
  return registry;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.slice(2).some(arg => arg !== '--dry-run')) throw Error('Only --dry-run is supported');
  await importSettlements({ dryRun: process.argv.includes('--dry-run') });
}
