import { PrismaClient } from '@prisma/client';
import {
  cleanLocalCatalog,
  importSupplierFeedProducts,
  readSupplierFeedFixture,
} from '../src/infrastructure/import/supplierFeedImporter';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', 'db']); // 'db' = docker-compose.yml service name

function assertDevOnlyEnvironment(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run import:supplier-feed: NODE_ENV=production.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Refusing to run import:supplier-feed: DATABASE_URL is not set.');
  }

  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error('Refusing to run import:supplier-feed: DATABASE_URL is not a valid connection string.');
  }

  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run import:supplier-feed: DATABASE_URL host "${host}" is not a recognized local/dev host ` +
        `(expected one of: ${[...LOCAL_DATABASE_HOSTS].join(', ')}).`,
    );
  }
}

async function main() {
  // 1. Guard first — no PrismaClient constructed, no DB call possible, if this throws.
  assertDevOnlyEnvironment();

  // 2. Read + validate the fixture before any DB mutation, so a malformed fixture
  //    leaves the database untouched (spec.md "Fixture is malformed" scenario).
  const products = readSupplierFeedFixture();

  const prisma = new PrismaClient();
  try {
    // Clean + load run as a single interactive transaction: if anything fails
    // partway through (a duplicate SKU slipping past validation, a dropped DB
    // connection, etc.), the whole run rolls back instead of leaving the local
    // database partially wiped. 30s timeout gives generous headroom for a
    // larger fixture than this project's small sample.
    const result = await prisma.$transaction(
      async (tx) => {
        await cleanLocalCatalog(tx);
        return importSupplierFeedProducts(tx, products);
      },
      { timeout: 30000 },
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
