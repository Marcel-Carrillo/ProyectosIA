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

const SUPPLIER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSupplierOptionalFields(data: Record<string, unknown>): void {
  const contactName = data['contactName'];
  if (contactName !== undefined && contactName !== null && contactName !== '') {
    if (typeof contactName === 'string' && contactName.length > 150) {
      throw new ValidationError("Field 'contactName' must not exceed 150 characters");
    }
  }

  const contactEmail = data['contactEmail'];
  
  if (contactEmail !== undefined && contactEmail !== null && contactEmail !== '') {
    if (typeof contactEmail !== 'string') {
      throw new ValidationError("Field 'contactEmail' must be a string");
    }
  
    if (contactEmail.length > 255) {
      throw new ValidationError("Field 'contactEmail' must not exceed 255 characters");
    }
  
    if (!SUPPLIER_EMAIL_REGEX.test(contactEmail)) {
      throw new ValidationError("Field 'contactEmail' must be a valid email address");
    }
  }

  const contactPhone = data['contactPhone'];
  if (contactPhone !== undefined && contactPhone !== null && contactPhone !== '') {
    if (typeof contactPhone === 'string' && contactPhone.length > 30) {
      throw new ValidationError("Field 'contactPhone' must not exceed 30 characters");
    }
  }

  const website = data['website'];
  if (website !== undefined && website !== null && website !== '') {
    if (typeof website === 'string' && website.length > 500) {
      throw new ValidationError("Field 'website' must not exceed 500 characters");
    }
  }

  const notes = data['notes'];
  if (notes !== undefined && notes !== null && notes !== '') {
    if (typeof notes === 'string' && notes.length > 2000) {
      throw new ValidationError("Field 'notes' must not exceed 2000 characters");
    }
  }

  const status = data['status'];
  if (status !== undefined && status !== null && status !== '') {
    const validStatuses = ['Active', 'Inactive', 'Blocked'];
    if (!validStatuses.includes(status as string)) {
      throw new ValidationError(`Field 'status' must be one of: ${validStatuses.join(', ')}`);
    }
  }
}

export function validateSupplierData(
  data: Record<string, unknown>,
  options: { requireName?: boolean } = { requireName: true }
): void {
  const name = data['name'];
  if (options.requireName !== false) {
    if (name === undefined || name === null || name === '') {
      throw new ValidationError("Field 'name' is required");
    }
  }
  if (name !== undefined && name !== null && name !== '') {
    if (typeof name === 'string' && name.length > 150) {
      throw new ValidationError("Field 'name' must not exceed 150 characters");
    }
  }
  validateSupplierOptionalFields(data);
}
