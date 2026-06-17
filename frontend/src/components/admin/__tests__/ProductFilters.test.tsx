import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductFilters, { FiltersState } from '../ProductFilters';
import { Category } from '../../../types/category';

const baseFilters: FiltersState = {
  status: '',
  categoryId: '',
  search: '',
  sort: 'createdAt',
  order: 'desc',
};

const categories: Category[] = [
  { id: 4, name: 'Electronics', description: null, imageUrl: null, status: 'Active', parentId: null, createdAt: '', updatedAt: '' },
];

describe('ProductFilters', () => {
  it('renders category options from props', () => {
    render(
      <ProductFilters filters={baseFilters} categories={categories} onFilterChange={jest.fn()} onReset={jest.fn()} />,
    );
    expect(screen.getByRole('option', { name: 'Electronics' })).toBeInTheDocument();
  });

  it('calls onFilterChange when status changes', () => {
    const onFilterChange = jest.fn();
    render(
      <ProductFilters filters={baseFilters} categories={categories} onFilterChange={onFilterChange} onReset={jest.fn()} />,
    );
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'Active' } });
    expect(onFilterChange).toHaveBeenCalledWith('status', 'Active');
  });

  it('calls onFilterChange when search changes', () => {
    const onFilterChange = jest.fn();
    render(
      <ProductFilters filters={baseFilters} categories={categories} onFilterChange={onFilterChange} onReset={jest.fn()} />,
    );
    fireEvent.change(screen.getByTestId('filter-search'), { target: { value: 'dress' } });
    expect(onFilterChange).toHaveBeenCalledWith('search', 'dress');
  });

  it('calls onReset when Reset is clicked', () => {
    const onReset = jest.fn();
    render(
      <ProductFilters filters={baseFilters} categories={categories} onFilterChange={jest.fn()} onReset={onReset} />,
    );
    fireEvent.click(screen.getByTestId('btn-filter-reset'));
    expect(onReset).toHaveBeenCalled();
  });
});
