import React from 'react';
import { render, screen } from '@testing-library/react';
import ProductGallery from './ProductGallery';
import { ProductImage } from '../../types/product';

const images: ProductImage[] = [
  { id: 1, productId: 1, url: 'https://cdn.example.com/a.jpg', altText: 'Red dress front view', sortOrder: 0, createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, productId: 1, url: 'https://cdn.example.com/b.jpg', altText: null, sortOrder: 1, createdAt: '2026-01-01T00:00:00Z' },
];

describe('ProductGallery', () => {
  it('uses the active image altText for the main image', () => {
    render(<ProductGallery images={images} productName="Red Dress" />);
    const main = screen.getAllByRole('img')[0];
    expect(main).toHaveAttribute('alt', 'Red dress front view');
  });

  it('falls back to productName for the main image when altText is empty', () => {
    render(<ProductGallery images={[images[1]]} productName="Red Dress" />);
    const main = screen.getByRole('img');
    expect(main).toHaveAttribute('alt', 'Red Dress');
  });
});
