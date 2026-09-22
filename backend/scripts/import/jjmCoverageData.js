import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { JJM_SOURCE, JJM_SOURCE_DATE, JJM_FINANCIAL_YEAR } from '../../src/config/jjm.js';

// Exact inspected names, case-insensitive only. No Census aliases or fuzzy matching.
export const JJM_DISTRICT_ALIASES = {
  'bengaluru urban': 'Bengaluru Urban',
  'bengaluru rural': 'Bengaluru Rural',
  mysuru: 'Mysuru', mandya: 'Mandya', tumakuru: 'Tumakuru',
  hassan: 'Hassan', kolar: 'Kolar', ramanagara: 'Ramanagara',
};
export const JJM_TARGETS = Object.values(JJM_DISTRICT_ALIASES);
const clean = value => value.replace(/\s+/g, ' ').trim();
function separatedText(node) {
  return node.type === 'text' ? node.data : (node.children || []).map(separatedText).join(' ');
}
const J1_HEADERS = [
  ['S. No.', 'District Name', 'Total no. of Villages', 'Villages without PWS', 'Villages with PWS'],
  ['No. of Village', 'No. of households (without Household tap connections)', 'No. of households (with private connections)',
    'No. of Village', 'Total No. of households', 'No. of Households with Household tap Connection',
    'Number of villages having 100% FHTC', 'Number of villages having < 100% FHTC'],
];
const J5_HEADERS = [
  ['S.No.', 'District Name', 'Total Habitations as on 01/04/2026', 'Non PWS Habitations', 'PWS Habitations'],
  ['With FHTC Coverage = 0 %', 'With FHTC Coverage >0 and <25 %', 'With FHTC Coverage >=25 and <50 %',
    'With FHTC Coverage >=50 and <75 %', 'With FHTC Coverage >=75 and <100 %', 'With FHTC Coverage >=100 %'],
  Array.from({ length: 6 }, () => ['Habs', 'House Holds', 'House Connectons']).flat(),
];

export function detectJjmFormat(input) {
  const html = Buffer.isBuffer(input) ? input.toString('utf8') : input;
  if (typeof html !== 'string' || !/^\s*(?:\uFEFF)?\s*(?:<!doctype html[^>]*>\s*)?<html\b/i.test(html)
    || !/urn:schemas-microsoft-com:office:excel/i.test(html)) {
    throw new Error('Expected an HTML Excel export, not a binary XLS/XLSX workbook.');
  }
  return 'HTML_EXCEL';
}

function count(value, label) {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`Invalid nonnegative integer: ${label}.`);
  return Number(value);
}

function report(input, format, headers, width, spans) {
  detectJjmFormat(input);
  const $ = load(input.toString());
  $('script, style').remove();
  const text = clean(separatedText($('body')[0]));
  if (!new RegExp(`Format\\s*-?\\s*${format}\\b`).test(text)) throw new Error(`Expected Format ${format}.`);
  const table = $('#tableReportTable');
  if (table.length !== 1) throw new Error(`${format}: expected one report table.`);
  const elements = table.find('tr').toArray();
  const rows = elements.map(row => $(row).children('th,td').toArray().map(cell => clean($(cell).text())));
  headers.forEach((header, index) => {
    if (JSON.stringify(rows[index]) !== JSON.stringify(header)) throw new Error(`${format}: unexpected header row ${index + 1}.`);
    const actualSpans = $(elements[index]).children('th,td').toArray().map(cell => [Number($(cell).attr('rowspan') || 1), Number($(cell).attr('colspan') || 1)]);
    if (JSON.stringify(actualSpans) !== JSON.stringify(spans[index])) throw new Error(`${format}: unexpected header grouping.`);
  });
  const districts = new Map();
  for (const row of rows.slice(headers.length)) {
    if (row[0] === 'Total') continue; // repeated state totals are never districts
    if (row.length !== width || !/^\d+$/.test(row[0])) throw new Error(`${format}: malformed district row.`);
    const numbers = row.slice(2).map((value, index) => count(value, `${format} ${row[1]} column ${index + 3}`));
    const key = row[1].toLowerCase();
    const name = Object.hasOwn(JJM_DISTRICT_ALIASES, key) ? JJM_DISTRICT_ALIASES[key] : null;
    if (!name) continue;
    if (districts.has(name)) throw new Error(`${format}: duplicate district ${name}.`);
    districts.set(name, { sourceDistrictName: row[1], numbers });
  }
  for (const name of JJM_TARGETS) if (!districts.has(name)) throw new Error(`${format}: missing district ${name}.`);
  return { $, text, districts };
}

export function parseJ1(input) {
  const { $, text, districts } = report(input, 'J1', J1_HEADERS, 11, [
    [[2, 1], [2, 1], [2, 1], [1, 3], [1, 5]], Array(8).fill([1, 1]),
  ]);
  if (clean($('#ReportHeading').text()) !== 'State wise PWS and FHTC Coverage'
    || !/State\s*:\s*Karnataka\s*,\s*Category\s*:\s*All Districts\b/.test(text)) {
    throw new Error('J1: expected Karnataka / All Districts PWS and FHTC report.');
  }
  return JJM_TARGETS.map(applicationDistrictName => {
    const { sourceDistrictName, numbers: n } = districts.get(applicationDistrictName);
    const [totalVillages, withoutPws, nonPwsUnconnectedHouseholds, privateHouseholds, withPws,
      pwsHouseholds, tapConnectedHouseholds, fullVillages, partialVillages] = n;
    if (totalVillages !== withoutPws + withPws || withPws !== fullVillages + partialVillages) throw new Error(`J1: village totals mismatch for ${applicationDistrictName}.`);
    if (tapConnectedHouseholds > pwsHouseholds) throw new Error(`J1: connections exceed PWS households for ${applicationDistrictName}.`);
    return { applicationDistrictName, sourceDistrictName, pwsHouseholds, nonPwsUnconnectedHouseholds, privateHouseholds, tapConnectedHouseholds };
  });
}

export function parseJ5(input) {
  const { $, text, districts } = report(input, 'J5', J5_HEADERS, 22, [
    [[3, 1], [3, 1], [3, 1], [3, 1], [1, 18]], Array(6).fill([1, 3]), Array(18).fill([1, 1]),
  ]);
  const title = clean($('#ReportHeading').text());
  const date = title.match(/^Habitation wise FHTC Coverage\(\s*Reported Till (\d{2})\/(\d{2})\/(\d{4})\)$/);
  const sourceDate = date ? `${date[3]}-${date[2]}-${date[1]}` : null;
  if (sourceDate !== JJM_SOURCE_DATE) throw new Error('J5: expected Reported Till 21/09/2026.');
  const financialYear = text.match(/Financial Year\s*:\s*(\d{4}-\d{4})\s*,/)?.[1];
  if (financialYear !== JJM_FINANCIAL_YEAR) throw new Error('J5: expected Financial Year 2026-2027.');
  if (!/State\s*:\s*Karnataka\s*,\s*District\s*:\s*All District\s*,\s*Category\s*:\s*All Districts\b/.test(text)) {
    throw new Error('J5: expected Karnataka / All District / All Districts.');
  }
  const records = JJM_TARGETS.map(applicationDistrictName => {
    const { sourceDistrictName, numbers: n } = districts.get(applicationDistrictName);
    let pwsHouseholds = 0, tapConnectedHouseholds = 0, pwsHabitations = 0;
    for (let band = 0; band < 6; band++) {
      const [habs, households, connections] = n.slice(2 + band * 3, 5 + band * 3);
      if (connections > households) throw new Error(`J5: connections exceed households for ${applicationDistrictName}.`);
      pwsHabitations += habs;
      pwsHouseholds += households;
      tapConnectedHouseholds += connections;
    }
    if (pwsHabitations + n[1] !== n[0]) throw new Error(`J5: habitation totals mismatch for ${applicationDistrictName}.`);
    return { applicationDistrictName, sourceDistrictName, pwsHouseholds, tapConnectedHouseholds };
  });
  return { records, sourceDate, financialYear };
}

export function calculateJjmCoverage(H, U, P, C) {
  if (![H, U, P, C].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid household or connection count.');
  if (P !== 0) throw new Error('Private connections must be zero; stop and resolve their meaning.');
  const denominator = H + U;
  if (!Number.isSafeInteger(denominator) || denominator <= 0 || C > denominator || C > H) throw new Error('Invalid coverage denominator or connection count.');
  const coverage = C / denominator * 100;
  if (!Number.isFinite(coverage) || coverage < 0 || coverage > 100) throw new Error('Coverage must be within 0-100.');
  return { totalReportedRuralHouseholds: denominator, ruralFhtcCoverage: coverage };
}

export function reconcileJjm(j1, j5) {
  for (const rows of [j1, j5.records]) {
    if (rows.length !== 8 || new Set(rows.map(row => row.applicationDistrictName)).size !== 8
      || rows.some(row => !JJM_TARGETS.includes(row.applicationDistrictName))) throw new Error('Expected exactly eight unique target districts in each source.');
  }
  if (j5.sourceDate !== JJM_SOURCE_DATE || j5.financialYear !== JJM_FINANCIAL_YEAR) throw new Error('J5 source date or financial year mismatch.');
  return JJM_TARGETS.map(name => {
    const a = j1.find(row => row.applicationDistrictName === name);
    const b = j5.records.find(row => row.applicationDistrictName === name);
    if (a.pwsHouseholds !== b.pwsHouseholds) throw new Error(`J1/J5 household mismatch: ${name}.`);
    if (a.tapConnectedHouseholds !== b.tapConnectedHouseholds) throw new Error(`J1/J5 connection mismatch: ${name}.`);
    const calculation = calculateJjmCoverage(a.pwsHouseholds, a.nonPwsUnconnectedHouseholds, a.privateHouseholds, a.tapConnectedHouseholds);
    return {
      applicationDistrictName: name, j1SourceDistrictName: a.sourceDistrictName, j5SourceDistrictName: b.sourceDistrictName,
      pwsHouseholds: a.pwsHouseholds, nonPwsUnconnectedHouseholds: a.nonPwsUnconnectedHouseholds, privateHouseholds: a.privateHouseholds,
      ...calculation, tapConnectedHouseholds: a.tapConnectedHouseholds,
      source: JJM_SOURCE, sourceDate: j5.sourceDate, financialYear: j5.financialYear,
      householdReconciliation: 'MATCH', connectionReconciliation: 'MATCH',
    };
  });
}

export async function readJjmCoverage(j1File, j5File) {
  const [j1, j5] = await Promise.all([readFile(j1File), readFile(j5File)]);
  return reconcileJjm(parseJ1(j1), parseJ5(j5));
}

export function jjmCoverageCsv(records) {
  const columns = ['applicationDistrictName', 'j1SourceDistrictName', 'j5SourceDistrictName', 'pwsHouseholds',
    'nonPwsUnconnectedHouseholds', 'totalReportedRuralHouseholds', 'tapConnectedHouseholds', 'ruralFhtcCoverage', 'source', 'sourceDate', 'financialYear'];
  const escape = value => `"${String(value).replaceAll('"', '""')}"`;
  return `${columns.join(',')}\n${records.map(row => columns.map(key => escape(key === 'ruralFhtcCoverage' ? row[key].toFixed(2) : row[key])).join(',')).join('\n')}\n`;
}
