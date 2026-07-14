import { prisma } from '../prismaClient';
import { CustomerAddress } from '../../domain/models/customer';
import {
  ICustomerAddressRepository,
  CustomerAddressCreateData,
  CustomerAddressUpdateData,
} from '../../domain/repositories/customerAddressRepository';
import { AddressNotFoundError } from './customerRepository';
import {
  unsetPreviousDefaultIfNeeded,
  isAddressDefaultConflict,
  AddressDefaultConflictError,
} from './customerAddressDefaultTransaction';

export class CustomerAddressRepository implements ICustomerAddressRepository {
  async findAllByCustomerId(customerId: number): Promise<CustomerAddress[]> {
    const rows = await prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => new CustomerAddress(r));
  }

  async findById(id: number, customerId: number): Promise<CustomerAddress | null> {
    const row = await prisma.customerAddress.findFirst({ where: { id, customerId } });
    return row ? new CustomerAddress(row) : null;
  }

  async create(customerId: number, data: CustomerAddressCreateData): Promise<CustomerAddress> {
    try {
      return await prisma.$transaction(async (tx) => {
        await unsetPreviousDefaultIfNeeded(tx, customerId, data.type, data.isDefault);
        const row = await tx.customerAddress.create({
          data: {
            customerId,
            type: data.type,
            isDefault: data.isDefault ?? false,
            fullName: data.fullName,
            phone: data.phone ?? null,
            streetLine1: data.streetLine1,
            streetLine2: data.streetLine2 ?? null,
            city: data.city,
            province: data.province,
            postalCode: data.postalCode,
            country: data.country,
          },
        });
        return new CustomerAddress(row);
      });
    } catch (err) {
      if (isAddressDefaultConflict(err)) throw new AddressDefaultConflictError();
      throw err;
    }
  }

  async update(id: number, customerId: number, data: CustomerAddressUpdateData): Promise<CustomerAddress> {
    try {
      return await prisma.$transaction(async (tx) => {
        const current = await tx.customerAddress.findFirst({ where: { id, customerId } });
        if (!current) throw new AddressNotFoundError();

        if (data.isDefault) {
          await unsetPreviousDefaultIfNeeded(tx, customerId, data.type ?? current.type, data.isDefault);
        }

        const row = await tx.customerAddress.update({
          where: { id },
          data: {
            ...(data.type !== undefined && { type: data.type }),
            ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
            ...(data.fullName !== undefined && { fullName: data.fullName }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.streetLine1 !== undefined && { streetLine1: data.streetLine1 }),
            ...(data.streetLine2 !== undefined && { streetLine2: data.streetLine2 }),
            ...(data.city !== undefined && { city: data.city }),
            ...(data.province !== undefined && { province: data.province }),
            ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
            ...(data.country !== undefined && { country: data.country }),
          },
        });
        return new CustomerAddress(row);
      });
    } catch (err) {
      if (isAddressDefaultConflict(err)) throw new AddressDefaultConflictError();
      throw err;
    }
  }

  async delete(id: number, customerId: number): Promise<void> {
    const current = await prisma.customerAddress.findFirst({ where: { id, customerId } });
    if (!current) throw new AddressNotFoundError();
    await prisma.customerAddress.delete({ where: { id } });
  }
}
