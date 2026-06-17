export type SupplierStatus = 'Active' | 'Inactive' | 'Blocked';

export class Supplier {
  id?: number;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status: SupplierStatus;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    name: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    website?: string | null;
    notes?: string | null;
    status?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.name = data.name;
    this.contactName = data.contactName ?? null;
    this.contactEmail = data.contactEmail ?? null;
    this.contactPhone = data.contactPhone ?? null;
    this.website = data.website ?? null;
    this.notes = data.notes ?? null;
    this.status = (data.status as SupplierStatus) ?? 'Active';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
