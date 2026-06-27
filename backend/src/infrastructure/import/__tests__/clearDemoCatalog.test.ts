import { clearDemoCatalog } from '../clearDemoCatalog';

// ── Prisma mock ───────────────────────────────────────────────────────────────

type PrismaMock = ReturnType<typeof makePrismaMock>;

function makePrismaMock({
  variants = [{ productId: 1, id: 10 }],
  orderItemCount = 0,
  supplierItemCount = 0,
  wishlistCount = 0,
}: {
  variants?: { productId: number; id: number }[];
  orderItemCount?: number;
  supplierItemCount?: number;
  wishlistCount?: number;
} = {}) {
  const allVariants = variants;

  const txObj = {
    productImage: { deleteMany: jest.fn(async () => ({})) },
    productVariant: {
      deleteMany: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({})),
    },
    product: {
      deleteMany: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({})),
    },
  };

  return {
    productVariant: {
      findMany: jest.fn(async ({ where }: { where: { sku?: unknown } }) => {
        if (where?.sku) return allVariants;
        return allVariants;
      }),
    },
    customerOrderItem: {
      count: jest.fn(async () => orderItemCount),
    },
    supplierOrderItem: {
      count: jest.fn(async () => supplierItemCount),
    },
    wishlistItem: {
      count: jest.fn(async () => wishlistCount),
    },
    $transaction: jest.fn(async (fn: (tx: typeof txObj) => Promise<void>) => fn(txObj)),
    _tx: txObj,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('clearDemoCatalog', () => {
  it('dry-run makes no DB writes', async () => {
    const prisma = makePrismaMock();
    const result = await clearDemoCatalog(
      prisma as unknown as Parameters<typeof clearDemoCatalog>[0],
      { dryRun: true },
    );

    expect(result).toEqual({ hardDeleted: 0, softDeleted: 0, skipped: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('hard-deletes products with no FK references', async () => {
    const prisma = makePrismaMock({ orderItemCount: 0, supplierItemCount: 0, wishlistCount: 0 });
    const result = await clearDemoCatalog(
      prisma as unknown as Parameters<typeof clearDemoCatalog>[0],
    );

    expect(result.hardDeleted).toBe(1);
    expect(result.softDeleted).toBe(0);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma._tx.product.deleteMany).toHaveBeenCalled();
    expect(prisma._tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('soft-deletes products referenced by a customer order', async () => {
    const prisma = makePrismaMock({ orderItemCount: 1 });
    const result = await clearDemoCatalog(
      prisma as unknown as Parameters<typeof clearDemoCatalog>[0],
    );

    expect(result.hardDeleted).toBe(0);
    expect(result.softDeleted).toBe(1);
    expect(prisma._tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'Archived' }),
      }),
    );
    expect(prisma._tx.product.deleteMany).not.toHaveBeenCalled();
  });

  it('soft-deletes products referenced by a wishlist item', async () => {
    const prisma = makePrismaMock({ wishlistCount: 1 });
    const result = await clearDemoCatalog(
      prisma as unknown as Parameters<typeof clearDemoCatalog>[0],
    );

    expect(result.hardDeleted).toBe(0);
    expect(result.softDeleted).toBe(1);
  });

  it('returns zeros when no demo products exist', async () => {
    const prisma = makePrismaMock({ variants: [] });
    const result = await clearDemoCatalog(
      prisma as unknown as Parameters<typeof clearDemoCatalog>[0],
    );

    expect(result).toEqual({ hardDeleted: 0, softDeleted: 0, skipped: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('is idempotent on re-run when no products remain', async () => {
    const prisma = makePrismaMock({ variants: [] });

    const r1 = await clearDemoCatalog(
      prisma as unknown as Parameters<typeof clearDemoCatalog>[0],
    );
    const r2 = await clearDemoCatalog(
      prisma as unknown as Parameters<typeof clearDemoCatalog>[0],
    );

    expect(r1).toEqual({ hardDeleted: 0, softDeleted: 0, skipped: 0 });
    expect(r2).toEqual(r1);
  });
});
