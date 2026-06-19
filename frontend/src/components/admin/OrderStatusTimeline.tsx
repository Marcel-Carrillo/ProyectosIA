import React from 'react';
import { CustomerOrder } from '../../types/customerOrder';
import StatusBadge from './StatusBadge';

type Milestone = {
  key: string;
  label: string;
  at: string;
  status: string;
};

function buildMilestones(order: CustomerOrder): Milestone[] {
  const items: Milestone[] = [
    {
      key: 'created',
      label: 'Created',
      at: order.createdAt,
      status: 'PendingPayment',
    },
  ];
  if (order.paidAt) {
    items.push({
      key: 'paid',
      label: 'Paid',
      at: order.paidAt,
      status: 'Paid',
    });
  }
  if (order.cancelledAt) {
    items.push({
      key: 'cancelled',
      label: 'Cancelled',
      at: order.cancelledAt,
      status: 'Cancelled',
    });
  }
  items.push({
    key: 'updated',
    label: 'Last updated',
    at: order.updatedAt,
    status: order.status,
  });
  return items;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

type OrderStatusTimelineProps = {
  order: CustomerOrder;
};

const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({ order }) => {
  const milestones = buildMilestones(order);

  return (
    <div data-testid="order-status-timeline">
      <ul className="list-unstyled mb-2">
        {milestones.map((m) => (
          <li key={m.key} className="d-flex align-items-start gap-2 mb-2">
            <StatusBadge status={m.status} />
            <div>
              <div className="fw-semibold small">{m.label}</div>
              <div className="small text-muted">{formatDateTime(m.at)}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="small text-muted mb-0">
        Shows key milestones only. Intermediate status transitions are not recorded yet.
      </p>
    </div>
  );
};

export default OrderStatusTimeline;
