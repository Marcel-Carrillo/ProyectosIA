import { prisma } from '../../infrastructure/prismaClient';
import { ValidationError } from '../validator';
import { isStorefrontCategoryName } from '../constants/storefrontCategories';

/**
 * Ensures storefrontCategoryId points at an Active Women/Men/Accessories/Shoes
 * category. Used by ProductService when an admin assigns store placement.
 */
export async function assertValidStorefrontCategoryId(id: number): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category || category.status !== 'Active' || !isStorefrontCategoryName(category.name)) {
    throw new ValidationError(
      "Field 'storefrontCategoryId' must reference an Active storefront category (Women, Men, Accessories, or Shoes)",
    );
  }
}

/** Structural check / normalize for create & update payloads (mutates in place). */
export function validateAndNormalizeStorefrontCategoryIdField(data: Record<string, unknown>): void {
  if (!Object.prototype.hasOwnProperty.call(data, 'storefrontCategoryId')) return;
  const raw = data['storefrontCategoryId'];
  if (raw === null) {
    data['storefrontCategoryId'] = null;
    return;
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0) {
    throw new ValidationError("Field 'storefrontCategoryId' must be a positive integer or null");
  }
}
