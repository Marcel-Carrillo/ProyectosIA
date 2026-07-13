import React, { useState } from 'react';
import { Row, Col, Card, Form, Button, Alert, Modal } from 'react-bootstrap';
import { adminProductService, extractErrorMessage } from '../../services/adminProductService';
import { ProductImage, CreateImageInput } from '../../types/product';

type ImageManagerProps = {
  productId: number;
  images: ProductImage[];
  mainImageUrl: string | null;
  onImagesChange: () => void;
  onMainImageChange: (url: string) => void;
};

const ImageManager: React.FC<ImageManagerProps> = ({
  productId,
  images,
  mainImageUrl,
  onImagesChange,
  onMainImageChange,
}) => {
  const [addForm, setAddForm] = useState({ url: '', altText: '', sortOrder: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [deleting, setDeleting] = useState<ProductImage | null>(null);
  const [removing, setRemoving] = useState(false);
  const [opError, setOpError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.url.trim()) {
      setAddError('La URL de la imagen es obligatoria.');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      const payload: CreateImageInput = {
        url: addForm.url.trim(),
        altText: addForm.altText || null,
        sortOrder: addForm.sortOrder ? Number(addForm.sortOrder) : undefined,
      };
      await adminProductService.addImage(productId, payload);
      setAddForm({ url: '', altText: '', sortOrder: '' });
      onImagesChange();
    } catch (err) {
      setAddError(extractErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleSortOrderBlur = async (image: ProductImage, value: string) => {
    const next = Number(value);
    if (Number.isNaN(next) || next === image.sortOrder) return;
    setOpError('');
    try {
      await adminProductService.updateImage(productId, image.id as number, { sortOrder: next });
      onImagesChange();
    } catch (err) {
      setOpError(extractErrorMessage(err));
    }
  };

  const handleSetMain = async (image: ProductImage) => {
    setOpError('');
    try {
      await adminProductService.update(productId, { mainImageUrl: image.url });
      onMainImageChange(image.url);
    } catch (err) {
      setOpError(extractErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    setOpError('');
    try {
      await adminProductService.deleteImage(productId, deleting.id as number);
      setDeleting(null);
      onImagesChange();
    } catch (err) {
      setOpError(extractErrorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div data-testid="images-manager">
      {opError && <Alert variant="danger">{opError}</Alert>}

      {sorted.length === 0 ? (
        <Alert variant="info">Aún no hay imágenes.</Alert>
      ) : (
        <Row className="g-3 mb-3">
          {sorted.map((image) => {
            const isMain = image.url === mainImageUrl;
            return (
              <Col key={image.id} xs={6} md={3} data-testid={`image-card-${image.id}`}>
                <Card>
                  <Card.Img
                    variant="top"
                    src={image.url}
                    alt={image.altText ?? ''}
                    style={{ height: 120, objectFit: 'cover' }}
                  />
                  <Card.Body className="p-2">
                    {isMain && <div className="badge bg-primary mb-1">Principal</div>}
                    <Form.Group className="mb-2">
                      <Form.Label className="small mb-0">Orden</Form.Label>
                      <Form.Control
                        type="number"
                        size="sm"
                        defaultValue={image.sortOrder}
                        onBlur={(e) => handleSortOrderBlur(image, e.target.value)}
                        data-testid={`input-image-sort-${image.id}`}
                      />
                    </Form.Group>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="w-100 mb-1 admin-touch-btn"
                      disabled={isMain}
                      onClick={() => handleSetMain(image)}
                      data-testid={`btn-set-main-${image.id}`}
                    >
                      {isMain ? 'Imagen principal' : 'Establecer como principal'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      className="w-100 admin-touch-btn"
                      onClick={() => setDeleting(image)}
                      data-testid={`btn-delete-image-${image.id}`}
                    >
                      Eliminar
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Card>
        <Card.Header className="py-2">
          <strong>Añadir imagen</strong>
        </Card.Header>
        <Card.Body>
          {addError && <Alert variant="danger">{addError}</Alert>}
          <Form onSubmit={handleAdd}>
            <Row className="g-2 align-items-end">
              <Col xs={12} md={6}>
                <Form.Label className="small mb-1">URL *</Form.Label>
                <Form.Control
                  type="text"
                  value={addForm.url}
                  onChange={(e) => setAddForm((p) => ({ ...p, url: e.target.value }))}
                  data-testid="input-image-url"
                />
              </Col>
              <Col xs={12} md={3}>
                <Form.Label className="small mb-1">Texto alternativo</Form.Label>
                <Form.Control
                  type="text"
                  value={addForm.altText}
                  onChange={(e) => setAddForm((p) => ({ ...p, altText: e.target.value }))}
                  data-testid="input-image-alt"
                />
              </Col>
              <Col xs={12} md={2}>
                <Form.Label className="small mb-1">Orden</Form.Label>
                <Form.Control
                  type="number"
                  value={addForm.sortOrder}
                  onChange={(e) => setAddForm((p) => ({ ...p, sortOrder: e.target.value }))}
                  data-testid="input-image-sort"
                />
              </Col>
              <Col xs={12} md={1}>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-100 admin-touch-btn"
                  disabled={adding}
                  data-testid="btn-add-image"
                >
                  {adding ? '…' : 'Añadir'}
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Modal show={deleting !== null} onHide={() => setDeleting(null)} fullscreen="sm-down">
        <Modal.Header closeButton>
          <Modal.Title>Eliminar imagen</Modal.Title>
        </Modal.Header>
        <Modal.Body>¿Está seguro de que desea eliminar esta imagen?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={removing}
            onClick={confirmDelete}
            data-testid="btn-confirm-delete-image"
          >
            {removing ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ImageManager;
