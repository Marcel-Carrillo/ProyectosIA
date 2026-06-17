import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Container, Card, Row, Col, Form, Button, Alert } from 'react-bootstrap';
import { adminProductService, mapProductError } from '../services/adminProductService';
import { categoryService } from '../services/categoryService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import StatusBadge from '../components/admin/StatusBadge';
import VariantTable from '../components/admin/VariantTable';
import ImageManager from '../components/admin/ImageManager';
import {
  Product,
  ProductVariant,
  ProductImage,
  ProductStatus,
  UpdateProductInput,
  AdminApiError,
} from '../types/product';
import { Category } from '../types/category';

const errorCode = (error: unknown): string =>
  (error as AxiosError<AdminApiError>).response?.data?.error?.code ?? '';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const numId = Number(id);

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    brand: '',
    categoryId: '',
    mainImageUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError('');
    try {
      const [productRes, variantsRes, imagesRes, cats] = await Promise.all([
        adminProductService.getById(numId),
        adminProductService.listVariants(numId),
        adminProductService.listImages(numId),
        categoryService.getAll(),
      ]);
      setProduct(productRes.data);
      setVariants(variantsRes.data);
      setImages(imagesRes.data);
      setCategories(cats);
      setFormData({
        name: productRes.data.name,
        description: productRes.data.description ?? '',
        brand: productRes.data.brand ?? '',
        categoryId: productRes.data.categoryId ? String(productRes.data.categoryId) : '',
        mainImageUrl: productRes.data.mainImageUrl ?? '',
      });
    } catch (error) {
      if (errorCode(error) === 'PRODUCT_NOT_FOUND') {
        navigate('/products');
        return;
      }
      setLoadError('Unable to load the product. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [id, numId, navigate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const canActivate = variants.some((v) => v.status === 'Active');

  const refetchVariants = useCallback(async () => {
    const res = await adminProductService.listVariants(numId);
    setVariants(res.data);
  }, [numId]);

  const refetchImages = useCallback(async () => {
    const res = await adminProductService.listImages(numId);
    setImages(res.data);
  }, [numId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const payload: UpdateProductInput = {
        name: formData.name,
        description: formData.description || null,
        brand: formData.brand || null,
        categoryId: formData.categoryId ? Number(formData.categoryId) : null,
        mainImageUrl: formData.mainImageUrl || null,
      };
      const res = await adminProductService.update(numId, payload);
      setProduct(res.data);
      setSaveSuccess(true);
    } catch (error) {
      const code = errorCode(error);
      if (code === 'PRODUCT_NOT_FOUND') {
        navigate('/products');
        return;
      }
      setSaveError(mapProductError(code));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: ProductStatus) => {
    if (!product) return;
    setStatusSaving(true);
    setStatusError('');
    try {
      const res = await adminProductService.update(numId, { status: newStatus });
      setProduct(res.data);
    } catch (error) {
      const code = errorCode(error);
      if (code === 'PRODUCT_NOT_FOUND') {
        navigate('/products');
        return;
      }
      setStatusError(mapProductError(code));
    } finally {
      setStatusSaving(false);
    }

    try {
      await refetchVariants();
    } catch {
      // Status already saved; variant refetch failure must not look like a status error.
    }
  };

  const renderStatusControls = () => {
    if (!product) return null;
    const { status } = product;

    if (status === 'Archived') {
      return (
        <Alert variant="secondary" className="mb-0">
          This product is Archived. Status changes are not allowed.
        </Alert>
      );
    }

    return (
      <div className="d-flex gap-2 flex-wrap align-items-center">
        {statusError && (
          <Alert variant="danger" className="w-100 mb-2">
            {statusError}
          </Alert>
        )}

        {(status === 'Draft' || status === 'Inactive') && (
          <Button
            variant="success"
            disabled={!canActivate || statusSaving}
            onClick={() => handleStatusChange('Active')}
            data-testid="btn-activate"
            title={!canActivate ? 'Add an active variant first' : undefined}
          >
            Activate
          </Button>
        )}

        {status === 'Draft' && (
          <Button
            variant="outline-secondary"
            disabled={statusSaving}
            onClick={() => handleStatusChange('Inactive')}
            data-testid="btn-deactivate"
          >
            Set Inactive
          </Button>
        )}

        {status === 'Active' && (
          <Button
            variant="outline-warning"
            disabled={statusSaving}
            onClick={() => handleStatusChange('Inactive')}
            data-testid="btn-deactivate"
          >
            Deactivate
          </Button>
        )}

        {(status === 'Draft' || status === 'Active' || status === 'Inactive') && (
          <Button
            variant="outline-danger"
            disabled={statusSaving}
            onClick={() => handleStatusChange('Archived')}
            data-testid="btn-archive"
          >
            Archive
          </Button>
        )}

        {!canActivate && status !== 'Active' && (
          <span className="text-muted small">Add an active variant to enable activation.</span>
        )}
      </div>
    );
  };

  return (
    <Container className="py-4">
      <Button variant="link" className="mb-3 ps-0" onClick={() => navigate('/products')}>
        ← Back to Products
      </Button>

      {loading && <LoadingSpinner />}
      {!loading && loadError && <ErrorAlert message={loadError} />}

      {!loading && product && (
        <>
          <div className="d-flex align-items-center gap-3 mb-4">
            <h1 className="h3 mb-0">{product.name}</h1>
            <StatusBadge status={product.status} data-testid="status-badge" />
          </div>

          <Card className="mb-4" data-testid="general-section">
            <Card.Header>
              <strong>General</strong>
            </Card.Header>
            <Card.Body>
              {saveSuccess && (
                <Alert variant="success" dismissible onClose={() => setSaveSuccess(false)}>
                  Saved successfully.
                </Alert>
              )}
              {saveError && <Alert variant="danger">{saveError}</Alert>}
              <Form onSubmit={handleSave} data-testid="product-detail-form">
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Name *</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        required
                        data-testid="input-name"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Slug <small className="text-muted">(read-only, auto-generated)</small>
                      </Form.Label>
                      <Form.Control type="text" value={product.slug} readOnly plaintext className="text-muted" />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  />
                </Form.Group>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Brand</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData((p) => ({ ...p, brand: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Category</Form.Label>
                      <Form.Select
                        value={formData.categoryId}
                        onChange={(e) => setFormData((p) => ({ ...p, categoryId: e.target.value }))}
                      >
                        <option value="">— None —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Main image URL</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.mainImageUrl}
                        onChange={(e) => setFormData((p) => ({ ...p, mainImageUrl: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Button type="submit" variant="primary" disabled={saving} data-testid="btn-save">
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </Form>
            </Card.Body>
          </Card>

          <Card className="mb-4" data-testid="status-section">
            <Card.Header>
              <strong>Status</strong>
            </Card.Header>
            <Card.Body>{renderStatusControls()}</Card.Body>
          </Card>

          <Card className="mb-4" data-testid="variants-section">
            <Card.Header>
              <strong>Variants</strong>
            </Card.Header>
            <Card.Body>
              <VariantTable productId={product.id as number} variants={variants} onVariantsChange={refetchVariants} />
            </Card.Body>
          </Card>

          <Card className="mb-4" data-testid="images-section">
            <Card.Header>
              <strong>Images</strong>
            </Card.Header>
            <Card.Body>
              <ImageManager
                productId={product.id as number}
                images={images}
                mainImageUrl={product.mainImageUrl ?? null}
                onImagesChange={refetchImages}
                onMainImageChange={(url) =>
                  setProduct((prev) => (prev ? { ...prev, mainImageUrl: url } : prev))
                }
              />
            </Card.Body>
          </Card>
        </>
      )}
    </Container>
  );
};

export default ProductDetailPage;
