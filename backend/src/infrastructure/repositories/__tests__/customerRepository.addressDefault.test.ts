import { Prisma } from '@prisma/client';
import { CustomerRepository } from '../customerRepository';
import { AddressDefaultConflictError } from '../customerAddressDefaultTransaction';

const mockUpdateMany = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFindUniqueOrThrow = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    customerAddress: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
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

describe('CustomerRepository (admin) - address isDefault invariant', () => {
  let repo: CustomerRepository;

  beforeEach(() => {
    repo = new CustomerRepository();
    jest.clearAllMocks();
  });

  describe('createAddress', () => {
    it('should_unset_previous_default_of_the_same_type_before_creating', async () => {
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ customerAddress: { updateMany: mockUpdateMany, create: mockCreate } })
      );
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockCreate.mockResolvedValue(dbRow);

      await repo.createAddress(10, {
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
    });

    it('should_map_P2002_to_AddressDefaultConflictError', async () => {
      mockTransaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2002', clientVersion: '6.0.0' })
      );

      await expect(
        repo.createAddress(10, {
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

  describe('updateAddress', () => {
    it('should_unset_previous_default_using_the_addresss_current_type_when_isDefault_true', async () => {
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          customerAddress: {
            updateMany: mockUpdateMany,
            update: mockUpdate,
            findUniqueOrThrow: mockFindUniqueOrThrow,
          },
        })
      );
      mockFindUniqueOrThrow.mockResolvedValue({ type: 'Billing' });
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockUpdate.mockResolvedValue({ ...dbRow, type: 'Billing' });

      await repo.updateAddress(1, 10, { isDefault: true });

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { customerId: 10, type: 'Billing', isDefault: true },
        data: { isDefault: false },
      });
    });

    it('should_not_query_current_type_when_isDefault_is_not_set', async () => {
      mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          customerAddress: {
            updateMany: mockUpdateMany,
            update: mockUpdate,
            findUniqueOrThrow: mockFindUniqueOrThrow,
          },
        })
      );
      mockUpdate.mockResolvedValue(dbRow);

      await repo.updateAddress(1, 10, { city: 'Sevilla' });

      expect(mockFindUniqueOrThrow).not.toHaveBeenCalled();
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });
  });
});
