import { ReviewService } from './reviewService';
import { IReviewRepository } from '../../domain/repositories/reviewRepository';
import { ICustomerRepository } from '../../domain/repositories/customerRepository';
import { Review } from '../../domain/models/review';
import { Customer } from '../../domain/models/customer';
import { ValidationError } from '../validator';
import {
  ReviewPurchaseNotVerifiedError,
  ReviewNotFoundError,
  ReviewTransitionInvalidError,
} from '../../infrastructure/repositories/reviewRepository';
import { CustomerNotFoundError } from '../../infrastructure/repositories/customerRepository';

jest.mock('../../infrastructure/prismaClient', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma: mockPrisma } = jest.requireMock('../../infrastructure/prismaClient');

const mockReviewRepo: jest.Mocked<IReviewRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findApprovedByProductId: jest.fn(),
  findByCustomerId: jest.fn(),
  findPendingQueue: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
  hasVerifiedPurchase: jest.fn(),
  hasExistingReview: jest.fn(),
  getApprovedSummary: jest.fn(),
};

const mockCustomerRepo: jest.Mocked<ICustomerRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  countOrders: jest.fn(),
  delete: jest.fn(),
  findAddressesByCustomerId: jest.fn(),
  findAddressById: jest.fn(),
  createAddress: jest.fn(),
  updateAddress: jest.fn(),
  deleteAddress: jest.fn(),
};

const service = new ReviewService(mockReviewRepo, mockCustomerRepo);

const makeCustomer = (overrides: Partial<ConstructorParameters<typeof Customer>[0]> = {}) =>
  new Customer({ id: 1, firstName: 'María', lastName: 'Carrillo', email: 'maria@test.com', ...overrides });

const makeReview = (overrides: Partial<ConstructorParameters<typeof Review>[0]> = {}) =>
  new Review({
    id: 1,
    productId: 10,
    customerId: 1,
    rating: 5,
    authorNameSnapshot: 'María C.',
    status: 'Pending',
    ...overrides,
  });

beforeEach(() => jest.clearAllMocks());

describe('ReviewService - submitReview', () => {
  it('should create review as Pending when buyer is eligible and data is valid', async () => {
    mockReviewRepo.hasVerifiedPurchase.mockResolvedValue({ verified: true, customerOrderItemId: 7 });
    mockCustomerRepo.findById.mockResolvedValue(makeCustomer());
    const created = makeReview();
    mockReviewRepo.create.mockResolvedValue(created);

    const result = await service.submitReview(1, { productId: 10, rating: 5, title: 'Great', body: 'Loved it' });

    expect(mockReviewRepo.create).toHaveBeenCalledWith({
      productId: 10,
      customerId: 1,
      customerOrderItemId: 7,
      rating: 5,
      title: 'Great',
      body: 'Loved it',
      authorNameSnapshot: 'María C.',
    });
    expect(result).toEqual(created);
  });

  it('should build authorNameSnapshot from firstName + last-initial', async () => {
    mockReviewRepo.hasVerifiedPurchase.mockResolvedValue({ verified: true, customerOrderItemId: 7 });
    mockCustomerRepo.findById.mockResolvedValue(makeCustomer({ firstName: 'María', lastName: 'Carrillo' }));
    mockReviewRepo.create.mockResolvedValue(makeReview());

    await service.submitReview(1, { productId: 10, rating: 5 });

    expect(mockReviewRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ authorNameSnapshot: 'María C.' }),
    );
  });

  it('should throw ReviewPurchaseNotVerifiedError when customer has no paid order containing the product', async () => {
    mockReviewRepo.hasVerifiedPurchase.mockResolvedValue({ verified: false, customerOrderItemId: null });

    await expect(service.submitReview(1, { productId: 10, rating: 5 })).rejects.toBeInstanceOf(
      ReviewPurchaseNotVerifiedError,
    );
    expect(mockReviewRepo.create).not.toHaveBeenCalled();
  });

  it('should propagate ReviewAlreadyExistsError from repo.create on duplicate', async () => {
    mockReviewRepo.hasVerifiedPurchase.mockResolvedValue({ verified: true, customerOrderItemId: 7 });
    mockCustomerRepo.findById.mockResolvedValue(makeCustomer());
    const { ReviewAlreadyExistsError } = jest.requireActual('../../infrastructure/repositories/reviewRepository');
    mockReviewRepo.create.mockRejectedValue(new ReviewAlreadyExistsError());

    await expect(service.submitReview(1, { productId: 10, rating: 5 })).rejects.toBeInstanceOf(
      ReviewAlreadyExistsError,
    );
  });

  it('should throw ValidationError when rating is 0', async () => {
    await expect(service.submitReview(1, { productId: 10, rating: 0 })).rejects.toBeInstanceOf(ValidationError);
    expect(mockReviewRepo.hasVerifiedPurchase).not.toHaveBeenCalled();
  });

  it('should throw ValidationError when rating is 6', async () => {
    await expect(service.submitReview(1, { productId: 10, rating: 6 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw ValidationError when rating is not an integer', async () => {
    await expect(service.submitReview(1, { productId: 10, rating: 3.5 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('should accept a review with only rating, no title or body', async () => {
    mockReviewRepo.hasVerifiedPurchase.mockResolvedValue({ verified: true, customerOrderItemId: 7 });
    mockCustomerRepo.findById.mockResolvedValue(makeCustomer());
    mockReviewRepo.create.mockResolvedValue(makeReview());

    await service.submitReview(1, { productId: 10, rating: 5 });

    expect(mockReviewRepo.create).toHaveBeenCalledWith(expect.objectContaining({ title: null, body: null }));
  });

  it('should throw ValidationError when title exceeds 150 characters', async () => {
    await expect(
      service.submitReview(1, { productId: 10, rating: 5, title: 'x'.repeat(151) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw ValidationError when body exceeds 2000 characters', async () => {
    await expect(
      service.submitReview(1, { productId: 10, rating: 5, body: 'x'.repeat(2001) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw CustomerNotFoundError when the authenticated customer record is missing', async () => {
    mockReviewRepo.hasVerifiedPurchase.mockResolvedValue({ verified: true, customerOrderItemId: 7 });
    mockCustomerRepo.findById.mockResolvedValue(null);

    await expect(service.submitReview(1, { productId: 10, rating: 5 })).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
  });
});

describe('ReviewService - checkEligibility', () => {
  it('should return canReview:true, reason:eligible for a verified buyer with no existing review', async () => {
    mockReviewRepo.hasExistingReview.mockResolvedValue(false);
    mockReviewRepo.hasVerifiedPurchase.mockResolvedValue({ verified: true, customerOrderItemId: 7 });

    const result = await service.checkEligibility(1, 10);

    expect(result).toEqual({ canReview: true, reason: 'eligible' });
  });

  it('should return canReview:false, reason:not_purchased for a non-buyer', async () => {
    mockReviewRepo.hasExistingReview.mockResolvedValue(false);
    mockReviewRepo.hasVerifiedPurchase.mockResolvedValue({ verified: false, customerOrderItemId: null });

    const result = await service.checkEligibility(1, 10);

    expect(result).toEqual({ canReview: false, reason: 'not_purchased' });
  });

  it('should return canReview:false, reason:already_reviewed when the customer already has a review', async () => {
    mockReviewRepo.hasExistingReview.mockResolvedValue(true);

    const result = await service.checkEligibility(1, 10);

    expect(result).toEqual({ canReview: false, reason: 'already_reviewed' });
    expect(mockReviewRepo.hasVerifiedPurchase).not.toHaveBeenCalled();
  });
});

describe('ReviewService - listApprovedForProduct / listOwnReviews / getSummaryForProduct / listModerationQueue', () => {
  it('listApprovedForProduct passes productId/page/limit to repo', async () => {
    mockReviewRepo.findApprovedByProductId.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
    await service.listApprovedForProduct(10, 2, 5);
    expect(mockReviewRepo.findApprovedByProductId).toHaveBeenCalledWith(10, 2, 5);
  });

  it('listOwnReviews passes customerId/page/limit to repo', async () => {
    mockReviewRepo.findByCustomerId.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    await service.listOwnReviews(1, 1, 20);
    expect(mockReviewRepo.findByCustomerId).toHaveBeenCalledWith(1, 1, 20);
  });

  it('getSummaryForProduct passes productId to repo', async () => {
    mockReviewRepo.getApprovedSummary.mockResolvedValue({
      averageRating: null,
      reviewCount: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
    await service.getSummaryForProduct(10);
    expect(mockReviewRepo.getApprovedSummary).toHaveBeenCalledWith(10);
  });

  it('listModerationQueue passes filters to repo', async () => {
    mockReviewRepo.findPendingQueue.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    await service.listModerationQueue({ status: 'Pending' });
    expect(mockReviewRepo.findPendingQueue).toHaveBeenCalledWith({ status: 'Pending' });
  });
});

describe('ReviewService - moderateReview', () => {
  const mockTx = { review: { findUnique: jest.fn(), update: jest.fn() } };

  beforeEach(() => {
    mockTx.review.findUnique.mockReset();
    mockTx.review.update.mockReset();
    (mockPrisma.$transaction as jest.Mock).mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx));
  });

  it('should set status Approved, publishedAt, moderatedAt, moderatedByAdminUserId on Pending -> Approved', async () => {
    mockTx.review.findUnique.mockResolvedValue({ id: 1, status: 'Pending' });
    mockTx.review.update.mockResolvedValue({ ...makeReview(), status: 'Approved' });

    await service.moderateReview(1, 99, { status: 'Approved' });

    expect(mockTx.review.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'Approved',
        moderatedByAdminUserId: 99,
        moderatedAt: expect.any(Date),
        publishedAt: expect.any(Date),
      }),
    });
  });

  it('should set status Rejected, moderatedAt, moderatedByAdminUserId and leave publishedAt null on Pending -> Rejected', async () => {
    mockTx.review.findUnique.mockResolvedValue({ id: 1, status: 'Pending' });
    mockTx.review.update.mockResolvedValue({ ...makeReview(), status: 'Rejected' });

    await service.moderateReview(1, 99, { status: 'Rejected' });

    const callArg = mockTx.review.update.mock.calls[0][0];
    expect(callArg.data.status).toBe('Rejected');
    expect(callArg.data.moderatedByAdminUserId).toBe(99);
    expect(callArg.data).not.toHaveProperty('publishedAt');
  });

  it('should throw ReviewNotFoundError when the review id does not exist', async () => {
    mockTx.review.findUnique.mockResolvedValue(null);

    await expect(service.moderateReview(999, 99, { status: 'Approved' })).rejects.toBeInstanceOf(
      ReviewNotFoundError,
    );
  });

  it('should throw ReviewTransitionInvalidError when re-approving an already-Approved review', async () => {
    mockTx.review.findUnique.mockResolvedValue({ id: 1, status: 'Approved' });

    await expect(service.moderateReview(1, 99, { status: 'Approved' })).rejects.toBeInstanceOf(
      ReviewTransitionInvalidError,
    );
  });

  it('should throw ReviewTransitionInvalidError when re-moderating an already-Rejected review', async () => {
    mockTx.review.findUnique.mockResolvedValue({ id: 1, status: 'Rejected' });

    await expect(service.moderateReview(1, 99, { status: 'Approved' })).rejects.toBeInstanceOf(
      ReviewTransitionInvalidError,
    );
  });

  it('should throw ValidationError when status is not Approved or Rejected', async () => {
    await expect(service.moderateReview(1, 99, { status: 'Pending' })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('ReviewService - deleteReview', () => {
  it('should delete an existing review', async () => {
    mockReviewRepo.delete.mockResolvedValue(undefined);
    await service.deleteReview(1);
    expect(mockReviewRepo.delete).toHaveBeenCalledWith(1);
  });

  it('should propagate ReviewNotFoundError when review does not exist', async () => {
    mockReviewRepo.delete.mockRejectedValue(new ReviewNotFoundError());
    await expect(service.deleteReview(999)).rejects.toBeInstanceOf(ReviewNotFoundError);
  });
});
