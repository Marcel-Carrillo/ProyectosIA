import { CjCatalogItem } from '../../../domain/models/cjCatalogItem';
import { serializeCjCatalogItem } from '../cjCatalogItemSerializer';

describe('serializeCjCatalogItem', () => {
  it('should_include_only_the_documented_fields', () => {
    const item = new CjCatalogItem({
      id: 1,
      supplierIntegrationId: 5,
      externalRef: 'ext-1',
      pid: 'p1',
      vid: 'ext-1',
      sku: 'SKU-1',
      categoryId: 'cat-1',
      title: 'Dress',
      size: 'M',
      color: 'Black',
      supplierCost: '9.99',
      sellPrice: '19.99',
      stockQuantity: 3,
      warehouseInventoryNum: 10,
      rawPayload: { secret: 'value' },
      syncStatus: 'Synced',
      syncError: null,
      lastSyncedAt: new Date('2026-01-01'),
    });

    const dto = serializeCjCatalogItem(item);

    expect(dto).toEqual({
      id: 1,
      externalRef: 'ext-1',
      title: 'Dress',
      sku: 'SKU-1',
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
    expect(dto).not.toHaveProperty('pid');
    expect(dto).not.toHaveProperty('vid');
    expect(dto).not.toHaveProperty('categoryId');
    expect(dto).not.toHaveProperty('sellPrice');
    expect(dto).not.toHaveProperty('warehouseInventoryNum');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
  });

  it('should_default_null_fields_when_absent', () => {
    const item = new CjCatalogItem({
      supplierIntegrationId: 5,
      externalRef: 'ext-2',
      title: 'Skirt',
      supplierCost: '5.00',
      stockQuantity: 0,
      rawPayload: {},
      syncStatus: 'Failed',
    });

    const dto = serializeCjCatalogItem(item);

    expect(dto.sku).toBeNull();
    expect(dto.size).toBeNull();
    expect(dto.color).toBeNull();
    expect(dto.syncError).toBeNull();
  });
});
