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
      setAddError('Image URL is required.');
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
        <Alert variant="info">No images yet.</Alert>
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
                    {isMain && <div className="badge bg-primary mb-1">Main</div>}
                    <Form.Group className="mb-2">
                      <Form.Label className="small mb-0">Order</Form.Label>
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
                      className="w-100 mb-1"
                      disabled={isMain}
                      onClick={() => handleSetMain(image)}
                      data-testid={`btn-set-main-${image.id}`}
                    >
                      {isMain ? 'Main image' : 'Set as main'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      className="w-100"
                      onClick={() => setDeleting(image)}
                      data-testid={`btn-delete-image-${image.id}`}
                    >
                      Delete
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
          <strong>Add image</strong>
        </Card.Header>
        <Card.Body>
          {addError && <Alert variant="danger">{addError}</Alert>}
          <Form onSubmit={handleAdd}>
            <Row className="g-2 align-items-end">
              <Col md={6}>
                <Form.Label className="small mb-1">URL *</Form.Label>
                <Form.Control
                  type="text"
                  value={addForm.url}
                  onChange={(e) => setAddForm((p) => ({ ...p, url: e.target.value }))}
                  data-testid="input-image-url"
                />
              </Col>
              <Col md={3}>
                <Form.Label className="small mb-1">Alt text</Form.Label>
                <Form.Control
                  type="text"
                  value={addForm.altText}
                  onChange={(e) => setAddForm((p) => ({ ...p, altText: e.target.value }))}
                  data-testid="input-image-alt"
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">Order</Form.Label>
                <Form.Control
                  type="number"
                  value={addForm.sortOrder}
                  onChange={(e) => setAddForm((p) => ({ ...p, sortOrder: e.target.value }))}
                  data-testid="input-image-sort"
                />
              </Col>
              <Col md={1}>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-100"
                  disabled={adding}
                  data-testid="btn-add-image"
                >
                  {adding ? '…' : 'Add'}
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Modal show={deleting !== null} onHide={() => setDeleting(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete image</Modal.Title>
        </Modal.Header>
        <Modal.Body>Are you sure you want to delete this image?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={removing}
            onClick={confirmDelete}
            data-testid="btn-confirm-delete-image"
          >
            {removing ? 'Deleting…' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ImageManager;
