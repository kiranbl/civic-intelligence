import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readJjmCoverage, jjmCoverageCsv } from './jjmCoverageData.js';
import { importJjmCoverage } from './jjmCoverageImport.js';

const backend = fileURLToPath(new URL('../../', import.meta.url));
let prisma;
let databasePhase = false;
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--dry-run')) throw new Error('Usage: npm run import:jjm -- [--dry-run]');
  const records = await readJjmCoverage(
    resolve(backend, 'data/raw/jjm/State wise PWS and FHTC Coverage.xls'),
    resolve(backend, 'data/raw/jjm/Habitation wise FHTC Coverage( Reported Till 21_09.xls'),
  );
  const result = await importJjmCoverage(records, {
    dryRun: args.includes('--dry-run'),
    getClient: async () => {
      databasePhase = true;
      prisma = (await import('../../src/config/prisma.js')).default;
      return prisma;
    },
  });
  const output = resolve(backend, 'data/processed/jjm-karnataka-rural-coverage-2026-09-21.csv');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, jjmCoverageCsv(records), 'utf8');
  console.log(`Matched ${result.matched}; updated ${result.updated}. Processed CSV: ${output}`);
} catch (error) {
  console.error(databasePhase ? 'JJM import failed. Check migrations, database configuration, and existing target metrics; internal database details are hidden.' : `JJM validation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
}
