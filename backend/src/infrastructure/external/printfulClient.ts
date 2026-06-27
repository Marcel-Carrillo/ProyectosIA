import {
  PRINTFUL_API_BASE_URL,
  CatalogProductDetail,
  CatalogProductDetailResponse,
  CatalogProductListItem,
  CatalogProductListResponse,
  CatalogVariant,
  PrintfulPaging,
  SyncProductDetail,
  SyncProductDetailResponse,
  SyncProductListItem,
  SyncProductListResponse,
  SyncVariant,
} from './printfulTypes';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.PRINTFUL_API_KEY ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function fetchWithBackoff(url: string, retries = 3): Promise<Response> {
  const headers = buildAuthHeaders();
  let attempt = 0;

  while (true) {
    const response = await fetch(url, { headers });

    if (response.status === 429 && attempt < retries) {
      const waitMs = Math.pow(2, attempt) * 1000;
      await sleep(waitMs);
      attempt += 1;
      continue;
    }

    if (!response.ok) {
      const path = new URL(url).pathname;
      throw new Error(`Printful API error: HTTP ${response.status} at GET ${path}`);
    }

    return response;
  }
}

export async function fetchSyncProductList(
  offset: number,
  limit: number,
): Promise<{ items: SyncProductListItem[]; paging: PrintfulPaging }> {
  const url = `${PRINTFUL_API_BASE_URL}/sync/products?offset=${offset}&limit=${limit}`;
  const response = await fetchWithBackoff(url);
  const data = (await response.json()) as SyncProductListResponse;
  return { items: data.result, paging: data.paging };
}

export async function fetchSyncProductDetail(
  id: number,
): Promise<{ syncProduct: SyncProductDetail; syncVariants: SyncVariant[] }> {
  const url = `${PRINTFUL_API_BASE_URL}/sync/products/${id}`;
  const response = await fetchWithBackoff(url);
  const data = (await response.json()) as SyncProductDetailResponse;
  return {
    syncProduct: data.result.sync_product,
    syncVariants: data.result.sync_variants,
  };
}

// ── Catalog API (no store required) ─────────────────────────────────────────

export async function fetchCatalogProductList(
  offset: number,
  limit: number,
): Promise<{ items: CatalogProductListItem[]; paging: PrintfulPaging | undefined }> {
  const url = `${PRINTFUL_API_BASE_URL}/products?offset=${offset}&limit=${limit}`;
  const response = await fetchWithBackoff(url);
  const data = (await response.json()) as CatalogProductListResponse;
  return { items: data.result, paging: data.paging };
}

export async function fetchCatalogProductDetail(
  id: number,
): Promise<{ catalogProduct: CatalogProductDetail; catalogVariants: CatalogVariant[] }> {
  const url = `${PRINTFUL_API_BASE_URL}/products/${id}`;
  const response = await fetchWithBackoff(url);
  const data = (await response.json()) as CatalogProductDetailResponse;
  return {
    catalogProduct: data.result.product,
    catalogVariants: data.result.variants,
  };
}
