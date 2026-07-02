import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { cleanLocalCatalog } from '../supplierFeedImporter';

// Regression guard for the exact bug class that caused a real Postgres FK
// violation during this change's implementation (see design.md decision 4 and
// the Step 7 report): cleanLocalCatalog's delete list was hand-written from a
// point-in-time reading of schema.prisma, so it can silently drift if a future
// migration adds a new model with a non-cascading foreign key to Product,
// ProductVariant, CustomerOrder, or SupplierOrder without updating the list.
//
// This test derives the "must be deleted before these tables" model set
// directly from the live schema.prisma source (not from a second hand-written
// copy of the list, which would just duplicate the original mistake), and
// compares it against which Prisma delegates cleanLocalCatalog actually calls
// deleteMany on, via a spy — so it fails on drift regardless of whether either
// side was "correct" when authored.
describe('cleanLocalCatalog schema-drift guard', () => {
  const ROOT_TABLES = ['Product', 'ProductVariant', 'CustomerOrder', 'SupplierOrder'];

  // Checks whether `line` references `model` as a whole word, optionally
  // followed by "?" (Prisma's optional-relation marker), without building a
  // regex from a variable (semgrep flags `new RegExp(...)` with interpolated
  // input as a potential ReDoS vector, even though ROOT_TABLES is a small
  // fixed literal array here, not user input).
  function lineReferencesModel(line: string, model: string): boolean {
    const idx = line.indexOf(model);
    if (idx === -1) return false;

    const before = line[idx - 1];
    if (before !== undefined && /[A-Za-z0-9_]/.test(before)) return false;

    let after = idx + model.length;
    if (line[after] === '?') after += 1;
    return line[after] === ' ' || line[after] === '\t';
  }

  function deriveModelsRequiringManualCleanup(schemaText: string): Set<string> {
    const requiresManualCleanup = new Set<string>(ROOT_TABLES);
    const modelBlockPattern = /model\s+(\w+)\s*\{([^}]*)\}/g;

    let match: RegExpExecArray | null;
    while ((match = modelBlockPattern.exec(schemaText))) {
      const [, modelName, body] = match;
      for (const line of body.split('\n')) {
        if (!/@relation\(/.test(line)) continue;
        const referencesRoot = ROOT_TABLES.some((root) => lineReferencesModel(line, root));
        if (!referencesRoot) continue;
        if (/onDelete:\s*Cascade/.test(line)) continue; // auto-cleaned by Postgres/Prisma
        requiresManualCleanup.add(modelName);
      }
    }

    return requiresManualCleanup;
  }

  it('deletes every model with a non-cascading FK to Product/ProductVariant/CustomerOrder/SupplierOrder', async () => {
    const schemaPath = path.join(__dirname, '../../../../prisma/schema.prisma');
    const schemaText = fs.readFileSync(schemaPath, 'utf-8');
    const requiresManualCleanup = deriveModelsRequiringManualCleanup(schemaText);

    const calledDelegates = new Set<string>();
    const spyPrisma = new Proxy(
      {},
      {
        get(_target, prop: string) {
          calledDelegates.add(prop);
          return { deleteMany: async () => undefined };
        },
      },
    ) as unknown as Prisma.TransactionClient;

    await cleanLocalCatalog(spyPrisma);

    const calledModels = new Set([...calledDelegates].map((name) => name.charAt(0).toUpperCase() + name.slice(1)));

    const missing = [...requiresManualCleanup].filter((model) => !calledModels.has(model));
    expect(missing).toEqual([]);
  });
});
