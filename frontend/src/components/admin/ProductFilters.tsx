import React from 'react';
import { Row, Col, Form, Button } from 'react-bootstrap';
import { Category } from '../../types/category';

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
      <Form.Label className="small mb-1">Search</Form.Label>
      <Form.Control
        type="search"
        placeholder="Search by name…"
        aria-label="Search products by name"
        value={filters.search}
        onChange={(e) => onFilterChange('search', e.target.value)}
        data-testid="filter-search"
      />
    </Col>
    <Col xs={12} md={2}>
      <Form.Label className="small mb-1">Status</Form.Label>
      <Form.Select
        value={filters.status}
        aria-label="Filter by status"
        onChange={(e) => onFilterChange('status', e.target.value)}
        data-testid="filter-status"
      >
        <option value="">All statuses</option>
        <option value="Draft">Draft</option>
        <option value="Active">Active</option>
        <option value="Inactive">Inactive</option>
        <option value="Archived">Archived</option>
      </Form.Select>
    </Col>
    <Col xs={12} md={3}>
      <Form.Label className="small mb-1">Category</Form.Label>
      <Form.Select
        value={filters.categoryId}
        aria-label="Filter by category"
        onChange={(e) => onFilterChange('categoryId', e.target.value)}
        data-testid="filter-category"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Form.Select>
    </Col>
    <Col xs={6} md={2}>
      <Form.Label className="small mb-1">Sort by</Form.Label>
      <Form.Select
        value={filters.sort}
        aria-label="Sort by"
        onChange={(e) => onFilterChange('sort', e.target.value)}
        data-testid="filter-sort"
      >
        <option value="createdAt">Created</option>
        <option value="name">Name</option>
      </Form.Select>
    </Col>
    <Col xs={6} md={1}>
      <Form.Label className="small mb-1">Order</Form.Label>
      <Form.Select
        value={filters.order}
        aria-label="Sort order"
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
        Reset
      </Button>
    </Col>
  </Row>
);

export default ProductFilters;
