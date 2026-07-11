import { vi, type Mocked } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImageManager from '../ImageManager';
import { ProductImage } from '../../../types/product';
import { adminProductService } from '../../../services/adminProductService';

vi.mock('../../../services/adminProductService');
const mocked = adminProductService as Mocked<typeof adminProductService>;

const image: ProductImage = {
  id: 3,
  productId: 1,
  url: 'https://img/main.jpg',
  altText: 'main',
  sortOrder: 0,
  createdAt: '',
};

beforeEach(() => vi.clearAllMocks());

describe('ImageManager', () => {
  it('renders image cards and disables "Set as main" for the current main image', () => {
    render(
      <ImageManager
        productId={1}
        images={[image]}
        mainImageUrl="https://img/main.jpg"
        onImagesChange={vi.fn()}
        onMainImageChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('image-card-3')).toBeInTheDocument();
    expect(screen.getByTestId('btn-set-main-3')).toBeDisabled();
  });

  it('adds an image via the service', async () => {
    mocked.addImage.mockResolvedValue({ success: true, data: image, message: '' });
    const onImagesChange = vi.fn();
    render(
      <ImageManager
        productId={1}
        images={[]}
        mainImageUrl={null}
        onImagesChange={onImagesChange}
        onMainImageChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('input-image-url'), { target: { value: 'https://img/new.jpg' } });
    fireEvent.click(screen.getByTestId('btn-add-image'));
    await waitFor(() =>
      expect(mocked.addImage).toHaveBeenCalledWith(1, expect.objectContaining({ url: 'https://img/new.jpg' })),
    );
    expect(onImagesChange).toHaveBeenCalled();
  });
});
