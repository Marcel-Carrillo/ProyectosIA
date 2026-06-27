import { PrismaClient } from '@prisma/client';
import { clearDemoCatalog } from '../src/infrastructure/import/clearDemoCatalog';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const result = await clearDemoCatalog(prisma, { dryRun });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
