import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SuppliersPage from '../SuppliersPage';
import { Supplier } from '../../types/supplier';
import { supplierService } from '../../services/supplierService';

jest.mock('../../services/supplierService', () => {
  const actual = jest.requireActual('../../services/supplierService');
  return {
    __esModule: true,
    supplierService: {
      list: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    },
    extractSupplierErrorMessage: actual.extractSupplierErrorMessage,
    mapSupplierError: actual.mapSupplierError,
  };
});
jest.mock('../../components/admin/SupplierFormModal', () => ({
  __esModule: true,
  default: ({ show }: { show: boolean }) =>
    show ? <div data-testid="mock-supplier-form-modal" /> : null,
}));

const mockedService = supplierService as jest.Mocked<typeof supplierService>;

const mockSupplier: Supplier = {
  id: 1,
  name: 'Acme Textiles',
  contactName: 'Alice',
  contactEmail: 'alice@acme.com',
  contactPhone: null,
  website: null,
  notes: null,
  status: 'Active',
  createdAt: '',
  updatedAt: '',
};

const listResult = (items: Supplier[]) => ({
  success: true,
  data: { items, total: items.length, page: 1, pageSize: 20 },
  message: '',
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/suppliers']}>
      <SuppliersPage />
    </MemoryRouter>
  );

describe('SuppliersPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders suppliers from the admin API', async () => {
    mockedService.list.mockResolvedValue(listResult([mockSupplier]));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('supplier-card-row-1')).toBeInTheDocument());
    expect(screen.getByTestId('suppliers-table')).toHaveTextContent('Acme Textiles');
  });

  it('shows the empty state when there are no suppliers', async () => {
    mockedService.list.mockResolvedValue(listResult([]));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
  });

  it('shows an error message when the request fails', async () => {
    mockedService.list.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/unable to load suppliers/i)).toBeInTheDocument());
  });

  it('re-queries with the selected status filter', async () => {
    mockedService.list.mockResolvedValue(listResult([mockSupplier]));
    renderPage();
    await waitFor(() => expect(mockedService.list).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'Inactive' } });
    await waitFor(() =>
      expect(mockedService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'Inactive', page: 1 })
      )
    );
  });

  it('re-queries after the search debounce', async () => {
    jest.useFakeTimers();
    mockedService.list.mockResolvedValue(listResult([mockSupplier]));
    renderPage();
    fireEvent.change(screen.getByTestId('filter-search'), { target: { value: 'acme' } });
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() =>
      expect(mockedService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'acme' })
      )
    );
    jest.useRealTimers();
  });

  it('reset clears filters and re-queries', async () => {
    mockedService.list.mockResolvedValue(listResult([mockSupplier]));
    renderPage();
    await waitFor(() => expect(mockedService.list).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'Blocked' } });
    fireEvent.click(screen.getByTestId('btn-filter-reset'));
    await waitFor(() =>
      expect(mockedService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: undefined, search: undefined })
      )
    );
  });

  it('opens the create modal when New supplier is clicked', async () => {
    mockedService.list.mockResolvedValue(listResult([mockSupplier]));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('supplier-card-row-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-new-supplier'));
    expect(screen.getByTestId('mock-supplier-form-modal')).toBeInTheDocument();
  });

  it('confirms the deactivate flow and calls softDelete', async () => {
    mockedService.list.mockResolvedValue(listResult([mockSupplier]));
    mockedService.softDelete.mockResolvedValue({ success: true, data: { ...mockSupplier, status: 'Inactive' }, message: '' });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('supplier-row-1')).toBeInTheDocument());
    // table + card both render a deactivate button; click the first
    fireEvent.click(screen.getAllByTestId('btn-deactivate-1')[0]);
    fireEvent.click(screen.getByTestId('btn-confirm-deactivate'));
    await waitFor(() => expect(mockedService.softDelete).toHaveBeenCalledWith(1));
  });

  it('shows an error in the deactivate modal when softDelete fails', async () => {
    mockedService.list.mockResolvedValue(listResult([mockSupplier]));
    mockedService.softDelete.mockRejectedValue(new Error('fail'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('supplier-row-1')).toBeInTheDocument());
    fireEvent.click(screen.getAllByTestId('btn-deactivate-1')[0]);
    fireEvent.click(screen.getByTestId('btn-confirm-deactivate'));
    expect(await screen.findByText(/unexpected error/i)).toBeInTheDocument();
  });
});
