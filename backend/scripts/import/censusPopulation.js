import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readCensusPopulations, populationCsv, importPopulations } from './censusPopulationData.js';

const backendDirectory = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
let file = resolve(backendDirectory, 'data/raw/2011-IndiaStateDist-0000.xlsx');
let dryRun = false;
let prisma;

try {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--file' && args[i + 1] && !args[i + 1].startsWith('--')) file = resolve(args[++i]);
    else throw new Error('Usage: npm run import:census -- [--dry-run] [--file path/to/workbook.xlsx]');
  }
  const records = await readCensusPopulations(file);
  const output = resolve(backendDirectory, 'data/processed/census2011-karnataka-population.csv');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, populationCsv(records), 'utf8');
  const result = await importPopulations(records, {
    dryRun,
    getClient: async () => {
      prisma = (await import('../../src/config/prisma.js')).default;
      return prisma;
    },
  });
  console.log(`Matched ${result.matched}; updated ${result.updated}. Processed CSV: ${output}`);
} catch (error) {
  // Prisma errors may contain connection details; do not print them.
  console.error(prisma ? 'Database import failed; transaction rolled back. Check configuration and the eight existing districts.' : `Census import failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
}
