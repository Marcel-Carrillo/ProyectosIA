import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CjConnectionModal from '../CjConnectionModal';
import { CjConnection } from '../../../types/cjConnection';

const mockConfigureConnection = vi.fn();

vi.mock('../../../services/cjConnectionService', async () => ({
  cjConnectionService: {
    configureConnection: (...args: unknown[]) => mockConfigureConnection(...args),
  },
  extractCjConnectionErrorMessage: (await vi.importActual('../../../services/cjConnectionService'))
    .extractCjConnectionErrorMessage,
}));

const noop = () => undefined;

const existingConnection: CjConnection = {
  id: 1,
  supplierId: 3,
  provider: 'CJDropshipping',
  status: 'Connected',
  externalAccountRef: 'existing-ref',
  lastVerifiedAt: '2026-01-01T00:00:00.000Z',
  lastSyncedAt: null,
  createdAt: '',
  updatedAt: '',
};

describe('CjConnectionModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders with an empty input in create mode', () => {
    render(<CjConnectionModal show onHide={noop} supplierId={3} connection={null} onSuccess={noop} />);
    expect(screen.getByTestId('input-external-account-ref')).toHaveValue('');
    expect(screen.getByText(/Configure CJ Dropshipping connection/i)).toBeInTheDocument();
  });

  it('pre-fills the input in edit mode', () => {
    render(<CjConnectionModal show onHide={noop} supplierId={3} connection={existingConnection} onSuccess={noop} />);
    expect(screen.getByTestId('input-external-account-ref')).toHaveValue('existing-ref');
    expect(screen.getByText(/Edit CJ Dropshipping connection/i)).toBeInTheDocument();
  });

  it('truncates typed input beyond 150 characters', () => {
    render(<CjConnectionModal show onHide={noop} supplierId={3} connection={null} onSuccess={noop} />);
    const longValue = 'a'.repeat(200);
    fireEvent.change(screen.getByTestId('input-external-account-ref'), { target: { value: longValue } });
    const input = screen.getByTestId('input-external-account-ref') as HTMLInputElement;
    expect(input.value.length).toBe(150);
  });

  it('submits and calls onSuccess with the returned connection, then closes', async () => {
    const updated = { ...existingConnection, externalAccountRef: 'cj-account-123' };
    mockConfigureConnection.mockResolvedValue({ data: updated });
    const onSuccess = vi.fn();
    const onHide = vi.fn();
    render(<CjConnectionModal show onHide={onHide} supplierId={3} connection={null} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByTestId('input-external-account-ref'), { target: { value: 'cj-account-123' } });
    fireEvent.click(screen.getByTestId('btn-modal-save-connection'));

    await waitFor(() =>
      expect(mockConfigureConnection).toHaveBeenCalledWith(3, { externalAccountRef: 'cj-account-123' })
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(updated));
    expect(onHide).toHaveBeenCalled();
  });

  it('submits with a null externalAccountRef when the field is left blank', async () => {
    mockConfigureConnection.mockResolvedValue({ data: existingConnection });
    render(<CjConnectionModal show onHide={noop} supplierId={3} connection={null} onSuccess={noop} />);

    fireEvent.click(screen.getByTestId('btn-modal-save-connection'));

    await waitFor(() => expect(mockConfigureConnection).toHaveBeenCalledWith(3, { externalAccountRef: null }));
  });

  it('shows the mapped error inline and does not close on failure', async () => {
    mockConfigureConnection.mockRejectedValue({ response: { data: { error: { code: 'VALIDATION_ERROR' } } } });
    const onHide = vi.fn();
    render(<CjConnectionModal show onHide={onHide} supplierId={3} connection={null} onSuccess={noop} />);

    fireEvent.click(screen.getByTestId('btn-modal-save-connection'));

    expect(await screen.findByText(/check the form fields/i)).toBeInTheDocument();
    expect(onHide).not.toHaveBeenCalled();
  });

  it('never renders a password/credential input — only the account reference text field', () => {
    render(<CjConnectionModal show onHide={noop} supplierId={3} connection={null} onSuccess={noop} />);
    expect(document.querySelector('input[type="password"]')).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getAllByRole('textbox')[0]).toBe(screen.getByTestId('input-external-account-ref'));
  });
});
