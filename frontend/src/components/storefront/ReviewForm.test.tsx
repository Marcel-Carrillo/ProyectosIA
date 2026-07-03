import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewForm from './ReviewForm';
import { reviewService } from '../../services/reviewService';

const mockUseCustomerAuth = jest.fn();

jest.mock('../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => mockUseCustomerAuth(),
}));

jest.mock('../../services/reviewService', () => ({
  reviewService: {
    getEligibility: jest.fn(),
    submitReview: jest.fn(),
  },
  extractReviewErrorMessage: jest.requireActual('../../services/reviewService').extractReviewErrorMessage,
}));

const mockedReviewService = reviewService as jest.Mocked<typeof reviewService>;

const renderForm = () => render(<MemoryRouter><ReviewForm productId={1} /></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ReviewForm', () => {
  it('prompts login when not authenticated', async () => {
    mockUseCustomerAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderForm();
    expect(await screen.findByTestId('review-form-login-required')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('shows loading while eligibility is being fetched', async () => {
    mockUseCustomerAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockedReviewService.getEligibility.mockReturnValue(new Promise(() => {}));
    renderForm();
    expect(await screen.findByTestId('review-form-eligibility-loading')).toBeInTheDocument();
  });

  it('shows already-reviewed state', async () => {
    mockUseCustomerAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockedReviewService.getEligibility.mockResolvedValue({ canReview: false, reason: 'already_reviewed' });
    renderForm();
    expect(await screen.findByTestId('review-already-submitted')).toBeInTheDocument();
  });

  it('shows purchase-required state', async () => {
    mockUseCustomerAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockedReviewService.getEligibility.mockResolvedValue({ canReview: false, reason: 'not_purchased' });
    renderForm();
    expect(await screen.findByTestId('review-purchase-required')).toBeInTheDocument();
  });

  it('renders the form when eligible', async () => {
    mockUseCustomerAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockedReviewService.getEligibility.mockResolvedValue({ canReview: true, reason: 'eligible' });
    renderForm();
    expect(await screen.findByTestId('review-form')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /star/i })).toHaveLength(5);
  });

  it('blocks submit with a validation error when no star is selected', async () => {
    mockUseCustomerAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockedReviewService.getEligibility.mockResolvedValue({ canReview: true, reason: 'eligible' });
    renderForm();
    await screen.findByTestId('review-form');
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please select a star rating.');
    expect(mockedReviewService.submitReview).not.toHaveBeenCalled();
  });

  it('submits successfully and shows the pending-moderation confirmation', async () => {
    mockUseCustomerAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockedReviewService.getEligibility.mockResolvedValue({ canReview: true, reason: 'eligible' });
    mockedReviewService.submitReview.mockResolvedValue({
      id: 1,
      productId: 1,
      rating: 4,
      title: 'Nice',
      body: 'Good fit',
      authorNameSnapshot: 'Test User',
      createdAt: '2026-05-01T00:00:00Z',
      status: 'Pending',
    });
    renderForm();
    await screen.findByTestId('review-form');
    fireEvent.click(screen.getByLabelText('4 stars'));
    fireEvent.change(screen.getByLabelText('Title (optional)'), { target: { value: 'Nice' } });
    fireEvent.change(screen.getByLabelText('Review (optional)'), { target: { value: 'Good fit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByTestId('review-submitted')).toBeInTheDocument();
    expect(mockedReviewService.submitReview).toHaveBeenCalledWith({
      productId: 1,
      rating: 4,
      title: 'Nice',
      body: 'Good fit',
    });
  });

  it('shows a mapped error message when submission fails', async () => {
    mockUseCustomerAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockedReviewService.getEligibility.mockResolvedValue({ canReview: true, reason: 'eligible' });
    mockedReviewService.submitReview.mockRejectedValue({
      response: { data: { error: { code: 'REVIEW_ALREADY_EXISTS' } } },
    });
    renderForm();
    await screen.findByTestId('review-form');
    fireEvent.click(screen.getByLabelText('3 stars'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You have already reviewed this product.');
    expect(screen.getByTestId('review-form')).toBeInTheDocument();
  });
});
