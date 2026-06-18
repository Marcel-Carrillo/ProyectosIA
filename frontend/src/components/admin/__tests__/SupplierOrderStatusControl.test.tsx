import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupplierOrderStatusControl from '../SupplierOrderStatusControl';
import { SupplierOrder } from '../../../types/supplierOrder';

const baseOrder: SupplierOrder = {
  id: 1,
  supplierOrderNumber: 'SPO-000001',
  customerOrderId: 1,
  supplierId: 1,
  status: 'Draft',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('SupplierOrderStatusControl', () => {
  it('calls onSave with selected status', async () => {
    const onSave = jest.fn();
    render(
      <SupplierOrderStatusControl order={baseOrder} saving={false} onSave={onSave} />
    );
    await userEvent.selectOptions(screen.getByTestId('select-supplier-order-status'), 'Requested');
    await userEvent.click(screen.getByTestId('btn-save-supplier-status'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status: 'Requested' }));
  });
});
