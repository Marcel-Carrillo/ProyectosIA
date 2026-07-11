import { vi } from 'vitest';
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../test-utils/renderWithI18n';
import VariantSelector from './VariantSelector';
import { ProductVariant } from '../../types/product';

const makeVariant = (
  id: number,
  size: string | null,
  color: string | null,
  deleted = false
): ProductVariant => ({
  id,
  productId: 1,
  sku: `SKU-${id}`,
  size,
  color,
  publicPrice: 49.99,
  compareAtPrice: null,
  stockPolicy: 'SupplierManaged',
  status: 'Active',
  deletedAt: deleted ? '2026-01-01T00:00:00Z' : null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const variants: ProductVariant[] = [
  makeVariant(1, 'S', 'Black'),
  makeVariant(2, 'M', 'Black'),
  makeVariant(3, 'S', 'White'),
  makeVariant(4, 'M', 'White', true),
];

describe('VariantSelector', () => {
  it('renders distinct size options from active variants', () => {
    renderWithI18n(<VariantSelector variants={variants} onVariantChange={vi.fn()} />);
    expect(screen.getByLabelText(/Size S/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Size M/)).toBeInTheDocument();
  });

  it('renders distinct color options', () => {
    renderWithI18n(<VariantSelector variants={variants} onVariantChange={vi.fn()} />);
    expect(screen.getByLabelText(/Color Black/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Color White/)).toBeInTheDocument();
  });

  it('disables unavailable size/color combination', () => {
    renderWithI18n(<VariantSelector variants={variants} onVariantChange={vi.fn()} />);
    // Select size M first — then M+White is unavailable (variant 4 is deleted)
    fireEvent.click(screen.getByLabelText(/Size M/));
    const whiteBtn = screen.getByLabelText(/Color White \(unavailable\)/i);
    expect(whiteBtn).toBeDisabled();
  });

  it('calls onVariantChange with the matching variant on selection', () => {
    const onChange = vi.fn();
    renderWithI18n(<VariantSelector variants={variants} onVariantChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Size M/));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, size: 'M', color: 'Black' })
    );
  });
});
