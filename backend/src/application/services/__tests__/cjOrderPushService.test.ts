import { SupplierOrder, SupplierOrderItem } from '../../../domain/models/supplierOrder';
import { ISupplierOrderRepository } from '../../../domain/repositories/supplierOrderRepository';
import { ISupplierIntegrationRepository } from '../../../domain/repositories/supplierIntegrationRepository';
import { ICjCatalogItemRepository } from '../../../domain/repositories/cjCatalogItemRepository';
import { IAutomationSettingsRepository } from '../../../domain/repositories/automationSettingsRepository';
import { CjCatalogItem } from '../../../domain/models/cjCatalogItem';
import { SupplierIntegration } from '../../../domain/models/supplierIntegration';
import { ICjClient } from '../../../infrastructure/external/cjTypes';

const mockCustomerOrderFindUnique = jest.fn();

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    customerOrder: { findUnique: (...args: unknown[]) => mockCustomerOrderFindUnique(...args) },
  },
}));

import { CjOrderPushService, selectCheapestLogistic } from '../cjOrderPushService';
import { SupplierOrderNotFoundError } from '../../../infrastructure/repositories/supplierOrderRepository';
import { SupplierIntegrationNotFoundError } from '../../../infrastructure/repositories/supplierIntegrationRepository';
import {
  CjItemNotMappedError,
  CjOrderAlreadyPushedError,
  CjOrderNotPushedError,
  CjApiUnavailableError,
  CjCarrierAllowListExhaustedError,
} from '../../validator';

function makeOrder(overrides: Partial<ConstructorParameters<typeof SupplierOrder>[0]> = {}) {
  return new SupplierOrder({
    id: 1,
    supplierOrderNumber: 'SPO-000001',
    customerOrderId: 1,
    supplierId: 1,
    items: [
      new SupplierOrderItem({
        customerOrderItemId: 1,
        productVariantId: 1,
        quantity: 2,
        supplierCost: '10.00',
        supplierReferenceSnapshot: 'ext-1',
      }),
    ],
    ...overrides,
  });
}

function makeCatalogItem() {
  return new CjCatalogItem({
    supplierIntegrationId: 1,
    externalRef: 'ext-1',
    title: 'Test',
    supplierCost: '10.00',
    stockQuantity: 5,
    rawPayload: {},
  });
}

function makeMockCjClient(): jest.Mocked<ICjClient> {
  return {
    verifyConnection: jest.fn(),
    fetchCategories: jest.fn(),
    fetchCatalog: jest.fn(),
    fetchVariants: jest.fn(),
    calculateFreight: jest.fn(),
    createOrder: jest.fn(),
    getOrderDetail: jest.fn(),
  };
}

const addressSnapshot = {
  fullName: 'Jane Doe',
  phone: '+34600000000',
  streetLine1: 'Main Street 10',
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
};

describe('CjOrderPushService', () => {
  let supplierOrderRepo: jest.Mocked<ISupplierOrderRepository>;
  let integrationRepo: jest.Mocked<ISupplierIntegrationRepository>;
  let catalogRepo: jest.Mocked<ICjCatalogItemRepository>;
  let cjClient: jest.Mocked<ICjClient>;
  let settingsRepo: jest.Mocked<IAutomationSettingsRepository>;
  let service: CjOrderPushService;

  beforeEach(() => {
    jest.clearAllMocks();
    supplierOrderRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCustomerOrderId: jest.fn(),
      findByExternalOrderId: jest.fn(),
      create: jest.fn(),
      generateFromCustomerOrder: jest.fn(),
      updateStatus: jest.fn(),
      updateExternalOrder: jest.fn(),
      updateExternalOrderStatus: jest.fn(),
      generateNextSupplierOrderNumber: jest.fn(),
      recomputeCustomerFulfillmentStatus: jest.fn(),
      findPushedNonTerminal: jest.fn(),
    };
    integrationRepo = {
      findBySupplierId: jest.fn(),
      upsert: jest.fn(),
      updateStatus: jest.fn(),
      updateLastSyncedAt: jest.fn(),
      updateCatalogSyncCursor: jest.fn(),
    };
    catalogRepo = {
      upsertMany: jest.fn(),
      reconcilePromotedVariantStock: jest.fn().mockResolvedValue({ deactivated: 0, reactivated: 0 }),
      findBySupplierIntegrationId: jest.fn(),
      findByExternalRef: jest.fn(),
      findById: jest.fn(),
      findManyByIds: jest.fn(),
    };
    cjClient = makeMockCjClient();
    settingsRepo = {
      get: jest.fn().mockResolvedValue({ id: 1, targetMargin: 5, defaultFreightDestinationCountry: 'ES', carrierAllowList: [] }),
      update: jest.fn(),
    };
    service = new CjOrderPushService(supplierOrderRepo, integrationRepo, catalogRepo, cjClient, settingsRepo);
    mockCustomerOrderFindUnique.mockResolvedValue({ shippingAddressSnapshot: addressSnapshot });
  });

  describe('quoteFreight', () => {
    it('should_return_the_clients_raw_freight_options', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected' }));
      catalogRepo.findByExternalRef.mockResolvedValue(makeCatalogItem());
      const options = [{ logisticName: 'CJPacket Ordinary', logisticAging: '4-8', logisticPrice: 8.95, totalPostageFee: 7.31 }];
      cjClient.calculateFreight.mockResolvedValue(options);

      const result = await service.quoteFreight(1);

      expect(result).toEqual(options);
      expect(cjClient.calculateFreight).toHaveBeenCalledWith(
        expect.objectContaining({ endCountryCode: 'ES', products: [{ vid: 'ext-1', quantity: 2 }] })
      );
    });

    it('should_throw_CjItemNotMappedError_when_an_item_has_no_staged_variant', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected' }));
      catalogRepo.findByExternalRef.mockResolvedValue(null);

      await expect(service.quoteFreight(1)).rejects.toBeInstanceOf(CjItemNotMappedError);
      expect(cjClient.calculateFreight).not.toHaveBeenCalled();
    });

    it('should_throw_SupplierOrderNotFoundError_when_order_missing', async () => {
      supplierOrderRepo.findById.mockResolvedValue(null);

      await expect(service.quoteFreight(999)).rejects.toBeInstanceOf(SupplierOrderNotFoundError);
    });

    it('should_throw_SupplierIntegrationNotFoundError_when_connection_missing', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.quoteFreight(1)).rejects.toBeInstanceOf(SupplierIntegrationNotFoundError);
    });
  });

  describe('pushOrder', () => {
    it('should_push_successfully_and_persist_sandbox_true_with_no_isSandbox_field_sent_to_the_client', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected' }));
      catalogRepo.findByExternalRef.mockResolvedValue(makeCatalogItem());
      cjClient.createOrder.mockResolvedValue({ orderId: 'cj-order-1' });
      supplierOrderRepo.updateExternalOrder.mockResolvedValue(
        makeOrder({ externalOrderId: 'cj-order-1', externalProvider: 'CJDropshipping', sandbox: true })
      );

      const result = await service.pushOrder(1, { logisticName: 'CJPacket Ordinary' });

      expect(result.externalOrderId).toBe('cj-order-1');
      const callArgs = cjClient.createOrder.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('isSandbox');
      expect(supplierOrderRepo.updateExternalOrder).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ externalOrderId: 'cj-order-1', externalProvider: 'CJDropshipping', sandbox: true })
      );
    });

    it('should_reject_a_duplicate_push_without_calling_the_client', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder({ externalOrderId: 'cj-order-existing' }));

      await expect(service.pushOrder(1, { logisticName: 'CJPacket Ordinary' })).rejects.toBeInstanceOf(
        CjOrderAlreadyPushedError
      );
      expect(cjClient.createOrder).not.toHaveBeenCalled();
    });

    it('should_throw_CjOrderAlreadyPushedError_when_a_concurrent_push_wins_the_race', async () => {
      // updateExternalOrder returning null means another request pushed this
      // same SupplierOrder between our own "not yet pushed" check and this
      // write — the conditional update in the repository lost the race.
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected' }));
      catalogRepo.findByExternalRef.mockResolvedValue(makeCatalogItem());
      cjClient.createOrder.mockResolvedValue({ orderId: 'cj-order-1' });
      supplierOrderRepo.updateExternalOrder.mockResolvedValue(null);

      await expect(service.pushOrder(1, { logisticName: 'CJPacket Ordinary' })).rejects.toBeInstanceOf(
        CjOrderAlreadyPushedError
      );
    });

    it('should_throw_CjApiUnavailableError_on_client_failure_and_never_update_external_order', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected' }));
      catalogRepo.findByExternalRef.mockResolvedValue(makeCatalogItem());
      cjClient.createOrder.mockRejectedValue(new Error('upstream down'));

      await expect(service.pushOrder(1, { logisticName: 'CJPacket Ordinary' })).rejects.toBeInstanceOf(
        CjApiUnavailableError
      );
      expect(supplierOrderRepo.updateExternalOrder).not.toHaveBeenCalled();
    });

    it('should_ignore_an_isSandbox_field_injected_via_an_untyped_caller', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected' }));
      catalogRepo.findByExternalRef.mockResolvedValue(makeCatalogItem());
      cjClient.createOrder.mockResolvedValue({ orderId: 'cj-order-1' });
      supplierOrderRepo.updateExternalOrder.mockResolvedValue(makeOrder({ externalOrderId: 'cj-order-1' }));

      // Bypass TypeScript to prove the service ignores a caller-injected
      // isSandbox field even if some upstream layer failed to strip it —
      // belt-and-suspenders alongside the validator-level rejection.
      await service.pushOrder(1, { logisticName: 'CJPacket Ordinary', isSandbox: 0 } as unknown as { logisticName: string });

      const callArgs = cjClient.createOrder.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('isSandbox');
    });

    it('should_auto_select_the_cheapest_logistic_option_when_logisticName_is_omitted', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected' }));
      catalogRepo.findByExternalRef.mockResolvedValue(makeCatalogItem());
      cjClient.calculateFreight.mockResolvedValue([
        { logisticName: 'Expensive', logisticAging: '3-5', logisticPrice: 9.5, totalPostageFee: 9.5 },
        { logisticName: 'Cheap', logisticAging: '7-10', logisticPrice: 3.2, totalPostageFee: 3.2 },
      ]);
      cjClient.createOrder.mockResolvedValue({ orderId: 'cj-order-1' });
      supplierOrderRepo.updateExternalOrder.mockResolvedValue(makeOrder({ externalOrderId: 'cj-order-1' }));

      await service.pushOrder(1, {});

      expect(cjClient.calculateFreight).toHaveBeenCalled();
      expect(cjClient.createOrder).toHaveBeenCalledWith(expect.objectContaining({ logisticName: 'Cheap' }));
    });

    it('should_restrict_auto_selection_to_the_configured_carrier_allow_list', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected' }));
      catalogRepo.findByExternalRef.mockResolvedValue(makeCatalogItem());
      settingsRepo.get.mockResolvedValue({
        id: 1, targetMargin: 5, defaultFreightDestinationCountry: 'ES', carrierAllowList: ['Standard'],
      });
      cjClient.calculateFreight.mockResolvedValue([
        { logisticName: 'Cheap', logisticAging: '7-10', logisticPrice: 3.2, totalPostageFee: 3.2 },
        { logisticName: 'Standard', logisticAging: '5-8', logisticPrice: 6, totalPostageFee: 6 },
      ]);
      cjClient.createOrder.mockResolvedValue({ orderId: 'cj-order-1' });
      supplierOrderRepo.updateExternalOrder.mockResolvedValue(makeOrder({ externalOrderId: 'cj-order-1' }));

      await service.pushOrder(1, {});

      expect(cjClient.createOrder).toHaveBeenCalledWith(expect.objectContaining({ logisticName: 'Standard' }));
    });

    it('should_throw_CjCarrierAllowListExhaustedError_when_no_quoted_option_matches_the_allow_list', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());
      integrationRepo.findBySupplierId.mockResolvedValue(new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected' }));
      catalogRepo.findByExternalRef.mockResolvedValue(makeCatalogItem());
      settingsRepo.get.mockResolvedValue({
        id: 1, targetMargin: 5, defaultFreightDestinationCountry: 'ES', carrierAllowList: ['OnlyThis'],
      });
      cjClient.calculateFreight.mockResolvedValue([
        { logisticName: 'Cheap', logisticAging: '7-10', logisticPrice: 3.2, totalPostageFee: 3.2 },
      ]);

      await expect(service.pushOrder(1, {})).rejects.toBeInstanceOf(CjCarrierAllowListExhaustedError);
      expect(cjClient.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('selectCheapestLogistic', () => {
    const options = [
      { logisticName: 'Expensive', logisticAging: '3-5', logisticPrice: 9.5, totalPostageFee: 9.5 },
      { logisticName: 'Cheap', logisticAging: '7-10', logisticPrice: 3.2, totalPostageFee: 3.2 },
      { logisticName: 'Mid', logisticAging: '5-7', logisticPrice: 6, totalPostageFee: 6 },
    ];

    it('should_return_the_cheapest_option_when_allowList_is_empty', () => {
      expect(selectCheapestLogistic(options, [])).toBe('Cheap');
    });

    it('should_return_the_cheapest_option_within_the_allow_list', () => {
      expect(selectCheapestLogistic(options, ['Expensive', 'Mid'])).toBe('Mid');
    });

    it('should_return_null_when_no_option_matches_the_allow_list', () => {
      expect(selectCheapestLogistic(options, ['Nonexistent'])).toBeNull();
    });

    it('should_return_null_when_options_is_empty', () => {
      expect(selectCheapestLogistic([], [])).toBeNull();
    });
  });

  describe('getOrderStatus', () => {
    it('should_persist_and_return_external_status_and_tracking_fields', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder({ externalOrderId: 'cj-order-1' }));
      cjClient.getOrderDetail.mockResolvedValue({
        orderId: 'cj-order-1',
        orderStatus: 'PROCESSING',
        trackNumber: 'TRACK1',
        logisticName: 'CJPacket Ordinary',
      });
      supplierOrderRepo.updateExternalOrderStatus.mockResolvedValue(
        makeOrder({ externalOrderId: 'cj-order-1', externalOrderStatus: 'PROCESSING' })
      );

      const result = await service.getOrderStatus(1);

      expect(result.externalOrderStatus).toBe('PROCESSING');
      expect(supplierOrderRepo.updateExternalOrderStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          externalOrderStatus: 'PROCESSING',
          externalTrackingNumber: 'TRACK1',
          externalTrackingProvider: 'CJPacket Ordinary',
        })
      );
    });

    it('should_reject_when_order_was_never_pushed', async () => {
      supplierOrderRepo.findById.mockResolvedValue(makeOrder());

      await expect(service.getOrderStatus(1)).rejects.toBeInstanceOf(CjOrderNotPushedError);
      expect(cjClient.getOrderDetail).not.toHaveBeenCalled();
    });
  });
});
