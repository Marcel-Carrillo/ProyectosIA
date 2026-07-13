import React from 'react';
import { Row, Col, Form, Button } from 'react-bootstrap';
import { Category } from '../../types/category';
import { adminStatusLabel } from '../../utils/adminStatusLabels';

export type FiltersState = {
  status: string;
  categoryId: string;
  search: string;
  sort: 'name' | 'createdAt';
  order: 'asc' | 'desc';
};

type ProductFiltersProps = {
  filters: FiltersState;
  categories: Category[];
  onFilterChange: (key: keyof FiltersState, value: string) => void;
  onReset: () => void;
};

const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  categories,
  onFilterChange,
  onReset,
}) => (
  <Row className="g-2 mb-3 align-items-end">
    <Col xs={12} md={3}>
      <Form.Label className="small mb-1">Buscar</Form.Label>
      <Form.Control
        type="search"
        placeholder="Buscar por nombre…"
        aria-label="Buscar productos por nombre"
        value={filters.search}
        onChange={(e) => onFilterChange('search', e.target.value)}
        data-testid="filter-search"
      />
    </Col>
    <Col xs={12} md={2}>
      <Form.Label className="small mb-1">Estado</Form.Label>
      <Form.Select
        value={filters.status}
        aria-label="Filtrar por estado"
        onChange={(e) => onFilterChange('status', e.target.value)}
        data-testid="filter-status"
      >
        <option value="">Todos los estados</option>
        <option value="Draft">{adminStatusLabel('Draft')}</option>
        <option value="Active">{adminStatusLabel('Active')}</option>
        <option value="Inactive">{adminStatusLabel('Inactive')}</option>
        <option value="Archived">{adminStatusLabel('Archived')}</option>
      </Form.Select>
    </Col>
    <Col xs={12} md={3}>
      <Form.Label className="small mb-1">Categoría</Form.Label>
      <Form.Select
        value={filters.categoryId}
        aria-label="Filtrar por categoría"
        onChange={(e) => onFilterChange('categoryId', e.target.value)}
        data-testid="filter-category"
      >
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Form.Select>
    </Col>
    <Col xs={6} md={2}>
      <Form.Label className="small mb-1">Ordenar por</Form.Label>
      <Form.Select
        value={filters.sort}
        aria-label="Ordenar por"
        onChange={(e) => onFilterChange('sort', e.target.value)}
        data-testid="filter-sort"
      >
        <option value="createdAt">Fecha de creación</option>
        <option value="name">Nombre</option>
      </Form.Select>
    </Col>
    <Col xs={6} md={1}>
      <Form.Label className="small mb-1">Orden</Form.Label>
      <Form.Select
        value={filters.order}
        aria-label="Sentido de ordenación"
        onChange={(e) => onFilterChange('order', e.target.value)}
        data-testid="filter-order"
      >
        <option value="desc">Desc</option>
        <option value="asc">Asc</option>
      </Form.Select>
    </Col>
    <Col xs={12} md={1}>
      <Button
        variant="outline-secondary"
        className="w-100 admin-touch-btn"
        onClick={onReset}
        data-testid="btn-filter-reset"
      >
        Restablecer
      </Button>
    </Col>
  </Row>
);

export default ProductFilters;
