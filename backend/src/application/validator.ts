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

const CUSTOMER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomerData(
  data: Record<string, unknown>,
  options: { requireFields?: boolean } = { requireFields: true }
): void {
  const firstName = data['firstName'];
  if (options.requireFields !== false) {
    if (firstName === undefined || firstName === null || firstName === '') {
      throw new ValidationError("Field 'firstName' is required");
    }
  }
  if (firstName !== undefined && firstName !== null && firstName !== '') {
    if (typeof firstName === 'string' && firstName.length > 100) {
      throw new ValidationError("Field 'firstName' must not exceed 100 characters");
    }
  }

  const lastName = data['lastName'];
  if (options.requireFields !== false) {
    if (lastName === undefined || lastName === null || lastName === '') {
      throw new ValidationError("Field 'lastName' is required");
    }
  }
  if (lastName !== undefined && lastName !== null && lastName !== '') {
    if (typeof lastName === 'string' && lastName.length > 100) {
      throw new ValidationError("Field 'lastName' must not exceed 100 characters");
    }
  }

  const email = data['email'];
  if (options.requireFields !== false) {
    if (email === undefined || email === null || email === '') {
      throw new ValidationError("Field 'email' is required");
    }
  }
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string') {
      throw new ValidationError("Field 'email' must be a string");
    }
    if (email.length > 255) {
      throw new ValidationError("Field 'email' must not exceed 255 characters");
    }
    if (!CUSTOMER_EMAIL_REGEX.test(email)) {
      throw new ValidationError("Field 'email' must be a valid email address");
    }
  }

  const phone = data['phone'];
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone === 'string' && phone.length > 30) {
      throw new ValidationError("Field 'phone' must not exceed 30 characters");
    }
  }
}

export function validateCustomerAddressData(
  data: Record<string, unknown>,
  options: { requireAll?: boolean } = { requireAll: true }
): void {
  const VALID_TYPES = ['Shipping', 'Billing'];

  const type = data['type'];
  if (options.requireAll !== false) {
    if (type === undefined || type === null || type === '') {
      throw new ValidationError("Field 'type' is required");
    }
  }
  if (type !== undefined && type !== null && type !== '') {
    if (!VALID_TYPES.includes(type as string)) {
      throw new ValidationError(`Field 'type' must be one of: ${VALID_TYPES.join(', ')}`);
    }
  }

  const fullName = data['fullName'];
  if (options.requireAll !== false) {
    if (fullName === undefined || fullName === null || fullName === '') {
      throw new ValidationError("Field 'fullName' is required");
    }
  }
  if (fullName !== undefined && fullName !== null && fullName !== '') {
    if (typeof fullName === 'string' && fullName.length > 150) {
      throw new ValidationError("Field 'fullName' must not exceed 150 characters");
    }
  }

  const streetLine1 = data['streetLine1'];
  if (options.requireAll !== false) {
    if (streetLine1 === undefined || streetLine1 === null || streetLine1 === '') {
      throw new ValidationError("Field 'streetLine1' is required");
    }
  }
  if (streetLine1 !== undefined && streetLine1 !== null && streetLine1 !== '') {
    if (typeof streetLine1 === 'string' && streetLine1.length > 150) {
      throw new ValidationError("Field 'streetLine1' must not exceed 150 characters");
    }
  }

  const streetLine2 = data['streetLine2'];
  if (streetLine2 !== undefined && streetLine2 !== null && streetLine2 !== '') {
    if (typeof streetLine2 === 'string' && streetLine2.length > 150) {
      throw new ValidationError("Field 'streetLine2' must not exceed 150 characters");
    }
  }

  const city = data['city'];
  if (options.requireAll !== false) {
    if (city === undefined || city === null || city === '') {
      throw new ValidationError("Field 'city' is required");
    }
  }
  if (city !== undefined && city !== null && city !== '') {
    if (typeof city === 'string' && city.length > 100) {
      throw new ValidationError("Field 'city' must not exceed 100 characters");
    }
  }

  const province = data['province'];
  if (options.requireAll !== false) {
    if (province === undefined || province === null || province === '') {
      throw new ValidationError("Field 'province' is required");
    }
  }
  if (province !== undefined && province !== null && province !== '') {
    if (typeof province === 'string' && province.length > 100) {
      throw new ValidationError("Field 'province' must not exceed 100 characters");
    }
  }

  const postalCode = data['postalCode'];
  if (options.requireAll !== false) {
    if (postalCode === undefined || postalCode === null || postalCode === '') {
      throw new ValidationError("Field 'postalCode' is required");
    }
  }
  if (postalCode !== undefined && postalCode !== null && postalCode !== '') {
    if (typeof postalCode === 'string' && postalCode.length > 20) {
      throw new ValidationError("Field 'postalCode' must not exceed 20 characters");
    }
  }

  const country = data['country'];
  if (options.requireAll !== false) {
    if (country === undefined || country === null || country === '') {
      throw new ValidationError("Field 'country' is required");
    }
  }
  if (country !== undefined && country !== null && country !== '') {
    if (typeof country === 'string' && country.length > 100) {
      throw new ValidationError("Field 'country' must not exceed 100 characters");
    }
  }

  const phone = data['phone'];
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone === 'string' && phone.length > 30) {
      throw new ValidationError("Field 'phone' must not exceed 30 characters");
    }
  }
}
