import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import CustomerAddressFormModal from '../CustomerAddressFormModal';
import { CustomerAddress } from '../../../types/customer';
import { customerService } from '../../../services/customerService';

jest.mock('../../../services/customerService', () => {
  const actual = jest.requireActual('../../../services/customerService');
  return {
    __esModule: true,
    customerService: { createAddress: jest.fn(), updateAddress: jest.fn() },
    extractCustomerErrorMessage: actual.extractCustomerErrorMessage,
    mapCustomerError: actual.mapCustomerError,
    extractCustomerErrorCode: actual.extractCustomerErrorCode,
  };
});

const mocked = customerService as unknown as {
  createAddress: jest.Mock;
  updateAddress: jest.Mock;
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

const existingAddress: CustomerAddress = {
  id: 10,
  customerId: 1,
  type: 'Shipping',
  fullName: 'Jane Doe',
  phone: null,
  streetLine1: 'Main Street 10',
  streetLine2: null,
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
  createdAt: '',
  updatedAt: '',
};

const noop = () => undefined;
const CUSTOMER_ID = 1;

const fillRequiredFields = () => {
  fireEvent.change(screen.getByTestId('input-address-full-name'), {
    target: { value: 'Jane Doe' },
  });
  fireEvent.change(screen.getByTestId('input-address-street-line-1'), {
    target: { value: 'Main Street 10' },
  });
  fireEvent.change(screen.getByTestId('input-address-city'), {
    target: { value: 'Malaga' },
  });
  fireEvent.change(screen.getByTestId('input-address-province'), {
    target: { value: 'Malaga' },
  });
  fireEvent.change(screen.getByTestId('input-address-postal-code'), {
    target: { value: '29001' },
  });
  fireEvent.change(screen.getByTestId('input-address-country'), {
    target: { value: 'Spain' },
  });
};

describe('CustomerAddressFormModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders in create mode with Shipping as the default type', () => {
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    expect(screen.getByTestId('select-address-type')).toHaveValue('Shipping');
    expect(screen.getByTestId('input-address-full-name')).toHaveValue('');
  });

  it('shows a validation error when full name is empty', () => {
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
    expect(mocked.createAddress).not.toHaveBeenCalled();
  });

  it('shows a validation error when street line 1 is empty', () => {
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    fireEvent.change(screen.getByTestId('input-address-full-name'), {
      target: { value: 'Jane' },
    });
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(screen.getByText(/street line 1 is required/i)).toBeInTheDocument();
  });

  it('creates an address and calls onSuccess', async () => {
    mocked.createAddress.mockResolvedValue({
      success: true,
      data: existingAddress,
      message: '',
    });
    const onSuccess = jest.fn();
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={onSuccess}
      />
    );
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.createAddress).toHaveBeenCalledWith(
        CUSTOMER_ID,
        expect.objectContaining({ streetLine1: 'Main Street 10', city: 'Malaga' })
      )
    );
    expect(onSuccess).toHaveBeenCalledWith(existingAddress);
  });

  it('maps VALIDATION_ERROR from the API to a UI message', async () => {
    mocked.createAddress.mockRejectedValue(makeAxiosError('VALIDATION_ERROR', 400));
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    expect(await screen.findByText(/check the form fields/i)).toBeInTheDocument();
  });

  it('pre-populates fields from the initial address in edit mode', () => {
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
        initial={existingAddress}
      />
    );
    expect(screen.getByTestId('input-address-full-name')).toHaveValue('Jane Doe');
    expect(screen.getByTestId('input-address-city')).toHaveValue('Malaga');
    expect(screen.getByTestId('select-address-type')).toHaveValue('Shipping');
  });

  it('calls updateAddress (not createAddress) in edit mode', async () => {
    mocked.updateAddress.mockResolvedValue({
      success: true,
      data: existingAddress,
      message: '',
    });
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
        initial={existingAddress}
      />
    );
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() =>
      expect(mocked.updateAddress).toHaveBeenCalledWith(
        CUSTOMER_ID,
        existingAddress.id,
        expect.objectContaining({ city: 'Malaga' })
      )
    );
    expect(mocked.createAddress).not.toHaveBeenCalled();
  });

  it('disables the save button while saving', async () => {
    let resolve!: (v: unknown) => void;
    mocked.createAddress.mockReturnValue(new Promise((r) => (resolve = r)));
    render(
      <CustomerAddressFormModal
        show
        onHide={noop}
        customerId={CUSTOMER_ID}
        onSuccess={noop}
      />
    );
    fillRequiredFields();
    fireEvent.click(screen.getByTestId('btn-modal-save'));
    await waitFor(() => expect(screen.getByTestId('btn-modal-save')).toBeDisabled());
    resolve({ success: true, data: existingAddress, message: '' });
  });
});
