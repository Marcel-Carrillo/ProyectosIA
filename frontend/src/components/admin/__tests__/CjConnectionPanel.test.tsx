import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CjConnectionPanel from '../CjConnectionPanel';
import { CjConnection } from '../../../types/cjConnection';

const mockVerifyConnection = vi.fn();
const mockSync = vi.fn();

vi.mock('../../../services/cjConnectionService', async () => ({
  cjConnectionService: {
    verifyConnection: (...args: unknown[]) => mockVerifyConnection(...args),
    sync: (...args: unknown[]) => mockSync(...args),
  },
  extractCjConnectionErrorMessage: (await vi.importActual('../../../services/cjConnectionService'))
    .extractCjConnectionErrorMessage,
}));

const noop = () => undefined;

const connectedConnection: CjConnection = {
  id: 1,
  supplierId: 3,
  provider: 'CJDropshipping',
  status: 'Connected',
  externalAccountRef: 'cj-account-123',
  lastVerifiedAt: '2026-01-01T00:00:00.000Z',
  lastSyncedAt: '2026-01-02T00:00:00.000Z',
  createdAt: '',
  updatedAt: '',
};

const disconnectedConnection: CjConnection = {
  ...connectedConnection,
  status: 'Disconnected',
  externalAccountRef: null,
  lastVerifiedAt: null,
  lastSyncedAt: null,
};

describe('CjConnectionPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders only the configure CTA when not configured', () => {
    render(
      <CjConnectionPanel
        supplierId={3}
        connection={null}
        onConfigureClick={noop}
        onRefreshConnection={noop}
        onCatalogRefreshNeeded={noop}
      />
    );
    expect(screen.getByTestId('btn-configure-connection')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-verify-connection')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-sync-catalog')).not.toBeInTheDocument();
  });

  it('renders provider/status/account-ref/timestamps when configured', () => {
    render(
      <CjConnectionPanel
        supplierId={3}
        connection={connectedConnection}
        onConfigureClick={noop}
        onRefreshConnection={noop}
        onCatalogRefreshNeeded={noop}
      />
    );
    expect(screen.getByTestId('cj-connection-status')).toHaveTextContent('Connected');
    expect(screen.getByText(/cj-account-123/)).toBeInTheDocument();
  });

  it('shows fallback labels for null timestamps and account ref', () => {
    render(
      <CjConnectionPanel
        supplierId={3}
        connection={disconnectedConnection}
        onConfigureClick={noop}
        onRefreshConnection={noop}
        onCatalogRefreshNeeded={noop}
      />
    );
    expect(screen.getByText(/Never verified/)).toBeInTheDocument();
    expect(screen.getByText(/Never synced/)).toBeInTheDocument();
    expect(screen.getByText(/Account ref: —/)).toBeInTheDocument();
  });

  it('disables Sync for a Disconnected/Error connection and enables it when Connected', () => {
    const { rerender } = render(
      <CjConnectionPanel
        supplierId={3}
        connection={disconnectedConnection}
        onConfigureClick={noop}
        onRefreshConnection={noop}
        onCatalogRefreshNeeded={noop}
      />
    );
    expect(screen.getByTestId('btn-sync-catalog')).toBeDisabled();

    rerender(
      <CjConnectionPanel
        supplierId={3}
        connection={connectedConnection}
        onConfigureClick={noop}
        onRefreshConnection={noop}
        onCatalogRefreshNeeded={noop}
      />
    );
    expect(screen.getByTestId('btn-sync-catalog')).not.toBeDisabled();
  });

  it('calls onRefreshConnection and shows the result on a successful verify', async () => {
    mockVerifyConnection.mockResolvedValue({ data: { healthy: true } });
    const onRefreshConnection = vi.fn();
    render(
      <CjConnectionPanel
        supplierId={3}
        connection={connectedConnection}
        onConfigureClick={noop}
        onRefreshConnection={onRefreshConnection}
        onCatalogRefreshNeeded={noop}
      />
    );

    fireEvent.click(screen.getByTestId('btn-verify-connection'));
    await waitFor(() => expect(onRefreshConnection).toHaveBeenCalled());
    expect(await screen.findByTestId('cj-verify-result')).toHaveTextContent(/healthy/i);
  });

  it('disables the Verify button while the request is in flight', async () => {
    mockVerifyConnection.mockReturnValue(new Promise(() => {}));
    render(
      <CjConnectionPanel
        supplierId={3}
        connection={connectedConnection}
        onConfigureClick={noop}
        onRefreshConnection={noop}
        onCatalogRefreshNeeded={noop}
      />
    );

    const button = screen.getByTestId('btn-verify-connection');
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
  });

  it('calls both callbacks and shows the result on a successful sync', async () => {
    mockSync.mockResolvedValue({ data: { itemsUpserted: 2, itemsFailed: 0, syncedAt: '2026-01-01T00:00:00.000Z' } });
    const onRefreshConnection = vi.fn();
    const onCatalogRefreshNeeded = vi.fn();
    render(
      <CjConnectionPanel
        supplierId={3}
        connection={connectedConnection}
        onConfigureClick={noop}
        onRefreshConnection={onRefreshConnection}
        onCatalogRefreshNeeded={onCatalogRefreshNeeded}
      />
    );

    fireEvent.click(screen.getByTestId('btn-sync-catalog'));

    await waitFor(() => expect(onRefreshConnection).toHaveBeenCalled());
    expect(onCatalogRefreshNeeded).toHaveBeenCalled();
    expect(await screen.findByTestId('cj-sync-result')).toHaveTextContent('2');
  });

  it('disables the Sync button while the request is in flight', async () => {
    mockSync.mockReturnValue(new Promise(() => {}));
    render(
      <CjConnectionPanel
        supplierId={3}
        connection={connectedConnection}
        onConfigureClick={noop}
        onRefreshConnection={noop}
        onCatalogRefreshNeeded={noop}
      />
    );

    const button = screen.getByTestId('btn-sync-catalog');
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
  });

  it('shows a connection error banner when verify fails', async () => {
    mockVerifyConnection.mockRejectedValue({ response: { data: { error: { code: 'CJ_CONNECTION_NOT_READY' } } } });
    render(
      <CjConnectionPanel
        supplierId={3}
        connection={connectedConnection}
        onConfigureClick={noop}
        onRefreshConnection={noop}
        onCatalogRefreshNeeded={noop}
      />
    );

    fireEvent.click(screen.getByTestId('btn-verify-connection'));

    expect(await screen.findByTestId('cj-connection-error')).toHaveTextContent(/not ready/i);
  });
});
