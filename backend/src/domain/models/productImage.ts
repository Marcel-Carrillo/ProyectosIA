export class ProductImage {
  id?: number;
  productId: number;
  url: string;
  altText?: string | null;
  sortOrder: number;
  createdAt?: Date;

  constructor(data: {
    id?: number;
    productId: number;
    url: string;
    altText?: string | null;
    sortOrder?: number;
    createdAt?: Date;
  }) {
    this.id = data.id;
    this.productId = data.productId;
    this.url = data.url;
    this.altText = data.altText ?? null;
    this.sortOrder = data.sortOrder ?? 0;
    this.createdAt = data.createdAt;
  }
}
