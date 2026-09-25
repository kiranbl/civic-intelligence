import { bootstrapProduction } from './initialize.js';
import { BootstrapError } from './baseline.js';

let prisma;
try {
  // Only this explicit CLI entry point connects. Never invoked by tests or build.
  prisma = (await import('../../src/config/prisma.js')).default;
  const result = await bootstrapProduction(prisma);
  console.log(result.initialized
    ? 'Production baseline initialized: 8 districts, 32 synthetic requests, 8 official JJM metrics.'
    : 'Production baseline verified. No writes performed; additional requests preserved.');
} catch (error) {
  console.error(error instanceof BootstrapError ? error.message
    : 'Production bootstrap failed. Check processed data, database configuration, migrations, and concurrent initialization. No automatic repair attempted.');
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
}
