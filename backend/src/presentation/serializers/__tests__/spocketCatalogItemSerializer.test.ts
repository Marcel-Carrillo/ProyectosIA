import { SpocketCatalogItem } from '../../../domain/models/spocketCatalogItem';
import { serializeSpocketCatalogItem } from '../spocketCatalogItemSerializer';

describe('serializeSpocketCatalogItem', () => {
  it('should_include_only_the_documented_fields', () => {
    const item = new SpocketCatalogItem({
      id: 1,
      supplierIntegrationId: 5,
      externalRef: 'ext-1',
      title: 'Dress',
      size: 'M',
      color: 'Black',
      supplierCost: '9.99',
      stockQuantity: 3,
      rawPayload: { secret: 'value' },
      syncStatus: 'Synced',
      syncError: null,
      lastSyncedAt: new Date('2026-01-01'),
    });

    const dto = serializeSpocketCatalogItem(item);

    expect(dto).toEqual({
      id: 1,
      externalRef: 'ext-1',
      title: 'Dress',
      size: 'M',
      color: 'Black',
      supplierCost: '9.99',
      stockQuantity: 3,
      syncStatus: 'Synced',
      syncError: null,
      lastSyncedAt: item.lastSyncedAt,
    });
    expect(dto).not.toHaveProperty('supplierIntegrationId');
    expect(dto).not.toHaveProperty('rawPayload');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
  });

  it('should_default_null_fields_when_absent', () => {
    const item = new SpocketCatalogItem({
      supplierIntegrationId: 5,
      externalRef: 'ext-2',
      title: 'Skirt',
      supplierCost: '5.00',
      stockQuantity: 0,
      rawPayload: {},
      syncStatus: 'Failed',
    });

    const dto = serializeSpocketCatalogItem(item);

    expect(dto.size).toBeNull();
    expect(dto.color).toBeNull();
    expect(dto.syncError).toBeNull();
  });
});
