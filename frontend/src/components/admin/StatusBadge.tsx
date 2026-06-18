import React from 'react';
import { Badge } from 'react-bootstrap';
import { ProductStatus } from '../../types/product';
import { SupplierStatus } from '../../types/supplier';

export type StatusValue = ProductStatus | SupplierStatus | string;

type StatusBadgeProps = {
  status: StatusValue;
  'data-testid'?: string;
};

// Bootstrap variant per status across both domains. Uses a string-keyed record
// with a fallback so adding a value in either domain cannot break at runtime.
const VARIANT: Record<string, string> = {
  // Product statuses
  Draft: 'secondary',
  Active: 'success',
  Inactive: 'warning',
  Archived: 'dark',
  // Supplier-only status
  Blocked: 'danger',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, ...rest }) => (
  <Badge bg={VARIANT[status] ?? 'secondary'} data-testid={rest['data-testid']}>
    {status}
  </Badge>
);

export default StatusBadge;
