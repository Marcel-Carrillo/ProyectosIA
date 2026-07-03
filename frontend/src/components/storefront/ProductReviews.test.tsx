import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../test-utils/renderWithI18n';
import ProductReviews from './ProductReviews';
import { Review } from '../../types/product';

const baseReview: Review = {
  id: 1,
  productId: 1,
  rating: 5,
  title: 'Great',
  body: 'Loved it',
  authorNameSnapshot: 'María C.',
  createdAt: '2026-05-01T00:00:00Z',
};

const defaultProps = {
  summary: { averageRating: null, reviewCount: 0 },
  distribution: null,
  reviews: [] as Review[],
  isLoading: false,
  error: null,
  page: 1,
  totalPages: 1,
  onPageChange: jest.fn(),
};

describe('ProductReviews', () => {
  it('renders empty state when reviewCount is 0', async () => {
    renderWithI18n(<ProductReviews {...defaultProps} />);
    expect(await screen.findByTestId('reviews-empty-state')).toBeInTheDocument();
  });

  it('renders average rating, distribution and review list when reviews exist', async () => {
    const secondReview: Review = { ...baseReview, id: 2, rating: 4, authorNameSnapshot: 'Ana G.', body: 'Nice fit' };
    renderWithI18n(
      <ProductReviews
        {...defaultProps}
        summary={{ averageRating: 4.5, reviewCount: 2 }}
        distribution={{ 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 }}
        reviews={[baseReview, secondReview]}
      />,
    );
    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('María C.')).toBeInTheDocument();
    expect(screen.getByText('Ana G.')).toBeInTheDocument();
    expect(screen.getByText('Loved it')).toBeInTheDocument();
    expect(screen.getByLabelText('Rating: 4.5 out of 5')).toBeInTheDocument();
  });

  it('renders loading state and suppresses summary/list even when reviewCount > 0', async () => {
    renderWithI18n(
      <ProductReviews
        {...defaultProps}
        isLoading
        summary={{ averageRating: 4.5, reviewCount: 2 }}
        reviews={[baseReview]}
      />,
    );
    expect(await screen.findByTestId('reviews-loading')).toBeInTheDocument();
    expect(screen.queryByText('María C.')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reviews-empty-state')).not.toBeInTheDocument();
  });

  it('renders error alert and suppresses list/empty state', async () => {
    renderWithI18n(<ProductReviews {...defaultProps} error="Unable to load reviews. Please try again later." />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load reviews');
    expect(screen.queryByTestId('reviews-empty-state')).not.toBeInTheDocument();
  });

  it('renders pagination and calls onPageChange when totalPages > 1', async () => {
    const onPageChange = jest.fn();
    renderWithI18n(
      <ProductReviews
        {...defaultProps}
        summary={{ averageRating: 5, reviewCount: 1 }}
        reviews={[baseReview]}
        page={1}
        totalPages={3}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(await screen.findByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('does not render pagination when totalPages is 1', async () => {
    renderWithI18n(
      <ProductReviews {...defaultProps} summary={{ averageRating: 5, reviewCount: 1 }} reviews={[baseReview]} />,
    );
    await screen.findByText('María C.');
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
  });
});
