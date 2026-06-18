export class Customer {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  addresses?: CustomerAddress[];

  constructor(data: {
    id?: number;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    addresses?: CustomerAddress[];
  }) {
    this.id = data.id;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.email = data.email;
    this.phone = data.phone ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.addresses = data.addresses;
  }
}

export class CustomerAddress {
  id?: number;
  customerId: number;
  type: string;
  fullName: string;
  phone?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    customerId: number;
    type: string;
    fullName: string;
    phone?: string | null;
    streetLine1: string;
    streetLine2?: string | null;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.customerId = data.customerId;
    this.type = data.type;
    this.fullName = data.fullName;
    this.phone = data.phone ?? null;
    this.streetLine1 = data.streetLine1;
    this.streetLine2 = data.streetLine2 ?? null;
    this.city = data.city;
    this.province = data.province;
    this.postalCode = data.postalCode;
    this.country = data.country;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
