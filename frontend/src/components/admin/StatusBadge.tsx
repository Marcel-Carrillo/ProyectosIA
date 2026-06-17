import React from 'react';
import { Badge } from 'react-bootstrap';
import { ProductStatus } from '../../types/product';

type StatusBadgeProps = {
  status: ProductStatus;
  'data-testid'?: string;
};

const VARIANT: Record<ProductStatus, string> = {
  Draft: 'secondary',
  Active: 'success',
  Inactive: 'warning',
  Archived: 'dark',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, ...rest }) => (
  <Badge bg={VARIANT[status]} data-testid={rest['data-testid']}>
    {status}
  </Badge>
);

export default StatusBadge;
