import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import SupplierFormModal from '../SupplierFormModal';
import { Supplier } from '../../../types/supplier';
import { supplierService } from '../../../services/supplierService';

jest.mock('../../../services/supplierService', () => {
  const actual = jest.requireActual('../../../services/supplierService');
  return {
    __esModule: true,
    supplierService: { create: jest.fn(), update: jest.fn() },
    extractSupplierErrorMessage: actual.extractSupplierErrorMessage,
    mapSupplierError: actual.mapSupplierError,
  };
});

const mocked = supplierService as unknown as {
  create: jest.Mock;
  update: jest.Mock;
};

const makeAxiosError = (code: string, status: number) => {
  const err = new axios.AxiosError('error');
  err.response = {
    data: { success: false, error: { code, message: 'x' } },
    status,
    statusText: '',
    headers: {},
    config: {} as never,
  };
  return err;
};

const existing: Supplier = {
  id: 5,
  name: 'Acme',
  contactName: 'Bob',
  contactEmail: 'bob@acme.com',
  contactPhone: '123',
  website: 'https://acme.com',
  notes: 'internal',
  status: 'Active',
  createdAt: '',
  updatedAt: '',
};

const noop = () => undefined;

describe('SupplierFormModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a validation error when name is empty', () => {
    render(<SupplierFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it('shows a validation error for an invalid email', () => {
    render(<SupplierFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-supplier-name'), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByTestId('input-supplier-contact-email'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });

  it('creates a supplier and calls onSuccess', async () => {
    mocked.create.mockResolvedValue({ success: true, data: existing, message: '' });
    const onSuccess = jest.fn();
    render(<SupplierFormModal show onHide={noop} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-supplier-name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Acme' }))
    );
    expect(onSuccess).toHaveBeenCalledWith(existing);
  });

  it('maps a VALIDATION_ERROR from the API to a UI message', async () => {
    mocked.create.mockRejectedValue(makeAxiosError('VALIDATION_ERROR', 400));
    render(<SupplierFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-supplier-name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/check the form fields/i)).toBeInTheDocument();
  });

  it('shows SUPPLIER_NOT_FOUND in edit mode', async () => {
    mocked.update.mockRejectedValue(makeAxiosError('SUPPLIER_NOT_FOUND', 404));
    render(<SupplierFormModal show onHide={noop} onSuccess={noop} initial={existing} />);
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/supplier not found/i)).toBeInTheDocument();
  });

  it('pre-populates fields from the initial supplier in edit mode', () => {
    render(<SupplierFormModal show onHide={noop} onSuccess={noop} initial={existing} />);
    expect(screen.getByTestId('input-supplier-name')).toHaveValue('Acme');
    expect(screen.getByTestId('input-supplier-contact-email')).toHaveValue('bob@acme.com');
  });

  it('shows the status select only in edit mode', () => {
    const { rerender } = render(<SupplierFormModal show onHide={noop} onSuccess={noop} />);
    expect(screen.queryByTestId('select-supplier-status')).not.toBeInTheDocument();
    rerender(<SupplierFormModal show onHide={noop} onSuccess={noop} initial={existing} />);
    expect(screen.getByTestId('select-supplier-status')).toBeInTheDocument();
  });

  it('disables the save button while saving', async () => {
    let resolve!: (v: unknown) => void;
    mocked.create.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<SupplierFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-supplier-name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() => expect(screen.getByTestId('btn-modal-save')).toBeDisabled());
    resolve({ success: true, data: existing, message: '' });
  });
});
