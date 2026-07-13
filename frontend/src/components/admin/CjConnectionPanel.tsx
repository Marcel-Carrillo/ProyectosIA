import React, { useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { cjConnectionService, extractCjConnectionErrorMessage } from '../../services/cjConnectionService';
import { CjConnection, CjSyncResult, CjVerifyResult } from '../../types/cjConnection';
import StatusBadge from './StatusBadge';

type CjConnectionPanelProps = {
  supplierId: number;
  connection: CjConnection | null;
  onConfigureClick: () => void;
  onRefreshConnection: () => void | Promise<void>;
  onCatalogRefreshNeeded: () => void;
};

const formatTimestamp = (value: string | null, emptyLabel: string): string =>
  value ? new Date(value).toLocaleString() : emptyLabel;

const CjConnectionPanel: React.FC<CjConnectionPanelProps> = ({
  supplierId,
  connection,
  onConfigureClick,
  onRefreshConnection,
  onCatalogRefreshNeeded,
}) => {
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<CjVerifyResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<CjSyncResult | null>(null);
  const [actionError, setActionError] = useState('');

  const canSync = connection?.status === 'Connected';

  const handleVerify = async () => {
    setVerifying(true);
    setActionError('');
    setVerifyResult(null);
    setSyncResult(null);
    try {
      const res = await cjConnectionService.verifyConnection(supplierId);
      setVerifyResult(res.data);
      await onRefreshConnection();
    } catch (err) {
      setActionError(extractCjConnectionErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setActionError('');
    setSyncResult(null);
    setVerifyResult(null);
    try {
      const res = await cjConnectionService.sync(supplierId);
      setSyncResult(res.data);
      await onRefreshConnection();
      onCatalogRefreshNeeded();
    } catch (err) {
      setActionError(extractCjConnectionErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="admin-card-row cj-connection-panel mb-3" data-testid="cj-connection-panel">
      {!connection && (
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          <div className="flex-grow-1">
            <div className="fw-semibold">Conexión con CJ Dropshipping</div>
            <div className="admin-card-row__meta">Aún no está configurada.</div>
          </div>
          <div className="admin-card-row__actions">
            <Button
              variant="primary"
              className="admin-touch-btn"
              onClick={onConfigureClick}
              data-testid="btn-configure-connection"
            >
              Configurar conexión
            </Button>
          </div>
        </div>
      )}

      {connection && (
        <>
          <div className="admin-card-row__header d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
            <div className="flex-grow-1">
              <div className="fw-semibold">
                {connection.provider} <StatusBadge status={connection.status} data-testid="cj-connection-status" />
              </div>
              <div className="admin-card-row__meta">Ref. de cuenta: {connection.externalAccountRef ?? '—'}</div>
              <div className="admin-card-row__meta">
                Última verificación: {formatTimestamp(connection.lastVerifiedAt, 'Nunca verificada')}
                {' · '}
                Última sincronización: {formatTimestamp(connection.lastSyncedAt, 'Nunca sincronizada')}
              </div>
            </div>

            <div className="admin-card-row__actions">
              <Button
                variant="outline-secondary"
                className="admin-touch-btn"
                onClick={onConfigureClick}
                data-testid="btn-edit-connection"
              >
                Editar
              </Button>
              <Button
                variant="outline-primary"
                className="admin-touch-btn"
                disabled={verifying}
                onClick={handleVerify}
                data-testid="btn-verify-connection"
              >
                {verifying ? 'Verificando…' : 'Verificar'}
              </Button>
              <Button
                variant="primary"
                className="admin-touch-btn"
                disabled={!canSync || syncing}
                onClick={handleSync}
                data-testid="btn-sync-catalog"
              >
                {syncing ? 'Sincronizando…' : 'Sincronizar catálogo'}
              </Button>
            </div>
          </div>

          {!canSync && (
            <div className="admin-card-row__meta" data-testid="cj-sync-disabled-hint">
              Verifique la conexión antes de sincronizar.
            </div>
          )}

          {actionError && (
            <Alert variant="danger" className="mt-2 mb-0" data-testid="cj-connection-error">
              {actionError}
            </Alert>
          )}
          {verifyResult && (
            <Alert
              variant={verifyResult.healthy ? 'success' : 'warning'}
              className="mt-2 mb-0"
              data-testid="cj-verify-result"
            >
              {verifyResult.healthy ? 'Conexión correcta.' : 'La verificación de la conexión ha fallado.'}
              {verifyResult.reason ? ` ${verifyResult.reason}` : ''}
            </Alert>
          )}
          {syncResult && (
            <Alert variant="info" className="mt-2 mb-0" data-testid="cj-sync-result">
              Sincronización completada: {syncResult.itemsUpserted} artículo{syncResult.itemsUpserted === 1 ? '' : 's'} actualizado{syncResult.itemsUpserted === 1 ? '' : 's'}
              {syncResult.itemsFailed > 0 ? `, ${syncResult.itemsFailed} con error` : ''}.
            </Alert>
          )}
        </>
      )}
    </div>
  );
};

export default CjConnectionPanel;
