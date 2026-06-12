export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export function validateRequiredFields(
  data: Record<string, unknown>,
  fields: string[]
): void {
  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`Field '${field}' is required`);
    }
  }
}

export function validateProductData(data: Record<string, unknown>): void {
  const name = data['name'];
  if (name === undefined || name === null || name === '') {
    throw new ValidationError("Field 'name' is required");
  }
  if (typeof name === 'string' && name.length > 150) {
    throw new ValidationError("Field 'name' must not exceed 150 characters");
  }

  const status = data['status'];
  if (status !== undefined && status !== null && status !== '') {
    const validStatuses = ['Draft', 'Active', 'Inactive', 'Archived'];
    if (!validStatuses.includes(status as string)) {
      throw new ValidationError(`Field 'status' must be one of: ${validStatuses.join(', ')}`);
    }
  }
}

export function validateProductVariantPublicPrice(publicPrice: unknown): void {
  if (publicPrice === undefined || publicPrice === null || publicPrice === '') {
    throw new ValidationError("Field 'publicPrice' is required");
  }
  const price = Number(publicPrice);
  if (isNaN(price) || price <= 0) {
    throw new ValidationError("Field 'publicPrice' must be a positive number");
  }
}

export function validateProductVariantData(data: Record<string, unknown>): void {
  validateProductVariantPublicPrice(data['publicPrice']);

  const sku = data['sku'];
  if (sku === undefined || sku === null || sku === '') {
    throw new ValidationError("Field 'sku' is required");
  }
}

export function validateProductImageData(data: Record<string, unknown>): void {
  const url = data['url'];
  if (url === undefined || url === null || url === '') {
    throw new ValidationError("Field 'url' is required");
  }
  if (typeof url === 'string' && url.length > 500) {
    throw new ValidationError("Field 'url' must not exceed 500 characters");
  }
}

export function validateCategoryData(data: Record<string, unknown>): void {
  const name = data['name'];
  if (name === undefined || name === null || name === '') {
    throw new ValidationError("Field 'name' is required");
  }

  const status = data['status'];
  if (status !== undefined && status !== null && status !== '') {
    if (status !== 'Active' && status !== 'Inactive') {
      throw new ValidationError("Field 'status' must be 'Active' or 'Inactive'");
    }
  }

  const parentId = data['parentId'];
  if (parentId !== undefined && parentId !== null) {
    if (typeof parentId !== 'number' || !Number.isInteger(parentId) || parentId <= 0) {
      throw new ValidationError("Field 'parentId' must be a positive integer");
    }
  }
}
