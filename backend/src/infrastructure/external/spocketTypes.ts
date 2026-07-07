export interface SpocketVariantDto {
  externalRef: string;
  size?: string;
  color?: string;
  cost: number;
  stockQuantity: number;
}

export interface SpocketProductDto {
  externalRef: string;
  title: string;
  variants: SpocketVariantDto[];
}

export interface SpocketCatalogPage {
  products: SpocketProductDto[];
  nextPageToken?: string | null;
}

export interface SpocketVerifyResult {
  healthy: boolean;
  externalAccountRef?: string;
}

// Port consumed by application services — implemented by SpocketApiClient.
// Kept separate from the concrete client so services can be unit-tested with a
// hand-written fake instead of mocking HTTP, mirroring the
// ISupplierRepository/SupplierRepository split applied to an external HTTP
// dependency instead of Prisma.
export interface ISpocketClient {
  verifyConnection(): Promise<SpocketVerifyResult>;
  fetchCatalog(pageToken?: string): Promise<SpocketCatalogPage>;
}
