export class AutomationAlert {
  id?: number;
  type: string;
  customerOrderId?: number | null;
  supplierOrderId?: number | null;
  message: string;
  resolvedAt?: Date | null;
  createdAt?: Date;

  constructor(data: {
    id?: number;
    type: string;
    customerOrderId?: number | null;
    supplierOrderId?: number | null;
    message: string;
    resolvedAt?: Date | null;
    createdAt?: Date;
  }) {
    this.id = data.id;
    this.type = data.type;
    this.customerOrderId = data.customerOrderId ?? null;
    this.supplierOrderId = data.supplierOrderId ?? null;
    this.message = data.message;
    this.resolvedAt = data.resolvedAt ?? null;
    this.createdAt = data.createdAt;
  }
}
