import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import ProductGallery from './ProductGallery';
import { ProductImage } from '../../types/product';

const images: ProductImage[] = [
  { id: 1, productId: 1, url: 'https://cdn.example.com/a.jpg', altText: 'Red dress front view', sortOrder: 0, color: null, createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, productId: 1, url: 'https://cdn.example.com/b.jpg', altText: null, sortOrder: 1, color: null, createdAt: '2026-01-01T00:00:00Z' },
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

const colorImages: ProductImage[] = [
  { id: 10, productId: 1, url: 'https://cdn.example.com/shared.jpg', altText: 'Shared front', sortOrder: 0, color: null, createdAt: '2026-01-01T00:00:00Z' },
  { id: 11, productId: 1, url: 'https://cdn.example.com/red-1.jpg', altText: 'Red detail 1', sortOrder: 1, color: 'Red', createdAt: '2026-01-01T00:00:00Z' },
  { id: 12, productId: 1, url: 'https://cdn.example.com/red-2.jpg', altText: 'Red detail 2', sortOrder: 2, color: 'Red', createdAt: '2026-01-01T00:00:00Z' },
  { id: 13, productId: 1, url: 'https://cdn.example.com/blue-1.jpg', altText: 'Blue detail 1', sortOrder: 3, color: 'Blue', createdAt: '2026-01-01T00:00:00Z' },
];

describe('ProductGallery — thumbnail strip is unaffected by color', () => {
  it('shows the full image list in the thumbnail strip regardless of selected color', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
    // Blue's photo is still present even though Red is selected.
    expect(screen.getByAltText('Blue detail 1')).toBeInTheDocument();
  });

  it('renders the full list unchanged when selectedColor is not provided', () => {
    render(<ProductGallery images={colorImages} productName="Dress" />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders the full list unchanged when selectedColor is explicitly null', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor={null} />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
  });
});

describe('ProductGallery — main image follows the selected color', () => {
  it('shows the selected colors own photo as the main image, not the shared photo', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);
    const main = screen.getAllByRole('img')[0];
    expect(main).toHaveAttribute('alt', 'Red detail 1');
    expect(main).toHaveAttribute('src', 'https://cdn.example.com/red-1.jpg');
  });

  it('defaults to the shared (sortOrder 0) image on first mount when the selected color has no dedicated photo', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Green" />);
    const main = screen.getAllByRole('img')[0];
    expect(main).toHaveAttribute('alt', 'Shared front');
  });

  it('switches the main image when selectedColor changes to a color with its own photo', () => {
    const { rerender } = render(
      <ProductGallery images={colorImages} productName="Dress" selectedColor="Blue" />
    );
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue detail 1');

    rerender(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Red detail 1');
  });

  it('REGRESSION: keeps the current main image when selectedColor changes to a color with no dedicated photo', () => {
    // This is the behavior this change introduces — differs from the
    // previously-merged "reset to index 0" fallback.
    const { rerender } = render(
      <ProductGallery images={colorImages} productName="Dress" selectedColor="Blue" />
    );
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue detail 1');

    // Green has no dedicated photo — main image must stay on Blue's photo,
    // not reset to the shared (sortOrder 0) image.
    rerender(<ProductGallery images={colorImages} productName="Dress" selectedColor="Green" />);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue detail 1');
  });

  it('clicking a thumbnail still overrides the main image directly, regardless of selected color', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);
    const thumbs = within(screen.getByRole('list')).getAllByRole('listitem');
    fireEvent.click(thumbs[0]!); // shared/front thumbnail
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Shared front');
  });

  it('resets to the new products own hero image when the images prop itself changes (product navigation)', () => {
    const otherProductImages: ProductImage[] = [
      { id: 20, productId: 2, url: 'https://cdn.example.com/other.jpg', altText: 'Other product', sortOrder: 0, color: null, createdAt: '2026-01-01T00:00:00Z' },
    ];
    const { rerender } = render(
      <ProductGallery images={colorImages} productName="Dress" selectedColor="Blue" />
    );
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue detail 1');

    // Simulate navigating to a different product: new images array, color
    // that doesn't exist on the new product at all.
    rerender(<ProductGallery images={otherProductImages} productName="Other" selectedColor="Blue" />);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Other product');
  });
});
