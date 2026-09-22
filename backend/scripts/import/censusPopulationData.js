import readExcelFile from 'read-excel-file/node';

export const POPULATION_SOURCE = 'Census of India - Primary Census Abstract';
export const POPULATION_YEAR = 2011;
export const DISTRICT_ALIASES = {
  Bangalore: 'Bengaluru Urban',
  'Bangalore Rural': 'Bengaluru Rural',
  Mysore: 'Mysuru',
  Mandya: 'Mandya',
  Tumkur: 'Tumakuru',
  Hassan: 'Hassan',
  Kolar: 'Kolar',
  Ramanagara: 'Ramanagara',
};

// Verified against Data row 1 and the workbook's Record Structure sheet.
const REQUIRED_COLUMNS = ['State', 'District', 'Subdistt', 'Town/Village', 'Ward', 'EB', 'Level', 'Name', 'TRU', 'TOT_P'];
const lowerLevelColumns = ['Subdistt', 'Town/Village', 'Ward', 'EB'];
const text = value => String(value ?? '').trim();
const isZeroCode = value => /^0+$/.test(text(value));

export function extractCensusPopulations(rows) {
  const [header, ...data] = rows;
  if (!Array.isArray(header)) throw new Error('Missing Data sheet header.');
  const columns = header.map(text);
  for (const name of REQUIRED_COLUMNS) {
    if (columns.filter(column => column === name).length !== 1) {
      throw new Error(`Expected exactly one ${name} column in Data row 1.`);
    }
  }
  const records = data.map(row => Object.fromEntries(columns.map((name, i) => [name, row[i]])));
  const states = records.filter(row => text(row.Level) === 'STATE'
    && text(row.Name) === 'KARNATAKA' && text(row.TRU) === 'Total');
  if (states.length !== 1 || text(states[0].State) !== '29') {
    throw new Error('Expected one Karnataka Total state row with State code 29.');
  }

  const matched = new Map();
  const codes = new Set();
  for (const row of records) {
    if (text(row.State) !== '29' || text(row.Level) !== 'DISTRICT' || text(row.TRU) !== 'Total') continue;
    if (!lowerLevelColumns.every(column => isZeroCode(row[column]))) continue;
    const sourceDistrictName = text(row.Name);
    if (!Object.hasOwn(DISTRICT_ALIASES, sourceDistrictName)) continue;
    const applicationDistrictName = DISTRICT_ALIASES[sourceDistrictName];
    const censusDistrictCode = text(row.District);
    if (!/^\d{3}$/.test(censusDistrictCode) || isZeroCode(censusDistrictCode)) {
      throw new Error(`Invalid district code for ${sourceDistrictName}.`);
    }
    if (matched.has(applicationDistrictName) || codes.has(censusDistrictCode)) {
      throw new Error(`Duplicate district match: ${sourceDistrictName}.`);
    }
    // Do not coerce blanks, numeric strings, booleans, or fractional counts.
    if (!Number.isSafeInteger(row.TOT_P) || row.TOT_P <= 0 || row.TOT_P > 2147483647) {
      throw new Error(`Invalid TOT_P population for ${sourceDistrictName}.`);
    }
    codes.add(censusDistrictCode);
    matched.set(applicationDistrictName, {
      applicationDistrictName, sourceDistrictName, censusDistrictCode,
      population: row.TOT_P, populationSource: POPULATION_SOURCE, populationSourceYear: POPULATION_YEAR,
    });
  }
  const missing = Object.values(DISTRICT_ALIASES).filter(name => !matched.has(name));
  if (matched.size !== 8 || missing.length) throw new Error(`Expected eight unique districts. Missing: ${missing.join(', ')}`);
  return Object.values(DISTRICT_ALIASES).map(name => matched.get(name));
}

export async function readCensusPopulations(file) {
  const sheets = await readExcelFile(file);
  const data = sheets.filter(sheet => sheet.sheet === 'Data');
  const structure = sheets.find(sheet => sheet.sheet === 'Record Structure');
  if (data.length !== 1 || !structure) throw new Error('Expected Data and Record Structure sheets.');
  if (structure.data[0]?.[0] !== 'Census 2011 - Primary Census Abstract - Record Structure'
    || !structure.data.some(row => row[0] === 'TOT_P' && row[3] === 'Total Population (Persons)')) {
    throw new Error('Workbook does not declare the expected Census 2011 population definition.');
  }
  return extractCensusPopulations(data[0].data);
}

export function populationCsv(records) {
  const columns = ['applicationDistrictName', 'sourceDistrictName', 'censusDistrictCode', 'population', 'populationSource', 'populationSourceYear'];
  const escape = value => `"${String(value).replaceAll('"', '""')}"`;
  return `${columns.join(',')}\n${records.map(row => columns.map(column => escape(row[column])).join(',')).join('\n')}\n`;
}

export async function importPopulations(records, { dryRun = true, getClient, log = console.log } = {}) {
  if (records.length !== 8 || new Set(records.map(row => row.applicationDistrictName)).size !== 8
    || records.some(row => !Object.values(DISTRICT_ALIASES).includes(row.applicationDistrictName)
      || !Number.isSafeInteger(row.population) || row.population <= 0 || row.population > 2147483647
      || row.populationSource !== POPULATION_SOURCE || row.populationSourceYear !== POPULATION_YEAR)) {
    throw new Error('Import requires eight validated target district populations with Census 2011 provenance.');
  }
  log('Pre-update summary: Census 2011 historical population, not a 2026 estimate.');
  for (const row of records) log(`${row.sourceDistrictName} -> ${row.applicationDistrictName}: ${row.population} (district ${row.censusDistrictCode})`);
  if (dryRun) {
    log('Dry run: no database connection or writes.');
    return { matched: 8, updated: 0, dryRun: true };
  }
  const prisma = await getClient();
  return prisma.$transaction(async tx => {
    const districts = await tx.district.findMany({
      where: { state: 'Karnataka', name: { in: records.map(row => row.applicationDistrictName) } },
    });
    if (districts.length !== 8 || new Set(districts.map(row => row.name)).size !== 8
      || records.some(row => !districts.some(district => district.name === row.applicationDistrictName))) {
      throw new Error('Database must contain all eight unique Karnataka target districts before import.');
    }
    let updated = 0;
    for (const record of records) {
      const district = districts.find(row => row.name === record.applicationDistrictName);
      const data = { population: record.population, populationSource: record.populationSource, populationSourceYear: record.populationSourceYear };
      if (Object.entries(data).every(([key, value]) => district[key] === value)) continue;
      await tx.district.update({ where: { id: district.id }, data });
      updated++;
    }
    return { matched: 8, updated, dryRun: false };
  });
}
