import {
  IProductImageRepository,
  IProductRepository,
  ProductImageCreateData,
  ProductImageUpdateData,
} from '../../domain/repositories/productRepository';
import { ProductImage } from '../../domain/models/productImage';
import { validateProductImageData } from '../validator';
import { ProductNotFoundError } from '../../infrastructure/repositories/productRepository';
import { ImageNotFoundError } from '../../infrastructure/repositories/productImageRepository';

export class ProductImageService {
  constructor(
    private readonly imageRepo: IProductImageRepository,
    private readonly productRepo: IProductRepository,
  ) {}

  async listByProduct(productId: number): Promise<ProductImage[]> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    return this.imageRepo.findByProduct(productId);
  }

  async findById(productId: number, id: number): Promise<ProductImage> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const image = await this.imageRepo.findById(id);
    if (!image || image.productId !== productId) throw new ImageNotFoundError();
    return image;
  }

  async add(data: ProductImageCreateData): Promise<ProductImage> {
    validateProductImageData(data as Record<string, unknown>);
    const product = await this.productRepo.findById(data.productId);
    if (!product) throw new ProductNotFoundError();
    return this.imageRepo.create(data);
  }

  async update(productId: number, id: number, data: ProductImageUpdateData): Promise<ProductImage> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const image = await this.imageRepo.findById(id);
    if (!image || image.productId !== productId) throw new ImageNotFoundError();
    return this.imageRepo.update(id, data);
  }

  async remove(productId: number, id: number): Promise<void> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const image = await this.imageRepo.findById(id);
    if (!image || image.productId !== productId) throw new ImageNotFoundError();
    return this.imageRepo.remove(id);
  }
}
