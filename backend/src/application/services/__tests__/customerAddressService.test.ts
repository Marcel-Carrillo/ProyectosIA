import { CustomerAddressService } from '../customerAddressService';
import { AddressNotFoundError } from '../../../infrastructure/repositories/customerRepository';
import { ICustomerAddressRepository } from '../../../domain/repositories/customerAddressRepository';
import { CustomerAddress } from '../../../domain/models/customer';

function makeAddress(overrides: Partial<CustomerAddress> = {}): CustomerAddress {
  return new CustomerAddress({
    id: 1,
    customerId: 10,
    type: 'Shipping',
    isDefault: false,
    fullName: 'Ana Garcia',
    streetLine1: 'Calle 1',
    city: 'Madrid',
    province: 'Madrid',
    postalCode: '28001',
    country: 'Spain',
    ...overrides,
  });
}

describe('CustomerAddressService', () => {
  let repo: jest.Mocked<ICustomerAddressRepository>;
  let service: CustomerAddressService;

  beforeEach(() => {
    repo = {
      findAllByCustomerId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new CustomerAddressService(repo);
  });

  describe('list', () => {
    it('should_delegate_to_repo_findAllByCustomerId', async () => {
      repo.findAllByCustomerId.mockResolvedValue([makeAddress()]);
      const result = await service.list(10);
      expect(repo.findAllByCustomerId).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should_validate_and_create_with_isDefault_true', async () => {
      repo.create.mockResolvedValue(makeAddress({ isDefault: true }));

      const result = await service.create(10, {
        type: 'Shipping',
        isDefault: true,
        fullName: 'Ana',
        streetLine1: 'Calle 1',
        city: 'Madrid',
        province: 'Madrid',
        postalCode: '28001',
        country: 'Spain',
      });

      expect(repo.create).toHaveBeenCalledWith(10, expect.objectContaining({ isDefault: true }));
      expect(result.isDefault).toBe(true);
    });

    it('should_throw_ValidationError_when_a_required_field_is_missing', async () => {
      await expect(
        service.create(10, { type: 'Shipping', fullName: 'Ana' })
      ).rejects.toThrow();
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should_throw_AddressNotFoundError_when_repo_findById_returns_null', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update(10, 999, { city: 'Barcelona' })).rejects.toBeInstanceOf(
        AddressNotFoundError
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should_update_when_ownership_confirmed', async () => {
      repo.findById.mockResolvedValue(makeAddress());
      repo.update.mockResolvedValue(makeAddress({ city: 'Barcelona' }));

      const result = await service.update(10, 1, { city: 'Barcelona' });

      expect(repo.update).toHaveBeenCalledWith(1, 10, { city: 'Barcelona' });
      expect(result.city).toBe('Barcelona');
    });
  });

  describe('delete', () => {
    it('should_throw_AddressNotFoundError_when_repo_findById_returns_null', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete(10, 999)).rejects.toBeInstanceOf(AddressNotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('should_delete_when_ownership_confirmed', async () => {
      repo.findById.mockResolvedValue(makeAddress());
      await service.delete(10, 1);
      expect(repo.delete).toHaveBeenCalledWith(1, 10);
    });
  });
});
