import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { cjConnectionService, extractCjConnectionErrorMessage } from '../../services/cjConnectionService';
import { CjConnection } from '../../types/cjConnection';

type CjConnectionModalProps = {
  show: boolean;
  onHide: () => void;
  supplierId: number;
  connection: CjConnection | null;
  onSuccess: (connection: CjConnection) => void;
};

const MAX_EXTERNAL_ACCOUNT_REF_LENGTH = 150;

const CjConnectionModal: React.FC<CjConnectionModalProps> = ({
  show,
  onHide,
  supplierId,
  connection,
  onSuccess,
}) => {
  const [externalAccountRef, setExternalAccountRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setExternalAccountRef(connection?.externalAccountRef ?? '');
      setError('');
    }
  }, [show, connection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const trimmed = externalAccountRef.trim();
      const res = await cjConnectionService.configureConnection(supplierId, {
        externalAccountRef: trimmed ? trimmed : null,
      });
      onSuccess(res.data);
      onHide();
    } catch (err) {
      setError(extractCjConnectionErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} fullscreen="sm-down" data-testid="modal-configure-cj-connection">
      <Modal.Header closeButton>
        <Modal.Title>{connection ? 'Editar' : 'Configurar'} conexión con CJ Dropshipping</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Referencia externa de cuenta (opcional, no es una credencial)</Form.Label>
            <Form.Control
              type="text"
              maxLength={MAX_EXTERNAL_ACCOUNT_REF_LENGTH}
              value={externalAccountRef}
              onChange={(e) => setExternalAccountRef(e.target.value.slice(0, MAX_EXTERNAL_ACCOUNT_REF_LENGTH))}
              placeholder="p. ej. cj-account-123"
              data-testid="input-external-account-ref"
            />
            <Form.Text muted>
              Se trata de una referencia de cuenta de CJ Dropshipping, no de una clave API ni de una contraseña. La clave API
              de CJ Dropshipping se configura en el servidor y nunca se introduce aquí.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={submitting} data-testid="btn-modal-cancel">
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={submitting} data-testid="btn-modal-save-connection">
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CjConnectionModal;
