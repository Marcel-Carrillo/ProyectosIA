import { ShipmentStatus, isValidShipmentTransition } from '../../domain/models/shipment';
import { mapCjExternalStatusToShipmentTarget } from '../../domain/models/cjOrderStatus';
import { CjOrderPushService } from './cjOrderPushService';
import { ShipmentService } from './shipmentService';
import { IShipmentRepository } from '../../domain/repositories/shipmentRepository';
import { IAutomationAlertRepository } from '../../domain/repositories/automationAlertRepository';
import { SupplierOrder } from '../../domain/models/supplierOrder';
import { logger } from '../../infrastructure/logger';

// Linear happy-path chain. Failed/Returned are branch-offs handled
// separately (single-hop only, from any non-terminal current status) — they
// are not part of the "advance forward" chain.
const HAPPY_PATH: ShipmentStatus[] = ['Pending', 'Shipped', 'InTransit', 'Delivered'];

export interface AdvanceResult {
  advanced: boolean; // true if at least one transition was applied
  finalStatus: ShipmentStatus;
  illegal: boolean; // true if the target could not be reached at all (skip + alert)
}

// Walks the shipment forward one legal hop at a time toward `target`,
// instead of attempting a single direct jump — Pending -> Delivered is not
// itself a legal transition, but Pending -> Shipped -> InTransit -> Delivered
// applied one hop per call is, so a single sync that missed intermediate
// polls still reaches the right end state without ever attempting an
// illegal transition.
export async function advanceShipmentTowards(
  currentStatus: ShipmentStatus,
  target: ShipmentStatus,
  applyTransition: (next: ShipmentStatus) => Promise<void>
): Promise<AdvanceResult> {
  if (target === 'Failed' || target === 'Returned') {
    if (!isValidShipmentTransition(currentStatus, target)) {
      return { advanced: false, finalStatus: currentStatus, illegal: true };
    }
    await applyTransition(target);
    return { advanced: true, finalStatus: target, illegal: false };
  }

  const currentIdx = HAPPY_PATH.indexOf(currentStatus);
  const targetIdx = HAPPY_PATH.indexOf(target);
  if (currentIdx === -1) {
    // Current status is Failed/Returned (terminal, not on the happy path) —
    // per the terminal-state rule, no further transition is ever legal.
    return { advanced: false, finalStatus: currentStatus, illegal: true };
  }
  if (targetIdx === -1 || targetIdx <= currentIdx) {
    // Already there, or CJ reports a "backward" status — never regress, and
    // this is NOT an alert-worthy illegal transition, just a no-op
    // (re-entrancy requirement: running the job twice with no CJ change
    // makes no further changes).
    return { advanced: false, finalStatus: currentStatus, illegal: false };
  }

  let status = currentStatus;
  for (let i = currentIdx + 1; i <= targetIdx; i++) {
    const next = HAPPY_PATH[i]!;
    if (!isValidShipmentTransition(status, next)) {
      return { advanced: status !== currentStatus, finalStatus: status, illegal: true };
    }
    await applyTransition(next);
    status = next;
  }
  return { advanced: true, finalStatus: status, illegal: false };
}

export class CjOrderStatusSyncOrchestrator {
  constructor(
    private readonly cjOrderPushService: CjOrderPushService,
    private readonly shipmentRepo: IShipmentRepository,
    private readonly shipmentService: ShipmentService,
    private readonly alertRepo: IAutomationAlertRepository
  ) {}

  // Returns true if anything changed (for the job's "updated" counter).
  async syncOne(supplierOrder: SupplierOrder): Promise<boolean> {
    const updated = await this.cjOrderPushService.getOrderStatus(supplierOrder.id!);
    if (!updated.externalOrderStatus) return false;

    const target = mapCjExternalStatusToShipmentTarget(updated.externalOrderStatus);
    if (!target) {
      logger.warn('Unrecognized CJ externalOrderStatus — no shipment mapping applied', {
        supplierOrderId: supplierOrder.id,
        externalOrderStatus: updated.externalOrderStatus,
      });
      return false;
    }

    let shipment = await this.shipmentRepo.findBySupplierOrderId(supplierOrder.id!);
    if (!shipment) {
      shipment = await this.shipmentService.createShipment({
        customerOrderId: updated.customerOrderId,
        supplierOrderId: supplierOrder.id,
        carrier: updated.externalTrackingProvider ?? null,
        trackingNumber: updated.externalTrackingNumber ?? null,
      });
    }

    const shipmentId = shipment.id!;
    const result = await advanceShipmentTowards(shipment.status, target, async (next) => {
      await this.shipmentService.updateShipmentStatus(shipmentId, { status: next });
    });

    if (result.illegal) {
      await this.recordAlert(
        'ShipmentTransitionSkipped',
        updated.customerOrderId,
        supplierOrder.id,
        shipment.status,
        target
      );
    }
    return result.advanced;
  }

  private async recordAlert(
    type: string,
    customerOrderId: number,
    supplierOrderId: number | undefined,
    from: string,
    to: string
  ): Promise<void> {
    const message = `Cannot transition shipment from ${from} to mapped CJ target ${to}`;
    logger.warn('Skipped illegal shipment transition mapped from CJ status', {
      customerOrderId,
      supplierOrderId,
      from,
      to,
    });
    try {
      await this.alertRepo.create({ type, customerOrderId, supplierOrderId, message });
    } catch (err) {
      logger.error('Failed to record shipment-transition alert', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
