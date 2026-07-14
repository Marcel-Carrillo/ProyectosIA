import { Prisma } from '@prisma/client';
import { CustomerAddressRepository } from '../customerAddressRepository';
import { AddressNotFoundError } from '../customerRepository';
import { AddressDefaultConflictError } from '../customerAddressDefaultTransaction';

const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockUpdateMany = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    customerAddress: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const dbRow = {
  id: 1,
  customerId: 10,
  type: 'Shipping',
  isDefault: true,
  fullName: 'Ana Garcia',
  phone: null,
  streetLine1: 'Calle 1',
  streetLine2: null,
  city: 'Madrid',
  province: 'Madrid',
  postalCode: '28001',
  country: 'Spain',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('CustomerAddressRepository', () => {
  let repo: CustomerAddressRepository;

  beforeEach(() => {
    repo = new CustomerAddressRepository();
    jest.clearAllMocks();
  });

  describe('findAllByCustomerId', () => {
    it('should_scope_query_to_the_given_customerId', async () => {
      mockFindMany.mockResolvedValue([dbRow]);
      const result = await repo.findAllByCustomerId(10);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: 10 } })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should_unset_previous_default_before_creating_when_isDefault_true', async () => {
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          customerAddress: { updateMany: mockUpdateMany, create: mockCreate },
        })
      );
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockCreate.mockResolvedValue(dbRow);

      await repo.create(10, {
        type: 'Shipping',
        isDefault: true,
        fullName: 'Ana',
        streetLine1: 'Calle 1',
        city: 'Madrid',
        province: 'Madrid',
        postalCode: '28001',
        country: 'Spain',
      });

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { customerId: 10, type: 'Shipping', isDefault: true },
        data: { isDefault: false },
      });
      const unsetCallOrder = mockUpdateMany.mock.invocationCallOrder[0]!;
      const createCallOrder = mockCreate.mock.invocationCallOrder[0]!;
      expect(unsetCallOrder).toBeLessThan(createCallOrder);
    });

    it('should_not_call_updateMany_when_isDefault_is_not_set', async () => {
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ customerAddress: { updateMany: mockUpdateMany, create: mockCreate } })
      );
      mockCreate.mockResolvedValue({ ...dbRow, isDefault: false });

      await repo.create(10, {
        type: 'Shipping',
        fullName: 'Ana',
        streetLine1: 'Calle 1',
        city: 'Madrid',
        province: 'Madrid',
        postalCode: '28001',
        country: 'Spain',
      });

      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it('should_map_a_P2002_conflict_to_AddressDefaultConflictError', async () => {
      mockTransaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2002', clientVersion: '6.0.0' })
      );

      await expect(
        repo.create(10, {
          type: 'Shipping',
          isDefault: true,
          fullName: 'Ana',
          streetLine1: 'Calle 1',
          city: 'Madrid',
          province: 'Madrid',
          postalCode: '28001',
          country: 'Spain',
        })
      ).rejects.toBeInstanceOf(AddressDefaultConflictError);
    });
  });

  describe('update', () => {
    it('should_throw_AddressNotFoundError_when_address_does_not_belong_to_customer', async () => {
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ customerAddress: { findFirst: mockFindFirst, updateMany: mockUpdateMany, update: mockUpdate } })
      );
      mockFindFirst.mockResolvedValue(null);

      await expect(repo.update(1, 999, { city: 'Barcelona' })).rejects.toBeInstanceOf(AddressNotFoundError);
    });

    it('should_unset_previous_default_when_setting_a_new_default', async () => {
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          customerAddress: {
            findFirst: mockFindFirst,
            updateMany: mockUpdateMany,
            update: mockUpdate,
          },
        })
      );
      mockFindFirst.mockResolvedValue({ ...dbRow, isDefault: false });
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockUpdate.mockResolvedValue({ ...dbRow, isDefault: true });

      await repo.update(1, 10, { isDefault: true });

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { customerId: 10, type: 'Shipping', isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('delete', () => {
    it('should_throw_AddressNotFoundError_when_address_does_not_belong_to_customer', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(repo.delete(1, 999)).rejects.toBeInstanceOf(AddressNotFoundError);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('should_delete_when_ownership_confirmed', async () => {
      mockFindFirst.mockResolvedValue(dbRow);
      mockDelete.mockResolvedValue(dbRow);
      await repo.delete(1, 10);
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
