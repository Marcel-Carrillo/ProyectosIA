import * as path from 'path';

export interface SupplierFeedSupplierRef {
  name: string;
  reference: string;
}

export interface SupplierFeedVariant {
  sku: string;
  size?: string;
  color?: string;
  publicPrice: number;
}

export interface SupplierFeedProduct {
  supplier: SupplierFeedSupplierRef;
  externalRef: string;
  title: string;
  description: string;
  brand: string;
  ean?: string;
  category: string;
  supplierCost: number;
  images: string[];
  variants: SupplierFeedVariant[];
}

// Mirrors ESCUELAJS_PRODUCTS_URL: a source constant, but a local file path instead of
// an HTTP URL, since this importer reads an offline fixture (design.md decision 2).
export const SupplierFeedSource = path.join(
  __dirname,
  '../../../prisma/fixtures/supplier-feed.sample.json',
);
