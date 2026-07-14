export type FulfillmentAlertType =
  | 'SupplierOrderGenerationFailed'
  | 'CjPushFailed'
  | 'CjStatusSyncFailed'
  | 'ShipmentTransitionSkipped'
  | 'CarrierAllowListExhausted';

export interface FulfillmentAlert {
  id: number;
  type: FulfillmentAlertType;
  customerOrderId: number | null;
  supplierOrderId: number | null;
  message: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface FulfillmentAlertListResult {
  items: FulfillmentAlert[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FulfillmentAlertListResponse {
  success: boolean;
  data: FulfillmentAlertListResult;
  message: string;
}

export interface FulfillmentAlertQueryParams {
  page?: number;
  pageSize?: number;
  resolved?: boolean;
}
