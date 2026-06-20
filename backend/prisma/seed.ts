import { PrismaClient } from '@prisma/client';
import { importEscuelaJsProducts } from '../src/infrastructure/import/escuelaJsProductImporter';
import { seedFashionCatalog } from './seedFashionCatalog';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Mavile fashion catalog with images...');
  const fashion = await seedFashionCatalog(prisma);
  console.log(`Fashion seed: ${fashion.products} products, ${fashion.categories} categories.`);

  if (process.env.ESCUELAJS_IMPORT === 'true') {
    const limit = Number(process.env.ESCUELAJS_IMPORT_LIMIT ?? '40');
    console.log(`Importing products from EscuelaJS (limit=${limit})...`);
    const result = await importEscuelaJsProducts(prisma, { limit });
    console.log(
      `EscuelaJS import: fetched=${result.fetched}, imported=${result.imported}, skipped=${result.skipped}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
