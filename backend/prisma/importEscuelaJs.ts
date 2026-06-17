import { PrismaClient } from '@prisma/client';
import { importEscuelaJsProducts } from '../src/infrastructure/import/escuelaJsProductImporter';

const prisma = new PrismaClient();

async function main() {
  const limit = Number(process.env.ESCUELAJS_IMPORT_LIMIT ?? '40');

  const result = await importEscuelaJsProducts(prisma, { limit });
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
