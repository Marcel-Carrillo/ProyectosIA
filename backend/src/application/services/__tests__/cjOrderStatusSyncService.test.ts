import { advanceShipmentTowards, CjOrderStatusSyncOrchestrator } from '../cjOrderStatusSyncService';
import { CjOrderPushService } from '../cjOrderPushService';
import { ShipmentService } from '../shipmentService';
import { IShipmentRepository } from '../../../domain/repositories/shipmentRepository';
import { IAutomationAlertRepository } from '../../../domain/repositories/automationAlertRepository';
import { SupplierOrder } from '../../../domain/models/supplierOrder';
import { Shipment } from '../../../domain/models/shipment';

jest.mock('../../../infrastructure/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function makeSupplierOrder(overrides: Partial<ConstructorParameters<typeof SupplierOrder>[0]> = {}) {
  return new SupplierOrder({
    id: 1,
    supplierOrderNumber: 'SPO-000001',
    customerOrderId: 10,
    supplierId: 1,
    externalOrderId: 'cj-order-1',
    ...overrides,
  });
}

function makeShipment(overrides: Partial<ConstructorParameters<typeof Shipment>[0]> = {}) {
  return new Shipment({ id: 1, customerOrderId: 10, supplierOrderId: 1, status: 'Pending', ...overrides });
}

describe('advanceShipmentTowards', () => {
  it('should_apply_a_single_legal_hop_directly', async () => {
    const applied: string[] = [];
    const result = await advanceShipmentTowards('Pending', 'Shipped', async (next) => {
      applied.push(next);
    });
    expect(result).toEqual({ advanced: true, finalStatus: 'Shipped', illegal: false });
    expect(applied).toEqual(['Shipped']);
  });

  it('should_walk_multiple_legal_hops_when_the_target_skips_intermediate_states', async () => {
    const applied: string[] = [];
    const result = await advanceShipmentTowards('Pending', 'Delivered', async (next) => {
      applied.push(next);
    });
    expect(result).toEqual({ advanced: true, finalStatus: 'Delivered', illegal: false });
    expect(applied).toEqual(['Shipped', 'InTransit', 'Delivered']);
  });

  it('should_walk_through_InTransit_even_when_a_direct_Shipped_to_Delivered_hop_would_also_be_legal', async () => {
    // The walker always advances one HAPPY_PATH rung at a time toward the
    // target, rather than testing whether a bigger direct jump is legal —
    // this ensures intermediate timestamps (e.g. an InTransit marker) are
    // recorded even when a sync run catches up multiple CJ status changes
    // at once.
    const applied: string[] = [];
    const result = await advanceShipmentTowards('Shipped', 'Delivered', async (next) => {
      applied.push(next);
    });
    expect(result).toEqual({ advanced: true, finalStatus: 'Delivered', illegal: false });
    expect(applied).toEqual(['InTransit', 'Delivered']);
  });

  it('should_apply_Failed_as_a_single_hop_branch_off_from_a_non_terminal_status', async () => {
    const applied: string[] = [];
    const result = await advanceShipmentTowards('Pending', 'Failed', async (next) => {
      applied.push(next);
    });
    expect(result).toEqual({ advanced: true, finalStatus: 'Failed', illegal: false });
    expect(applied).toEqual(['Failed']);
  });

  it('should_silently_no_op_without_alerting_when_already_Delivered_and_target_is_earlier_in_the_chain', async () => {
    // Delivered is itself part of the HAPPY_PATH sequence, so a target that
    // maps to an earlier rung (e.g. a stale/backward CJ status) is treated
    // as a harmless no-op, not an alert-worthy illegal transition — only
    // Failed/Returned (off the happy path) are flagged as genuinely illegal
    // targets from a terminal state.
    const applied: string[] = [];
    const result = await advanceShipmentTowards('Delivered', 'Shipped', async (next) => {
      applied.push(next);
    });
    expect(result).toEqual({ advanced: false, finalStatus: 'Delivered', illegal: false });
    expect(applied).toEqual([]);
  });

  it('should_be_a_silent_no_op_not_illegal_when_the_target_is_the_current_status', async () => {
    const applied: string[] = [];
    const result = await advanceShipmentTowards('Shipped', 'Shipped', async (next) => {
      applied.push(next);
    });
    expect(result).toEqual({ advanced: false, finalStatus: 'Shipped', illegal: false });
    expect(applied).toEqual([]);
  });

  it('should_be_a_silent_no_op_when_the_target_is_behind_the_current_status', async () => {
    const applied: string[] = [];
    const result = await advanceShipmentTowards('InTransit', 'Shipped', async (next) => {
      applied.push(next);
    });
    expect(result).toEqual({ advanced: false, finalStatus: 'InTransit', illegal: false });
    expect(applied).toEqual([]);
  });

  it('should_report_illegal_when_the_terminal_target_is_not_reachable_from_the_current_status', async () => {
    const applied: string[] = [];
    const result = await advanceShipmentTowards('Delivered', 'Failed', async (next) => {
      applied.push(next);
    });
    expect(result).toEqual({ advanced: false, finalStatus: 'Delivered', illegal: true });
    expect(applied).toEqual([]);
  });
});

describe('CjOrderStatusSyncOrchestrator', () => {
  let cjOrderPushService: jest.Mocked<Pick<CjOrderPushService, 'getOrderStatus'>>;
  let shipmentRepo: jest.Mocked<IShipmentRepository>;
  let shipmentService: jest.Mocked<Pick<ShipmentService, 'createShipment' | 'updateShipmentStatus'>>;
  let alertRepo: jest.Mocked<IAutomationAlertRepository>;
  let orchestrator: CjOrderStatusSyncOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    cjOrderPushService = { getOrderStatus: jest.fn() };
    shipmentRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      findBySupplierOrderId: jest.fn(),
    };
    shipmentService = { createShipment: jest.fn(), updateShipmentStatus: jest.fn() };
    alertRepo = { create: jest.fn(), findAll: jest.fn() };

    orchestrator = new CjOrderStatusSyncOrchestrator(
      cjOrderPushService as unknown as CjOrderPushService,
      shipmentRepo,
      shipmentService as unknown as ShipmentService,
      alertRepo
    );
  });

  it('should_create_a_shipment_on_first_sync_and_advance_it_toward_the_mapped_target', async () => {
    cjOrderPushService.getOrderStatus.mockResolvedValue(
      makeSupplierOrder({ externalOrderStatus: 'SHIPPED', externalTrackingNumber: 'TRK1', externalTrackingProvider: 'DHL' })
    );
    shipmentRepo.findBySupplierOrderId.mockResolvedValue(null);
    shipmentService.createShipment.mockResolvedValue(makeShipment({ status: 'Pending' }));
    shipmentService.updateShipmentStatus.mockResolvedValue(makeShipment({ status: 'Shipped' }));

    const changed = await orchestrator.syncOne(makeSupplierOrder());

    expect(shipmentService.createShipment).toHaveBeenCalledWith(
      expect.objectContaining({ customerOrderId: 10, supplierOrderId: 1, carrier: 'DHL', trackingNumber: 'TRK1' })
    );
    expect(shipmentService.updateShipmentStatus).toHaveBeenCalledWith(1, { status: 'Shipped' });
    expect(changed).toBe(true);
  });

  it('should_advance_an_existing_shipment_through_legal_hops_toward_delivered', async () => {
    cjOrderPushService.getOrderStatus.mockResolvedValue(makeSupplierOrder({ externalOrderStatus: 'DELIVERED' }));
    shipmentRepo.findBySupplierOrderId.mockResolvedValue(makeShipment({ status: 'Pending' }));
    shipmentService.updateShipmentStatus.mockResolvedValue(makeShipment({ status: 'Delivered' }));

    const changed = await orchestrator.syncOne(makeSupplierOrder());

    expect(shipmentService.updateShipmentStatus).toHaveBeenCalledTimes(3);
    expect(shipmentService.updateShipmentStatus).toHaveBeenNthCalledWith(1, 1, { status: 'Shipped' });
    expect(shipmentService.updateShipmentStatus).toHaveBeenNthCalledWith(2, 1, { status: 'InTransit' });
    expect(shipmentService.updateShipmentStatus).toHaveBeenNthCalledWith(3, 1, { status: 'Delivered' });
    expect(changed).toBe(true);
  });

  it('should_skip_and_return_false_when_externalOrderStatus_is_unrecognized', async () => {
    cjOrderPushService.getOrderStatus.mockResolvedValue(makeSupplierOrder({ externalOrderStatus: 'SOME_NEW_CJ_STATUS' }));

    const changed = await orchestrator.syncOne(makeSupplierOrder());

    expect(shipmentService.createShipment).not.toHaveBeenCalled();
    expect(changed).toBe(false);
  });

  it('should_skip_and_return_false_when_externalOrderStatus_is_still_empty', async () => {
    cjOrderPushService.getOrderStatus.mockResolvedValue(makeSupplierOrder({ externalOrderStatus: undefined }));

    const changed = await orchestrator.syncOne(makeSupplierOrder());

    expect(changed).toBe(false);
  });

  it('should_record_an_alert_and_leave_the_shipment_unchanged_on_an_illegal_mapped_transition', async () => {
    cjOrderPushService.getOrderStatus.mockResolvedValue(makeSupplierOrder({ externalOrderStatus: 'CANCELLED' }));
    shipmentRepo.findBySupplierOrderId.mockResolvedValue(makeShipment({ status: 'Delivered' }));

    const changed = await orchestrator.syncOne(makeSupplierOrder());

    expect(shipmentService.updateShipmentStatus).not.toHaveBeenCalled();
    expect(alertRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ShipmentTransitionSkipped', customerOrderId: 10, supplierOrderId: 1 })
    );
    expect(changed).toBe(false);
  });

  it('should_be_re_entrant_a_second_run_with_no_CJ_change_makes_no_further_changes', async () => {
    cjOrderPushService.getOrderStatus.mockResolvedValue(makeSupplierOrder({ externalOrderStatus: 'DELIVERED' }));
    shipmentRepo.findBySupplierOrderId.mockResolvedValue(makeShipment({ status: 'Delivered' }));

    const changed = await orchestrator.syncOne(makeSupplierOrder());

    expect(shipmentService.updateShipmentStatus).not.toHaveBeenCalled();
    expect(changed).toBe(false);
  });
});
