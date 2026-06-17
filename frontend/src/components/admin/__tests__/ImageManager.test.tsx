import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImageManager from '../ImageManager';
import { ProductImage } from '../../../types/product';

jest.mock('../../../services/adminProductService');
import { adminProductService } from '../../../services/adminProductService';
const mocked = adminProductService as jest.Mocked<typeof adminProductService>;

const image: ProductImage = {
  id: 3,
  productId: 1,
  url: 'https://img/main.jpg',
  altText: 'main',
  sortOrder: 0,
  createdAt: '',
};

beforeEach(() => jest.clearAllMocks());

describe('ImageManager', () => {
  it('renders image cards and disables "Set as main" for the current main image', () => {
    render(
      <ImageManager
        productId={1}
        images={[image]}
        mainImageUrl="https://img/main.jpg"
        onImagesChange={jest.fn()}
        onMainImageChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId('image-card-3')).toBeInTheDocument();
    expect(screen.getByTestId('btn-set-main-3')).toBeDisabled();
  });

  it('adds an image via the service', async () => {
    mocked.addImage.mockResolvedValue({ success: true, data: image, message: '' });
    const onImagesChange = jest.fn();
    render(
      <ImageManager
        productId={1}
        images={[]}
        mainImageUrl={null}
        onImagesChange={onImagesChange}
        onMainImageChange={jest.fn()}
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
