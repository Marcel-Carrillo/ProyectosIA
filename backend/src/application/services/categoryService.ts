import {
  ICategoryRepository,
  CategoryCreateData,
  CategoryUpdateData,
} from '../../domain/repositories';
import { Category } from '../../domain/models';
import { validateCategoryData } from '../validator';
import { CategoryNotFoundError } from '../../infrastructure/repositories/categoryRepository';

export class CategoryService {
  constructor(private readonly repo: ICategoryRepository) {}

  async findAll(includeInactive = false): Promise<Category[]> {
    return this.repo.findAll(includeInactive);
  }

  async findById(id: number): Promise<Category> {
    const category = await this.repo.findById(id);
    if (!category) throw new CategoryNotFoundError();
    return category;
  }

  async create(data: CategoryCreateData): Promise<Category> {
    validateCategoryData(data as unknown as Record<string, unknown>);
    return this.repo.create(data);
  }

  async update(id: number, data: CategoryUpdateData): Promise<Category> {
    if (Object.keys(data).length > 0) {
      validateCategoryData({ name: data.name ?? 'placeholder', ...data } as Record<string, unknown>);
    }
    return this.repo.update(id, data);
  }

  async softDelete(id: number): Promise<Category> {
    return this.repo.softDelete(id);
  }
}
