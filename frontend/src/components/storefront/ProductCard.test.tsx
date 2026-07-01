import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';
import { Product } from '../../types/product';

const baseProduct: Product = {
  id: 1,
  name: 'Black Midi Dress',
  slug: 'black-midi-dress',
  description: 'An elegant dress',
  brand: 'Store Brand',
  status: 'Active',
  mainImageUrl: 'https://cdn.example.com/dress.jpg',
  categoryId: 1,
  variants: [
    {
      id: 1,
      productId: 1,
      sku: 'DRESS-S',
      size: 'S',
      color: 'Black',
      publicPrice: 49.99,
      compareAtPrice: null,
      stockPolicy: 'TRACK',
      status: 'Active',
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  images: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ProductCard', () => {
  it('renders product name, brand and price', () => {
    render(
      <MemoryRouter>
        <ProductCard product={baseProduct} />
      </MemoryRouter>
    );
    expect(screen.getByText('Black Midi Dress')).toBeInTheDocument();
    expect(screen.getByText('Store Brand')).toBeInTheDocument();
    expect(screen.getByText(/49/)).toBeInTheDocument();
  });

  it('renders the product image with alt text', () => {
    render(
      <MemoryRouter>
        <ProductCard product={baseProduct} />
      </MemoryRouter>
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/dress.jpg');
    expect(img).toHaveAttribute('alt', 'Black Midi Dress');
  });

  it('renders a placeholder when product has no images', () => {
    const noImage: Product = { ...baseProduct, mainImageUrl: null, images: [] };
    render(
      <MemoryRouter>
        <ProductCard product={noImage} />
      </MemoryRouter>
    );
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toContain('data:image/svg+xml');
  });

  it('prefers image altText over product name when both mainImageUrl and altText are present', () => {
    const withAlt: Product = {
      ...baseProduct,
      mainImageUrl: 'https://cdn.example.com/dress.jpg',
      images: [{ id: 1, productId: 1, url: 'https://cdn.example.com/dress.jpg', altText: 'Black midi dress on model', sortOrder: 0, createdAt: '2026-01-01T00:00:00Z' }],
    };
    render(
      <MemoryRouter>
        <ProductCard product={withAlt} />
      </MemoryRouter>
    );
    expect(screen.getByRole('img', { name: 'Black midi dress on model' })).toBeInTheDocument();
  });

  it('falls back to product name when altText is empty, even with mainImageUrl set', () => {
    const noAlt: Product = {
      ...baseProduct,
      mainImageUrl: 'https://cdn.example.com/dress.jpg',
      images: [{ id: 1, productId: 1, url: 'https://cdn.example.com/dress.jpg', altText: null, sortOrder: 0, createdAt: '2026-01-01T00:00:00Z' }],
    };
    render(
      <MemoryRouter>
        <ProductCard product={noAlt} />
      </MemoryRouter>
    );
    expect(screen.getByRole('img', { name: 'Black Midi Dress' })).toBeInTheDocument();
  });

  it('links to the correct catalog/:id path', () => {
    render(
      <MemoryRouter>
        <ProductCard product={baseProduct} />
      </MemoryRouter>
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/catalog/1');
  });
});
