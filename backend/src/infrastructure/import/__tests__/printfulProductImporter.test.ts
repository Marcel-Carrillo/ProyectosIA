import { importPrintfulProducts } from '../printfulProductImporter';
import { SyncProductListResponse, SyncProductDetailResponse } from '../../external/printfulTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeListResponse(ids: number[], total?: number): SyncProductListResponse {
  return {
    code: 200,
    result: ids.map((id) => ({
      id,
      external_id: `ext-${id}`,
      name: `Product ${id}`,
      variants: 1,
      synced: 1,
      thumbnail_url: null,
      is_ignored: false,
    })),
    paging: { total: total ?? ids.length, offset: 0, limit: ids.length },
  };
}

function makeDetailResponse(id: number): SyncProductDetailResponse {
  return {
    code: 200,
    result: {
      sync_product: {
        id,
        external_id: `ext-${id}`,
        name: `Product ${id}`,
        variants: 1,
        synced: 1,
        thumbnail_url: null,
        is_ignored: false,
      },
      sync_variants: [
        {
          id: id * 10,
          external_id: `ext-v-${id}`,
          sync_product_id: id,
          name: `Product ${id} / S / Red`,
          synced: true,
          variant_id: 4011,
          retail_price: '20.00',
          currency: 'USD',
          is_ignored: false,
          options: [
            { id: 'SIZE', value: 'S' },
            { id: 'COLOR', value: 'Red' },
          ],
          files: [],
          product: { type: 'T-Shirt' },
        },
      ],
    },
  };
}

// ── Prisma mock ───────────────────────────────────────────────────────────────

function makePrismaMock() {
  const suppliers: { id: number; name: string }[] = [];
  const categories: { id: number; name: string }[] = [];
  const products: { id: number; slug: string }[] = [];

  return {
    supplier: {
      findFirst: jest.fn(async ({ where }: { where: { name: string } }) =>
        suppliers.find((s) => s.name === where.name) ?? null
      ),
      create: jest.fn(async ({ data }: { data: { name: string } }) => {
        const s = { id: suppliers.length + 1, ...data };
        suppliers.push(s);
        return s;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: number }; data: object }) => {
        const s = suppliers.find((s) => s.id === where.id);
        Object.assign(s ?? {}, data);
        return s;
      }),
    },
    category: {
      upsert: jest.fn(async ({ where, create }: { where: { name: string }; create: { name: string } }) => {
        let cat = categories.find((c) => c.name === where.name);
        if (!cat) {
          cat = { id: categories.length + 1, ...create };
          categories.push(cat);
        }
        return cat;
      }),
    },
    product: {
      findUnique: jest.fn(async ({ where }: { where: { slug: string } }) =>
        products.find((p) => p.slug === where.slug) ?? null
      ),
      create: jest.fn(async ({ data }: { data: { slug: string } }) => {
        const p = { id: products.length + 1, slug: data.slug };
        products.push(p);
        return p;
      }),
      update: jest.fn(async () => ({})),
    },
    productVariant: {
      deleteMany: jest.fn(async () => ({})),
      createMany: jest.fn(async () => ({})),
    },
    productImage: {
      deleteMany: jest.fn(async () => ({})),
      createMany: jest.fn(async () => ({})),
    },
    _suppliers: suppliers,
    _products: products,
  };
}

// ── fetch mock ────────────────────────────────────────────────────────────────

function mockFetchSequence(responses: object[]) {
  let callIndex = 0;
  global.fetch = jest.fn(async () => {
    const body = responses[callIndex++] ?? {};
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PRINTFUL_API_KEY = 'test-key';
  process.env.PRINTFUL_PRICE_MARKUP = '1.6';
  process.env.PRINTFUL_THROTTLE_MS = '0';
});

afterEach(() => {
  delete process.env.PRINTFUL_PRICE_MARKUP;
  delete process.env.PRINTFUL_THROTTLE_MS;
});

describe('importPrintfulProducts', () => {
  it('upserts supplier idempotently on second run', async () => {
    const mock = makePrismaMock();
    const prisma = mock as unknown as Parameters<typeof importPrintfulProducts>[0];
    mockFetchSequence([makeListResponse([1]), makeDetailResponse(1)]);

    await importPrintfulProducts(prisma, { limit: 1 });

    // Second run — supplier already exists
    mockFetchSequence([makeListResponse([1]), makeDetailResponse(1)]);
    mock.supplier.findFirst.mockResolvedValueOnce({ id: 1, name: 'Printful' } as never);

    await importPrintfulProducts(prisma, { limit: 1 });

    expect(mock.supplier.create).toHaveBeenCalledTimes(1); // only on first run
  });

  it('imports products and returns correct counts', async () => {
    const prisma = makePrismaMock() as unknown as Parameters<typeof importPrintfulProducts>[0];
    mockFetchSequence([
      makeListResponse([1, 2]),
      makeDetailResponse(1),
      makeDetailResponse(2),
    ]);

    const result = await importPrintfulProducts(prisma, { limit: 2 });
    expect(result.fetched).toBe(2);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('skips products with no importable variants', async () => {
    const prisma = makePrismaMock() as unknown as Parameters<typeof importPrintfulProducts>[0];

    const noVariantDetail: SyncProductDetailResponse = {
      code: 200,
      result: {
        sync_product: {
          id: 99,
          external_id: 'ext-99',
          name: 'Ignored Product',
          variants: 1,
          synced: 0,
          thumbnail_url: null,
          is_ignored: false,
        },
        sync_variants: [
          {
            id: 990,
            external_id: 'ext-v-99',
            sync_product_id: 99,
            name: 'Ignored / S',
            synced: false,
            variant_id: 1234,
            retail_price: '0',
            currency: 'USD',
            is_ignored: false,
            options: [],
            files: [],
            product: { type: '' },
          },
        ],
      },
    };

    mockFetchSequence([makeListResponse([99]), noVariantDetail]);

    const result = await importPrintfulProducts(prisma, { limit: 1 });
    expect(result.fetched).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(0);
  });

  it('respects the limit option', async () => {
    const prisma = makePrismaMock() as unknown as Parameters<typeof importPrintfulProducts>[0];
    mockFetchSequence([
      makeListResponse([1, 2, 3], 3),
      makeDetailResponse(1),
    ]);

    const result = await importPrintfulProducts(prisma, { limit: 1 });
    expect(result.fetched).toBe(1);
  });
});
