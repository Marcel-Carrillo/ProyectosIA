import { ISupplierOrderRepository } from '../../domain/repositories/supplierOrderRepository';
import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import { ICjCatalogItemRepository } from '../../domain/repositories/cjCatalogItemRepository';
import { IAutomationSettingsRepository } from '../../domain/repositories/automationSettingsRepository';
import { ICjClient, CjFreightOption } from '../../infrastructure/external/cjTypes';
import { CjApiError } from '../../infrastructure/external/cjClient';
import { SupplierOrder } from '../../domain/models/supplierOrder';
import { SupplierOrderNotFoundError } from '../../infrastructure/repositories/supplierOrderRepository';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import {
  CjItemNotMappedError,
  CjOrderAlreadyPushedError,
  CjOrderNotPushedError,
  CjApiUnavailableError,
  CjCarrierAllowListExhaustedError,
} from '../validator';
import { prisma } from '../../infrastructure/prismaClient';
import { logger } from '../../infrastructure/logger';

// Pure helper, exported for isolated unit testing. Empty allowList means no
// restriction — cheapest of everything (design.md Decision 5).
export function selectCheapestLogistic(options: CjFreightOption[], allowList: string[]): string | null {
  const candidates = allowList.length > 0 ? options.filter((o) => allowList.includes(o.logisticName)) : options;
  if (candidates.length === 0) return null;
  return candidates.reduce((min, o) => (o.logisticPrice < min.logisticPrice ? o : min)).logisticName;
}

// Best-effort country-name -> ISO 3166-1 alpha-2 mapping. CustomerAddress.country
// is stored as free text (e.g. "Spain", "España"), but CJ's shippingCountryCode
// requires a 2-letter code. Falls back to the raw value if already a 2-letter
// code, or passes it through unchanged otherwise (CJ will reject an invalid
// code with a clear upstream error rather than this silently guessing wrong).
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  spain: 'ES',
  españa: 'ES',
  portugal: 'PT',
  france: 'FR',
  germany: 'DE',
  italy: 'IT',
};

const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

function euIossFields(countryCode: string): { iossType?: number; iossNumber?: string } {
  if (!EU_COUNTRY_CODES.has(countryCode.toUpperCase())) return {};
  // CJ docs: iossType=3 uses CJ's IOSS; iossNumber is fixed to "CJ-IOSS".
  return { iossType: 3, iossNumber: 'CJ-IOSS' };
}

function resolveCountryCode(country: string): string {
  if (/^[A-Za-z]{2}$/.test(country)) return country.toUpperCase();
  return COUNTRY_NAME_TO_CODE[country.trim().toLowerCase()] ?? country;
}

interface AddressSnapshot {
  fullName: string;
  phone?: string;
  streetLine1: string;
  streetLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export class CjOrderPushService {
  constructor(
    private readonly supplierOrderRepo: ISupplierOrderRepository,
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly cjClient: ICjClient,
    private readonly settingsRepo: IAutomationSettingsRepository
  ) {}

  async quoteFreight(supplierOrderId: number): Promise<CjFreightOption[]> {
    const order = await this.supplierOrderRepo.findById(supplierOrderId);
    if (!order) throw new SupplierOrderNotFoundError();

    const integration = await this.integrationRepo.findBySupplierId(order.supplierId);
    if (!integration?.id) throw new SupplierIntegrationNotFoundError();

    const products = await this.resolveVids(order, integration.id);
    const address = await this.resolveShippingAddress(order);
    const countryCode = resolveCountryCode(address.country);

    try {
      return await this.cjClient.calculateFreight({
        startCountryCode: 'CN',
        endCountryCode: countryCode,
        products,
      });
    } catch (err) {
      logger.error('CJ Dropshipping freight quote failed', {
        supplierOrderId,
        status: err instanceof CjApiError ? err.status : undefined,
      });
      throw new CjApiUnavailableError();
    }
  }

  async pushOrder(supplierOrderId: number, input: { logisticName?: string }): Promise<SupplierOrder> {
    const order = await this.supplierOrderRepo.findById(supplierOrderId);
    if (!order) throw new SupplierOrderNotFoundError();
    if (order.externalOrderId) throw new CjOrderAlreadyPushedError();

    const integration = await this.integrationRepo.findBySupplierId(order.supplierId);
    if (!integration?.id) throw new SupplierIntegrationNotFoundError();

    const products = await this.resolveVids(order, integration.id);
    const address = await this.resolveShippingAddress(order);
    const countryCode = resolveCountryCode(address.country);

    let logisticName = input.logisticName;
    if (!logisticName) {
      let quote: CjFreightOption[];
      try {
        quote = await this.cjClient.calculateFreight({ startCountryCode: 'CN', endCountryCode: countryCode, products });
      } catch (err) {
        logger.error('CJ Dropshipping freight quote failed during auto-selection', {
          supplierOrderId,
          status: err instanceof CjApiError ? err.status : undefined,
        });
        throw new CjApiUnavailableError();
      }
      const settings = await this.settingsRepo.get();
      const selected = selectCheapestLogistic(quote, settings.carrierAllowList);
      if (!selected) throw new CjCarrierAllowListExhaustedError();
      logisticName = selected;
    }

    let result;
    try {
      // Note: createOrder's params type has NO isSandbox field at all — cjClient
      // forces it server-side (design.md Decision 5). There is no code path
      // here that could pass one through.
      result = await this.cjClient.createOrder({
        orderNumber: order.supplierOrderNumber,
        logisticName,
        fromCountryCode: 'CN',
        products,
        shippingCustomerName: address.fullName,
        shippingPhone: address.phone ?? '',
        shippingAddress: address.streetLine1,
        shippingAddress2: address.streetLine2 ?? '',
        shippingCity: address.city,
        shippingProvince: address.province,
        shippingZip: address.postalCode,
        shippingCountry: address.country,
        shippingCountryCode: countryCode,
        ...euIossFields(countryCode),
      });
    } catch (err) {
      logger.error('CJ Dropshipping order push failed', {
        supplierOrderId,
        status: err instanceof CjApiError ? err.status : undefined,
      });
      throw new CjApiUnavailableError();
    }

    logger.info('Supplier order pushed to CJ Dropshipping', { supplierOrderId, externalOrderId: result.orderId });
    const updated = await this.supplierOrderRepo.updateExternalOrder(supplierOrderId, {
      externalProvider: 'CJDropshipping',
      externalOrderId: result.orderId,
      sandbox: true,
      pushedAt: new Date(),
    });
    if (!updated) {
      // Another push won the race between our own check above and this write
      // (e.g. a double-click or client-side retry). The CJ order created just
      // now is orphaned from our side — logged for manual reconciliation
      // since automatically cancelling a just-created sandbox order is out of
      // scope for this increment.
      logger.error('CJ Dropshipping order push race: order was already pushed concurrently', {
        supplierOrderId,
        orphanedExternalOrderId: result.orderId,
      });
      throw new CjOrderAlreadyPushedError();
    }
    return updated;
  }

  async getOrderStatus(supplierOrderId: number): Promise<SupplierOrder> {
    const order = await this.supplierOrderRepo.findById(supplierOrderId);
    if (!order) throw new SupplierOrderNotFoundError();
    if (!order.externalOrderId) throw new CjOrderNotPushedError();

    let detail;
    try {
      detail = await this.cjClient.getOrderDetail(order.externalOrderId);
    } catch (err) {
      logger.error('CJ Dropshipping order status pull failed', {
        supplierOrderId,
        status: err instanceof CjApiError ? err.status : undefined,
      });
      throw new CjApiUnavailableError();
    }

    return this.supplierOrderRepo.updateExternalOrderStatus(supplierOrderId, {
      externalOrderStatus: detail.orderStatus,
      externalTrackingNumber: detail.trackNumber ?? null,
      externalTrackingProvider: detail.logisticName ?? null,
      lastStatusSyncedAt: new Date(),
    });
  }

  private async resolveVids(
    order: SupplierOrder,
    supplierIntegrationId: number
  ): Promise<Array<{ vid: string; quantity: number }>> {
    const products: Array<{ vid: string; quantity: number }> = [];
    for (const item of order.items ?? []) {
      const externalRef = item.supplierReferenceSnapshot;
      const staged = externalRef
        ? await this.catalogRepo.findByExternalRef(supplierIntegrationId, externalRef)
        : null;
      if (!staged) throw new CjItemNotMappedError();
      products.push({ vid: staged.externalRef, quantity: item.quantity });
    }
    return products;
  }

  private async resolveShippingAddress(order: SupplierOrder): Promise<AddressSnapshot> {
    const customerOrder = await prisma.customerOrder.findUnique({
      where: { id: order.customerOrderId },
      select: { shippingAddressSnapshot: true },
    });
    return customerOrder?.shippingAddressSnapshot as unknown as AddressSnapshot;
  }
}
