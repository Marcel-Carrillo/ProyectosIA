import { PrismaClient } from '@prisma/client';

// DEPRECATED: EscuelaJS importer retired — kept for reference only, not invoked by seed.
// import { importEscuelaJsProducts } from '../src/infrastructure/import/escuelaJsProductImporter';

import { importPrintfulProducts } from '../src/infrastructure/import/printfulProductImporter';

import { seedFashionCatalog } from './seedFashionCatalog';



const prisma = new PrismaClient();



async function main() {

  console.log('Seeding Mavile fashion catalog with images...');

  const fashion = await seedFashionCatalog(prisma);

  console.log(`Fashion seed: ${fashion.products} products, ${fashion.categories} categories.`);



  if (process.env.PRINTFUL_IMPORT === 'true') {

    const limit = process.env.PRINTFUL_IMPORT_LIMIT

      ? parseInt(process.env.PRINTFUL_IMPORT_LIMIT, 10)

      : undefined;

    console.log(`Importing products from Printful (limit=${limit ?? 'all'})...`);

    const result = await importPrintfulProducts(prisma, { limit });

    console.log(

      `Printful import: fetched=${result.fetched}, imported=${result.imported}, skipped=${result.skipped}`,

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

