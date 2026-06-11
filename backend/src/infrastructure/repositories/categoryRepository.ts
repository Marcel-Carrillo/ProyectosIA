import { prisma } from '../prismaClient';
import { Category } from '../../domain/models';
import {
  ICategoryRepository,
  CategoryCreateData,
  CategoryUpdateData,
} from '../../domain/repositories';
import { ValidationError } from '../../application/validator';

export class CategoryNameConflictError extends Error {
  readonly code = 'CATEGORY_NAME_ALREADY_EXISTS' as const;
  readonly status = 409;

  constructor() {
    super('A category with this name already exists');
    this.name = 'CategoryNameConflictError';
    Object.setPrototypeOf(this, CategoryNameConflictError.prototype);
  }
}

export class CategoryNotFoundError extends Error {
  readonly code = 'CATEGORY_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Category not found');
    this.name = 'CategoryNotFoundError';
    Object.setPrototypeOf(this, CategoryNotFoundError.prototype);
  }
}

export class CategoryRepository implements ICategoryRepository {
  async findAll(includeInactive = false): Promise<Category[]> {
    const where = includeInactive ? {} : { status: 'Active' };
    const rows = await prisma.category.findMany({ where, orderBy: { name: 'asc' } });
    return rows.map((r) => new Category(r));
  }

  async findById(id: number): Promise<Category | null> {
    const row = await prisma.category.findUnique({ where: { id } });
    return row ? new Category(row) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const row = await prisma.category.findUnique({ where: { name } });
    return row ? new Category(row) : null;
  }

  async create(data: CategoryCreateData): Promise<Category> {
    const existing = await this.findByName(data.name);
    if (existing) throw new CategoryNameConflictError();

    const row = await prisma.category.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        imageUrl: data.imageUrl ?? null,
        status: data.status ?? 'Active',
        parentId: data.parentId ?? null,
      },
    });
    return new Category(row);
  }

  async update(id: number, data: CategoryUpdateData): Promise<Category> {
    const current = await this.findById(id);
    if (!current) throw new CategoryNotFoundError();

    if (data.parentId !== undefined && data.parentId === id) {
      throw new ValidationError('A category cannot reference itself as its own parent');
    }

    if (data.name && data.name !== current.name) {
      const conflict = await this.findByName(data.name);
      if (conflict) throw new CategoryNameConflictError();
    }

    const row = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
      },
    });
    return new Category(row);
  }

  async softDelete(id: number): Promise<Category> {
    const current = await this.findById(id);
    if (!current) throw new CategoryNotFoundError();

    const row = await prisma.category.update({
      where: { id },
      data: { status: 'Inactive' },
    });
    return new Category(row);
  }
}
