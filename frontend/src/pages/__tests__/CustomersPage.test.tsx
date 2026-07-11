import { vi, type Mocked } from 'vitest';
import { AxiosError } from 'axios';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomersPage from '../CustomersPage';
import { Customer } from '../../types/customer';
import {
  customerService,
  extractCustomerErrorMessage,
  mapCustomerError,
  extractCustomerErrorCode,
} from '../../services/customerService';

vi.mock('../../services/customerService', async () => {
  const actual = await vi.importActual('../../services/customerService');
  return {
    __esModule: true,
    customerService: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      listAddresses: vi.fn(),
      createAddress: vi.fn(),
      updateAddress: vi.fn(),
      deleteAddress: vi.fn(),
    },
    extractCustomerErrorMessage: actual.extractCustomerErrorMessage,
    mapCustomerError: actual.mapCustomerError,
    extractCustomerErrorCode: actual.extractCustomerErrorCode,
  };
});

vi.mock('../../components/admin/CustomerFormModal', () => ({
  __esModule: true,
  default: ({ show }: { show: boolean }) =>
    show ? <div data-testid="mock-customer-form-modal" /> : null,
}));

vi.mock('../../components/admin/CustomerAddressesSection', () => ({
  __esModule: true,
  default: ({ customer }: { customer: Customer | null }) =>
    customer ? <div data-testid="mock-addresses-section" /> : null,
}));

const mockedService = customerService as Mocked<typeof customerService>;

const mockCustomer: Customer = {
  id: 1,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const listResult = (items: Customer[]) => ({
  success: true,
  data: { items, total: items.length, page: 1, pageSize: 20 },
  message: '',
});

const makeAxiosError = (code: string, status: number) => {
  const err = new AxiosError('error');
  err.response = {
    data: { success: false, error: { code, message: 'x' } },
    status,
    statusText: '',
    headers: {},
    config: {} as never,
  };
  return err;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/customers']}>
      <CustomersPage />
    </MemoryRouter>
  );

describe('CustomersPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders customers from the admin API', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    expect(await screen.findByTestId('customer-card-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('customers-table')).toHaveTextContent('Jane');
  });

  it('shows the empty state when there are no customers', async () => {
    mockedService.list.mockResolvedValue(listResult([]));
    renderPage();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    mockedService.list.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/unable to load customers/i)).toBeInTheDocument();
  });

  it('re-queries after the search debounce', async () => {
    vi.useFakeTimers();
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    fireEvent.change(screen.getByTestId('filter-search'), { target: { value: 'jane' } });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await waitFor(() =>
      expect(mockedService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'jane' })
      )
    );
    vi.useRealTimers();
  });

  it('reset clears search and re-queries', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    await waitFor(() => expect(mockedService.list).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('filter-search'), { target: { value: 'jane' } });
    fireEvent.click(screen.getByTestId('btn-filter-reset'));
    await waitFor(() =>
      expect(mockedService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined })
      )
    );
  });

  it('opens the create modal when New customer is clicked', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    expect(await screen.findByTestId('customer-card-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-new-customer'));
    expect(screen.getByTestId('mock-customer-form-modal')).toBeInTheDocument();
  });

  it('opens the edit modal when Edit is clicked', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-edit-1')[0]);
    expect(screen.getByTestId('mock-customer-form-modal')).toBeInTheDocument();
  });

  it('opens the addresses section when Addresses is clicked', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-addresses-1')[0]);
    expect(screen.getByTestId('mock-addresses-section')).toBeInTheDocument();
  });

  it('confirms the delete flow and calls delete', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    mockedService.delete.mockResolvedValue(undefined);
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-delete-1')[0]);
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    await waitFor(() => expect(mockedService.delete).toHaveBeenCalledWith(1));
  });

  it('shows CUSTOMER_HAS_ORDERS message on 409 delete and hides confirm button', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    mockedService.delete.mockRejectedValue(makeAxiosError('CUSTOMER_HAS_ORDERS', 409));
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-delete-1')[0]);
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    expect(
      await screen.findByText(/this customer cannot be deleted because they have orders/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('btn-confirm-delete')).not.toBeInTheDocument();
  });

  it('shows a generic error in the delete modal when delete fails with an unknown code', async () => {
    mockedService.list.mockResolvedValue(listResult([mockCustomer]));
    mockedService.delete.mockRejectedValue(new Error('network fail'));
    renderPage();
    expect(await screen.findByTestId('customer-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('btn-delete-1')[0]);
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    expect(await screen.findByText(/unexpected error/i)).toBeInTheDocument();
  });
});

// Suppress unused import warnings from the mock re-exports
void extractCustomerErrorMessage;
void mapCustomerError;
void extractCustomerErrorCode;
