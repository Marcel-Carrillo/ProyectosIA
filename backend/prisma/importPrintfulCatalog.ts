import { PrismaClient } from '@prisma/client';
import { importPrintfulCatalogProducts } from '../src/infrastructure/import/printfulProductImporter';

const prisma = new PrismaClient();

async function main() {
  const limit = process.env.PRINTFUL_IMPORT_LIMIT
    ? parseInt(process.env.PRINTFUL_IMPORT_LIMIT, 10)
    : undefined;

  const result = await importPrintfulCatalogProducts(prisma, { limit });
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
