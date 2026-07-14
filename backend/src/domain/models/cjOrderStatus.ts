import { ShipmentStatus } from './shipment';

// Best-effort mapping from CJ Dropshipping's externalOrderStatus vocabulary
// to our Shipment status machine — NOT yet verified against a live CJ
// sandbox order (design.md Open Question 2). Unrecognized values fall
// through to `null` (safe no-op), never a crash or a false alert.
const CJ_STATUS_TO_SHIPMENT_TARGET: Record<string, ShipmentStatus> = {
  CREATED: 'Pending',
  IN_CART: 'Pending',
  UNAUDITED: 'Pending',
  UNSHIPPED: 'Pending',
  UNDELIVERY: 'Shipped',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'InTransit',
  DELIVERED: 'Delivered',
  RECEIVED: 'Delivered',
  CANCELLED: 'Failed',
  CANCELED: 'Failed',
  RETURNED: 'Returned',
};

export const CJ_TERMINAL_STATUSES: readonly string[] = [
  'DELIVERED',
  'RECEIVED',
  'CANCELLED',
  'CANCELED',
  'RETURNED',
];

export function mapCjExternalStatusToShipmentTarget(externalOrderStatus: string): ShipmentStatus | null {
  return CJ_STATUS_TO_SHIPMENT_TARGET[externalOrderStatus.toUpperCase()] ?? null;
}

export function isCjStatusTerminal(externalOrderStatus: string): boolean {
  return CJ_TERMINAL_STATUSES.includes(externalOrderStatus.toUpperCase());
}
