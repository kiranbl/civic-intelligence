import { readFile } from 'node:fs/promises';
import { demoRequests } from '../../prisma/demoData.js';
import { DISTRICT_ALIASES, POPULATION_SOURCE, POPULATION_YEAR } from '../import/censusPopulationData.js';
import { JJM_TARGETS, calculateJjmCoverage } from '../import/jjmCoverageData.js';
import { JJM_SOURCE, JJM_SOURCE_DATE, JJM_SOURCE_URL, JJM_FINANCIAL_YEAR } from '../../src/config/jjm.js';
import { RURAL_FHTC_METRIC_TYPE } from '../../src/config/waterPriority.js';

export class BootstrapError extends Error {}
const censusHeader = 'applicationDistrictName,sourceDistrictName,censusDistrictCode,totalPopulation,ruralPopulation,urbanPopulation,populationSource,populationSourceYear';
const jjmHeader = 'applicationDistrictName,j1SourceDistrictName,j5SourceDistrictName,pwsHouseholds,nonPwsUnconnectedHouseholds,totalReportedRuralHouseholds,tapConnectedHouseholds,ruralFhtcCoverage,source,sourceDate,financialYear';

// Deliberately accepts the tracked exporters' format: plain header and quoted,
// single-line cells (including escaped double quotes). Not a general CSV importer.
function parseExtract(csv, header) {
  const lines = csv.trimEnd().split(/\r?\n/);
  if (lines.shift() !== header || lines.length !== 8) throw new BootstrapError('Expected the processed CSV header and exactly eight rows');
  const fields = header.split(',');
  const rows = lines.map(line => {
    const cell = /"((?:[^"\r\n]|"")*)"(,|$)/gy;
    const values = [];
    let end = 0;
    let match;
    while ((match = cell.exec(line))) {
      values.push(match[1].replaceAll('""', '"'));
      end = cell.lastIndex;
      if (!match[2]) break;
    }
    if (end !== line.length || line.endsWith(',') || values.length !== fields.length) throw new BootstrapError('Malformed processed CSV row');
    return Object.fromEntries(fields.map((field, i) => [field, values[i]]));
  });
  const names = rows.map(row => row.applicationDistrictName);
  if (new Set(names).size !== 8 || JJM_TARGETS.some(name => !names.includes(name))) throw new BootstrapError('Processed CSV must contain exactly the eight unique target districts');
  return rows;
}

function integer(value, minimum = 0) {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < minimum || number > 2147483647) {
    throw new BootstrapError('Invalid processed population or household count');
  }
  return number;
}

export function baselineFromCsv(censusCsv, jjmCsv) {
  const census = parseExtract(censusCsv, censusHeader);
  const jjm = parseExtract(jjmCsv, jjmHeader);
  const codes = new Set();
  return JJM_TARGETS.map(name => {
    const c = census.find(row => row.applicationDistrictName === name);
    if (DISTRICT_ALIASES[c.sourceDistrictName] !== name || c.populationSource !== POPULATION_SOURCE
      || c.populationSourceYear !== String(POPULATION_YEAR) || !/^\d{3}$/.test(c.censusDistrictCode)
      || integer(c.censusDistrictCode, 1) === 0 || codes.has(c.censusDistrictCode)) throw new BootstrapError('Invalid Census aliases or provenance');
    codes.add(c.censusDistrictCode);
    const district = { name, state: 'Karnataka', population: integer(c.totalPopulation, 1),
      ruralPopulation: integer(c.ruralPopulation), urbanPopulation: integer(c.urbanPopulation),
      populationSource: POPULATION_SOURCE, populationSourceYear: POPULATION_YEAR };
    if (district.population !== district.ruralPopulation + district.urbanPopulation) throw new BootstrapError('Census Rural + Urban must equal Total');
    const j = jjm.find(row => row.applicationDistrictName === name);
    if (j.j1SourceDistrictName.toLowerCase() !== name.toLowerCase() || j.j5SourceDistrictName.toLowerCase() !== name.toLowerCase()
      || j.source !== JJM_SOURCE || j.sourceDate !== JJM_SOURCE_DATE || j.financialYear !== JJM_FINANCIAL_YEAR) throw new BootstrapError('Invalid JJM aliases or provenance');
    // This repository extract was already reconciled against J1/J5 with zero private
    // connections. Recover precision from counts, not the two-decimal display column.
    const coverage = calculateJjmCoverage(integer(j.pwsHouseholds), integer(j.nonPwsUnconnectedHouseholds), 0, integer(j.tapConnectedHouseholds));
    if (coverage.totalReportedRuralHouseholds !== integer(j.totalReportedRuralHouseholds, 1)
      || coverage.ruralFhtcCoverage.toFixed(2) !== j.ruralFhtcCoverage) throw new BootstrapError('Processed JJM counts/coverage do not reconcile');
    const metric = { metricType: RURAL_FHTC_METRIC_TYPE, value: coverage.ruralFhtcCoverage,
      unit: 'PERCENT', source: JJM_SOURCE, sourceYear: 2026,
      sourceDate: new Date(`${JJM_SOURCE_DATE}T00:00:00.000Z`), sourceUrl: JJM_SOURCE_URL };
    const requests = demoRequests(name).map(request => ({ ...request, subcategory: null, latitude: null, longitude: null,
      summaryEnglish: null, locationText: null, aiModel: null, aiConfidence: null, aiProcessedAt: null }));
    if (requests.length !== 4 || requests.some(r => !r.originalText.startsWith(`[DEMO ONLY - ${name}]`))) throw new BootstrapError('Expected four original synthetic fixtures per district');
    return { district, metric, requests };
  });
}

export async function loadBaseline() {
  const [census, jjm] = await Promise.all([
    readFile(new URL('../../data/processed/census2011-karnataka-population.csv', import.meta.url), 'utf8'),
    readFile(new URL('../../data/processed/jjm-karnataka-rural-coverage-2026-09-21.csv', import.meta.url), 'utf8'),
  ]);
  return baselineFromCsv(census, jjm);
}
