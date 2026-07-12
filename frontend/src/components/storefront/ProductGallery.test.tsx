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

describe('ProductGallery color filtering', () => {
  it('filters to images matching the selected color plus shared (color=null) images', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByAltText('Blue detail 1')).not.toBeInTheDocument();
  });

  it('shows the selected colors own photo as the main image, not the shared photo', () => {
    // Regression: the main/hero image must reflect the color the shopper
    // picked. The shared image is sortOrder 0 and always survives the
    // filter, so naively defaulting to index 0 leaves the hero image stuck
    // on the generic shot — only the thumbnail strip would visibly react.
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);

    const main = screen.getAllByRole('img')[0];
    expect(main).toHaveAttribute('alt', 'Red detail 1');
    expect(main).toHaveAttribute('src', 'https://cdn.example.com/red-1.jpg');
  });

  it('falls back to the full image list when the filtered set would be empty', () => {
    const noSharedImages = colorImages.filter((img) => img.color !== null);
    render(<ProductGallery images={noSharedImages} productName="Dress" selectedColor="Green" />);

    const list = within(screen.getByRole('list'));
    expect(list.getAllByRole('listitem')).toHaveLength(3);
    expect(list.getByAltText('Red detail 1')).toBeInTheDocument();
    expect(list.getByAltText('Red detail 2')).toBeInTheDocument();
    expect(list.getByAltText('Blue detail 1')).toBeInTheDocument();
  });

  it('renders the full list unchanged when selectedColor is not provided', () => {
    render(<ProductGallery images={colorImages} productName="Dress" />);

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders the full list unchanged when selectedColor is explicitly null', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor={null} />);

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
  });

  it('resets the active image to the new colors own photo when selectedColor changes', () => {
    const { rerender } = render(
      <ProductGallery images={colorImages} productName="Dress" selectedColor="Blue" />
    );

    // Filtered to Blue: shared (id:10, index 0) + Blue (id:13, index 1) —
    // but the main image defaults to Blue's own photo (index 1), not shared.
    const thumbs = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(thumbs).toHaveLength(2);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue detail 1');

    // Manually pick the shared thumbnail instead, to prove the reset below
    // isn't a no-op.
    fireEvent.click(thumbs[0]!);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Shared front');

    rerender(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);

    // Reset to Red's own photo (first Red image, sortOrder 1), not the
    // shared image and not wherever the previous color's manual pick left it.
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Red detail 1');
  });

  it('defaults to the shared image when the selected color has no dedicated photo', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Green" />);

    // Green has no dedicated image; colorFiltered = [shared] (non-empty, so
    // no full-list fallback) — main image is the shared photo.
    const main = screen.getAllByRole('img')[0];
    expect(main).toHaveAttribute('alt', 'Shared front');
  });
});
