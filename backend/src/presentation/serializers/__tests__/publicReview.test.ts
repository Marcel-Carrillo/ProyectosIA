import { Review } from '../../../domain/models/review';
import { serializePublicReview, serializeOwnReview } from '../publicReview';

const makeReview = () =>
  new Review({
    id: 1,
    productId: 10,
    customerId: 42,
    customerOrderItemId: 7,
    rating: 5,
    title: 'Great',
    body: 'Loved it',
    authorNameSnapshot: 'María C.',
    status: 'Approved',
    moderatedByAdminUserId: 3,
    moderationNote: 'internal note — never expose this',
    moderatedAt: new Date('2026-05-01'),
    publishedAt: new Date('2026-05-01'),
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-05-01'),
  });

describe('serializePublicReview', () => {
  it('exposes only the customer-safe allow-list of fields', () => {
    const dto = serializePublicReview(makeReview());
    expect(Object.keys(dto).sort()).toEqual(
      ['authorNameSnapshot', 'body', 'createdAt', 'id', 'productId', 'rating', 'title'].sort(),
    );
  });

  it('never emits customerId, moderationNote, moderatedByAdminUserId, or status, even if present on the entity', () => {
    const dto = serializePublicReview(makeReview());
    const json = JSON.stringify(dto);
    expect(json).not.toContain('customerId');
    expect(json).not.toContain('moderationNote');
    expect(json).not.toContain('moderatedByAdminUserId');
    expect(json).not.toContain('"status"');
    expect(json).not.toContain('internal note');
  });
});

describe('serializeOwnReview', () => {
  it('includes status but still excludes moderationNote/moderatedByAdminUserId/customerId', () => {
    const dto = serializeOwnReview(makeReview());
    expect(dto.status).toBe('Approved');
    const json = JSON.stringify(dto);
    expect(json).not.toContain('customerId');
    expect(json).not.toContain('moderationNote');
    expect(json).not.toContain('moderatedByAdminUserId');
    expect(json).not.toContain('internal note');
  });
});
