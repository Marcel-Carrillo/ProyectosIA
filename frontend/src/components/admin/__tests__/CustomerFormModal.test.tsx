import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import CustomerFormModal from '../CustomerFormModal';
import { Customer } from '../../../types/customer';
import { customerService } from '../../../services/customerService';

jest.mock('../../../services/customerService', () => {
  const actual = jest.requireActual('../../../services/customerService');
  return {
    __esModule: true,
    customerService: { create: jest.fn(), update: jest.fn() },
    extractCustomerErrorMessage: actual.extractCustomerErrorMessage,
    mapCustomerError: actual.mapCustomerError,
    extractCustomerErrorCode: actual.extractCustomerErrorCode,
  };
});

const mocked = customerService as unknown as {
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

const existing: Customer = {
  id: 7,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+34600000000',
  createdAt: '',
  updatedAt: '',
};

const noop = () => undefined;

describe('CustomerFormModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a validation error when first name is empty', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it('shows a validation error when last name is empty', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
  });

  it('shows a validation error when email is empty', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });

  it('shows a validation error for an invalid email format', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });

  it('creates a customer and calls onSuccess', async () => {
    mocked.create.mockResolvedValue({ success: true, data: existing, message: '' });
    const onSuccess = jest.fn();
    render(<CustomerFormModal show onHide={noop} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Jane', email: 'jane@example.com' })
      )
    );
    expect(onSuccess).toHaveBeenCalledWith(existing);
  });

  it('maps CUSTOMER_EMAIL_CONFLICT from the API to a UI message', async () => {
    mocked.create.mockRejectedValue(makeAxiosError('CUSTOMER_EMAIL_CONFLICT', 409));
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/customer with this email already exists/i)).toBeInTheDocument();
  });

  it('maps VALIDATION_ERROR from the API to a UI message', async () => {
    mocked.create.mockRejectedValue(makeAxiosError('VALIDATION_ERROR', 400));
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/check the form fields/i)).toBeInTheDocument();
  });

  it('shows CUSTOMER_NOT_FOUND in edit mode', async () => {
    mocked.update.mockRejectedValue(makeAxiosError('CUSTOMER_NOT_FOUND', 404));
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} initial={existing} />);
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/customer not found/i)).toBeInTheDocument();
  });

  it('pre-populates fields from the initial customer in edit mode', () => {
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} initial={existing} />);
    expect(screen.getByTestId('input-customer-first-name')).toHaveValue('Jane');
    expect(screen.getByTestId('input-customer-email')).toHaveValue('jane@example.com');
  });

  it('disables the save button while saving', async () => {
    let resolve!: (v: unknown) => void;
    mocked.create.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<CustomerFormModal show onHide={noop} onSuccess={noop} />);
    fireEvent.change(screen.getByTestId('input-customer-first-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByTestId('input-customer-last-name'), {
      target: { value: 'Doe' },
    });
    fireEvent.change(screen.getByTestId('input-customer-email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() => expect(screen.getByTestId('btn-modal-save')).toBeDisabled());
    resolve({ success: true, data: existing, message: '' });
  });
});
