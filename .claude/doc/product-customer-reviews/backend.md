# Backend Implementation Plan — product-customer-reviews

Scope: `openspec/changes/product-customer-reviews/tasks.md` sections **1–6** (schema/migration, domain model, repository interface, repository implementation, service layer with TDD, validation, controllers/routes). Sections 7–15 (frontend, docs, tests-verification, PR) are out of scope for this plan.

Planning-only. No files were created or edited by this plan.

---

## 0. Files read to produce this plan (current state on `feature/product-customer-reviews`, branched from `develop`)

- `backend/prisma/schema.prisma` (full file, 428 lines) — confirmed **no `Review` model exists yet**; confirmed exact current shape of `Product`, `ProductVariant`, `Customer`, `CustomerOrder`, `CustomerOrderItem`, `AdminUser`, `Refund`, `ReturnRequest`.
- `backend/src/domain/models/refund.ts`, `returnRequest.ts`, `customer.ts`, `adminUser.ts`, `product.ts`, `index.ts`
- `backend/src/domain/repositories/refundRepository.ts`, `returnRequestRepository.ts`, `customerRepository.ts`, `index.ts`
- `backend/src/infrastructure/repositories/refundRepository.ts`, `customerRepository.ts`, `productVariantRepository.ts`, `customerOrderRepository.ts` (P2002 handling at line 289)
- `backend/src/application/services/refundService.ts`, `returnRequestService.ts`, `categoryService.test.ts` (TDD style reference — no `refundService.test.ts`/`productService.test.ts` currently exist in the repo), `checkoutService.ts`, `wishlistCouponService.ts`
- `backend/src/application/validator.ts` (full file, 862 lines)
- `backend/src/presentation/controllers/refundController.ts`, `returnRequestController.ts`, `categoryController.test.ts` (controller unit-test style), `wishlistController.ts`, `customerAccountController.ts`, `productController.ts` (admin), `publicProductController.ts`
- `backend/src/presentation/serializers/publicProduct.ts`
- `backend/src/middleware/requireCustomerAuth.ts`, `requireAdminAuth.ts`, `errorHandler.ts`
- `backend/src/routes/public/accountRoutes.ts`, `productRoutes.ts`, `__tests__/supplierIsolation.test.ts`
- `backend/src/routes/admin/refundRoutes.ts`, `returnRequestRoutes.ts`, `__tests__/customerOrderIsolation.test.ts`, `__tests__/adminAuthRoutes.test.ts`
- `backend/src/routes/index.ts`, `backend/src/index.ts` (route registration entrypoint)
- `backend/src/test-utils/adminAuthHelper.ts`
- `docs/backend-standards.md` (full file — DDD conventions, ESLint/CI rules, testing standards, auth conventions)
- `openspec/changes/product-customer-reviews/design.md`, `specs/product-reviews/spec.md`, `tasks.md`
- `.claude/sessions/context_session_product-customer-reviews.md`

Key confirmed facts:
- `Product.id`/`ProductVariant.productId`/`CustomerOrderItem.productVariantId`/`CustomerOrder.customerId`+`paymentStatus` are all present today exactly as the design doc assumes — the purchase-verification query needs no schema changes beyond adding `Review`.
- `Customer` has `firstName`/`lastName`/`email` (no display-name field) — `authorNameSnapshot` must be built in the service from `firstName` + `lastName` initial.
- The **only existing precedent test file per layer** is `categoryService.test.ts` (service) and `categoryController.test.ts` (controller) — no `refundService.test.ts` exists despite `Refund` being the closest business-logic analog. This plan's TDD test list for `reviewService.test.ts` follows `categoryService.test.ts`'s structure (`describe('ClassName - methodName')`, `mockRepo: jest.Mocked<Interface>`, `jest.clearAllMocks()` in `beforeEach`).
- `Refund`/`ReturnRequest` services **bypass their injected repository for `create`/`updateStatus`** and use `prisma.$transaction(...)` directly inside the service (see `refundService.ts` lines 54–107, 115–213; `returnRequestService.ts` lines 48–79, 86–115) even though a `IRefundRepository`/`IReturnRequestRepository` is injected in the constructor. This is an established-but-imperfect convention. This plan **partially follows it and partially deviates** — see Design Note 1 below for the reasoning.

---

## Design Notes / Gaps to flag explicitly (read before implementing)

**Design Note 1 — `submitReview` does NOT need a `prisma.$transaction`, unlike `Refund`/`ReturnRequest`'s create methods.**
`RefundService.create` and `ReturnRequestService.create` wrap their read-then-write logic in `prisma.$transaction` because they need to read-and-reason about mutable, concurrently-writable state (refundable balance, order cancellation) in the same atomic unit as the write. `Review` is different: the DB-level `@@unique([customerId, productId])` constraint (task 1.2) is *already* the race-safety mechanism the design doc explicitly calls for ("enforced at the database level ... so a race condition can't create duplicates" — design.md Decisions). The purchase-verification read (`hasVerifiedPurchase`) reads immutable-at-submission-time data (a `Paid` order that already exists) — there is no meaningful race between "check eligibility" and "insert row" that the unique constraint doesn't already close. **Recommendation: keep `submitReview` as plain sequential repository calls (no `$transaction`), and let `ReviewRepository.create()` catch `P2002` and throw `ReviewAlreadyExistsError`.** This is simpler and still fully correct. `approveReview`/`rejectReview` (moderation), by contrast, **do** need a `prisma.$transaction` (read current status, validate transition, write) because two concurrent admin actions on the same review is a real race the DB constraint doesn't cover — this part *does* mirror `ReturnRequestService.updateStatus` exactly.

**Design Note 2 — tension between tasks.md 5.1 ("no HTML allowed") and design.md's XSS decision + task 9.2's required test case.**
Tasks.md 5.1 says the validator should enforce "no HTML allowed (plain text only)". But design.md's XSS/JSON-LD safety decision says review `title`/`body` are "stored as plain text ... rendered through the same `<script>`-escaping mechanism already used in `Seo.tsx`", and task 9.2 explicitly requires "a test asserting a review body containing `</script>` and `<` characters renders safely" — i.e. the frontend test *expects* a body containing literal `<` to be **accepted, stored, and safely escaped at render time**, not rejected at the API boundary. If the backend validator rejected any `<`/`>` character, task 9.2's premise (a real approved review containing `</script>`) could never exist. **Resolution used in this plan: "no HTML allowed" is interpreted as "never parsed/rendered as markup" (satisfied entirely by output-side escaping, which already exists in `Seo.tsx` and needs no backend change), not as an input-side character blacklist.** `validateReviewData` therefore caps length and rejects only genuine control characters (null bytes, etc.) — it does **not** reject `<`, `>`, or other ordinary punctuation. Flagging this because a literal reading of task 5.1 in isolation would break task 9.2; if the user wants strict HTML-tag rejection instead, that's a one-line regex change but it would need task 9.2's test scenario adjusted too (can't have both).

**Design Note 3 — task session's "productController.ts" reference is ambiguous; the correct file is `publicProductController.ts`.**
The context session says: "the exact `publicProduct.ts`/`productController.ts` edit to add `reviewSummary`". There are two controllers touching products: `productController.ts` (admin, `/api/admin/products`, returns the raw domain `Product` with **no serializer** — see `productController.ts` lines 47–56) and `publicProductController.ts` (public, `/api/public/products`, the one that actually calls `serializePublicProduct`). Since `reviewSummary` is a **customer-facing, Approved-only** field and the spec requires it on `GET /api/public/products/:id`, the edit belongs in **`publicProductController.ts`** only. The admin product controller is untouched (admins can see full review data through the separate `/api/admin/reviews` endpoint instead).

**Design Note 4 — `reviewSummary` is added to `GET /api/public/products/:id` (detail) only, not `GET /api/public/products` (list).**
Task 6.2 only mentions the detail endpoint, and design.md's rationale ("so the PDP has everything needed... at first render") is PDP-specific. Adding a `getSummaryForProduct` aggregate query per item to `listPublicProducts` would turn a single list query into N+1 aggregate queries. This plan intentionally leaves `listPublicProducts`/`serializePublicProduct`'s list-call-site unchanged and only wires the summary into `getPublicProductById`. `PublicProductDTO.reviewSummary` stays `undefined` (omitted, since the DTO field is optional) for list-endpoint items.

**Design Note 5 — pre-existing gap, not introduced by this change:** `ProductService.update()` (`backend/src/application/services/productService.ts` lines 83–120) still never calls `validateProductData` on the incoming `data` (only `create()` does, line 40). This is unrelated to reviews and out of this change's scope, but is called out per the same standard raised during `product-gtin-identifier` planning — not fixed here, just flagged so it isn't mistaken for something this change was supposed to touch.

**Design Note 6 — admin review-route auth-gating tests need the middleware mounted explicitly, unlike `accountRoutes.ts`.**
`accountRoutes.ts` calls `router.use(requireCustomerAuth)` **inside the router file itself** (line 29), so importing `accountPublicRoutes` directly in a test exercises real 401 gating for free. Admin routers (`refundRoutes.ts`, `returnRequestRoutes.ts`, and the new `reviewRoutes.ts`) do **not** embed `requireAdminAuth` — it's applied once, centrally, in `backend/src/index.ts` (`adminRouter.use(requireAdminAuth)` at line 104, before all admin sub-routers are mounted). A test that imports `reviewAdminRoutes` in isolation without also mounting `requireAdminAuth` in front of it will **never** see a 401 — see task 6.5 test plan below for the exact composition needed.

---

## 1. Prisma Schema and Migration

### 1.1–1.3 Add to `backend/prisma/schema.prisma`

Insert after the `ReturnRequest` model (after line 290, before `model AdminUser {` at line 292) — keeps it near its closest sibling (`Refund`/`ReturnRequest`) rather than at the end of the file:

```prisma
model Review {
  id                     Int                @id @default(autoincrement())
  productId              Int
  product                Product            @relation(fields: [productId], references: [id])
  customerId             Int
  customer               Customer           @relation(fields: [customerId], references: [id])
  customerOrderItemId    Int?
  customerOrderItem      CustomerOrderItem? @relation(fields: [customerOrderItemId], references: [id])
  rating                 Int
  title                  String?            @db.VarChar(150)
  body                   String?            @db.VarChar(2000)
  authorNameSnapshot     String             @db.VarChar(100)
  status                 String             @default("Pending") @db.VarChar(20)
  moderatedByAdminUserId Int?
  moderatedByAdminUser   AdminUser?         @relation(fields: [moderatedByAdminUserId], references: [id])
  moderationNote         String?            @db.VarChar(500)
  moderatedAt            DateTime?
  publishedAt            DateTime?
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  @@unique([customerId, productId])
  @@index([productId, status])
  @@index([status])
  @@index([customerId])
  @@index([createdAt])
}
```

Notes on field choices:
- `customerOrderItemId` is **nullable** per tasks.md 1.1 (eligibility proof only, never displayed as "the reviewed variant" per design.md). Made nullable rather than required so that if the referenced `CustomerOrderItem` is ever hard-deleted (it currently never is, but no `onDelete` cascade exists on `CustomerOrderItem` either), the review row survives — deliberately **no** `onDelete: Cascade` on this relation, matching `SupplierOrderItem.customerOrderItem` which also has no cascade.
- `rating Int` (not an enum) — matches the plain-`Int` style used nowhere else in the schema for a bounded value, but `Int` is correct here since 1–5 is an application-level, not DB-level, constraint (consistent with how `quantity`, `sortOrder` etc. are unconstrained `Int` at the DB layer and validated in `validator.ts`).
- `status String @default("Pending") @db.VarChar(20)` — exact mirror of `Refund.status` (line 237) and `ReturnRequest.status` (line 277).
- No `@db.VarChar` on `authorNameSnapshot` beyond 100 — matches `Customer.firstName`/`lastName` each being `@db.VarChar(100)`, and the snapshot format (`"María C."`) is always shorter than either field alone.

### 1.3 Back-relations — add to existing models

In `model Product` (after line 58, alongside `translations`):
```prisma
  reviews      Review[]
```

In `model Customer` (after line 104, alongside `account`):
```prisma
  reviews        Review[]
```

In `model CustomerOrderItem` (after line 177, alongside `returnRequests`) — needed because `Review.customerOrderItem` is a relation field, Prisma requires the back-relation even though tasks.md 1.3 doesn't mention it explicitly:
```prisma
  reviews             Review[]
```

In `model AdminUser` (after line 299, alongside `refreshTokens`) — needed for `Review.moderatedByAdminUser`, same reason:
```prisma
  moderatedReviews Review[]
```

### 1.4 Migration command

```bash
cd backend
npx prisma migrate dev --name add_review
```

### 1.5 Verification

`npx prisma migrate dev` output should show only `CREATE TABLE "Review"` + the FK/index/unique-constraint statements — no `ALTER TABLE` on any existing table. Confirm via `npx prisma migrate diff` or by reading the generated migration SQL file under `backend/prisma/migrations/<timestamp>_add_review/migration.sql` before applying, per `docs/backend-standards.md` "Review Migrations before applying".

---

## 2. Domain Model and Repository Contracts

### 2.1 `backend/src/domain/models/review.ts` (new file)

Mirror `refund.ts` exactly (transitions map + class):

```typescript
export type ReviewStatus = 'Pending' | 'Approved' | 'Rejected';

export const REVIEW_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  Pending: ['Approved', 'Rejected'],
  Approved: [],
  Rejected: [],
};

export function isValidReviewTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  return REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

export class Review {
  id?: number;
  productId: number;
  customerId: number;
  customerOrderItemId: number | null;
  rating: number;
  title: string | null;
  body: string | null;
  authorNameSnapshot: string;
  status: ReviewStatus;
  moderatedByAdminUserId: number | null;
  moderationNote: string | null;
  moderatedAt: Date | null;
  publishedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    productId: number;
    customerId: number;
    customerOrderItemId?: number | null;
    rating: number;
    title?: string | null;
    body?: string | null;
    authorNameSnapshot: string;
    status?: string;
    moderatedByAdminUserId?: number | null;
    moderationNote?: string | null;
    moderatedAt?: Date | null;
    publishedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.productId = data.productId;
    this.customerId = data.customerId;
    this.customerOrderItemId = data.customerOrderItemId ?? null;
    this.rating = data.rating;
    this.title = data.title ?? null;
    this.body = data.body ?? null;
    this.authorNameSnapshot = data.authorNameSnapshot;
    this.status = (data.status as ReviewStatus) ?? 'Pending';
    this.moderatedByAdminUserId = data.moderatedByAdminUserId ?? null;
    this.moderationNote = data.moderationNote ?? null;
    this.moderatedAt = data.moderatedAt ?? null;
    this.publishedAt = data.publishedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
```

### 2.2 `backend/src/domain/repositories/reviewRepository.ts` (new file)

```typescript
import { Review, ReviewStatus } from '../models/review';

export interface ReviewListFilters {
  status?: ReviewStatus;
  page?: number;
  limit?: number;
}

export interface ReviewListResult {
  items: Review[];
  total: number;
  page: number;
  limit: number;
}

export interface ReviewCreateData {
  productId: number;
  customerId: number;
  customerOrderItemId: number | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  authorNameSnapshot: string;
}

export interface ReviewStatusUpdateData {
  status: ReviewStatus;
  moderatedByAdminUserId: number;
  moderationNote?: string | null;
}

export interface ReviewPurchaseCheck {
  verified: boolean;
  customerOrderItemId: number | null;
}

export interface ReviewRatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
  distribution: ReviewRatingDistribution;
}

export interface IReviewRepository {
  create(data: ReviewCreateData): Promise<Review>;
  findById(id: number): Promise<Review | null>;
  findApprovedByProductId(productId: number, page?: number, limit?: number): Promise<ReviewListResult>;
  findByCustomerId(customerId: number, page?: number, limit?: number): Promise<ReviewListResult>;
  findPendingQueue(filters: ReviewListFilters): Promise<ReviewListResult>;
  updateStatus(id: number, data: ReviewStatusUpdateData): Promise<Review>;
  delete(id: number): Promise<void>;
  hasVerifiedPurchase(customerId: number, productId: number): Promise<ReviewPurchaseCheck>;
  hasExistingReview(customerId: number, productId: number): Promise<boolean>;
  getApprovedSummary(productId: number): Promise<ReviewSummary>;
}
```

Note on `findPendingQueue`: named per tasks.md 2.2 literally, but implemented as a **general admin list** with an optional `status` filter (task 6.4 needs `GET /api/admin/reviews?status=` to support any status, or no filter at all for an all-statuses admin overview) — when `filters.status` is omitted it returns all statuses; when provided it filters to that one status (typically `Pending` for the moderation queue, but the same method serves `?status=Approved` etc.).

---

## 3. Repository Implementation (Prisma)

### `backend/src/infrastructure/repositories/reviewRepository.ts` (new file)

Error classes (mirrors `refundRepository.ts` lines 12–54 exactly in style):

```typescript
import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { Review } from '../../domain/models/review';
import {
  IReviewRepository,
  ReviewListFilters,
  ReviewListResult,
  ReviewCreateData,
  ReviewStatusUpdateData,
  ReviewPurchaseCheck,
  ReviewSummary,
} from '../../domain/repositories/reviewRepository';

export class ReviewNotFoundError extends Error {
  readonly code = 'REVIEW_NOT_FOUND' as const;
  readonly status = 404;
  constructor() {
    super('Review not found');
    this.name = 'ReviewNotFoundError';
    Object.setPrototypeOf(this, ReviewNotFoundError.prototype);
  }
}

export class ReviewAlreadyExistsError extends Error {
  readonly code = 'REVIEW_ALREADY_EXISTS' as const;
  readonly status = 409;
  constructor() {
    super('You have already submitted a review for this product');
    this.name = 'ReviewAlreadyExistsError';
    Object.setPrototypeOf(this, ReviewAlreadyExistsError.prototype);
  }
}

export class ReviewPurchaseNotVerifiedError extends Error {
  readonly code = 'REVIEW_PURCHASE_NOT_VERIFIED' as const;
  readonly status = 403;
  constructor() {
    super('A verified purchase of this product is required to submit a review');
    this.name = 'ReviewPurchaseNotVerifiedError';
    Object.setPrototypeOf(this, ReviewPurchaseNotVerifiedError.prototype);
  }
}

export class ReviewTransitionInvalidError extends Error {
  readonly code = 'REVIEW_TRANSITION_INVALID' as const;
  readonly status = 409;
  constructor(message = 'Invalid review status transition') {
    super(message);
    this.name = 'ReviewTransitionInvalidError';
    Object.setPrototypeOf(this, ReviewTransitionInvalidError.prototype);
  }
}
```

`reviewSelect` + `mapReview` (mirrors `refundSelect`/`mapRefund`, lines 56–76):

```typescript
const reviewSelect = {
  id: true,
  productId: true,
  customerId: true,
  customerOrderItemId: true,
  rating: true,
  title: true,
  body: true,
  authorNameSnapshot: true,
  status: true,
  moderatedByAdminUserId: true,
  moderationNote: true,
  moderatedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

function mapReview(row: ReviewRow): Review {
  return new Review({ ...row });
}
```

`ReviewRepository` class methods:

```typescript
export class ReviewRepository implements IReviewRepository {
  async create(data: ReviewCreateData): Promise<Review> {
    try {
      const row = await prisma.review.create({
        data: {
          productId: data.productId,
          customerId: data.customerId,
          customerOrderItemId: data.customerOrderItemId,
          rating: data.rating,
          title: data.title ?? null,
          body: data.body ?? null,
          authorNameSnapshot: data.authorNameSnapshot,
          status: 'Pending',
        },
        select: reviewSelect,
      });
      return mapReview(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ReviewAlreadyExistsError();
      }
      throw err;
    }
  }

  async findById(id: number): Promise<Review | null> {
    const row = await prisma.review.findUnique({ where: { id }, select: reviewSelect });
    return row ? mapReview(row) : null;
  }

  async findApprovedByProductId(productId: number, page = 1, limit = 10): Promise<ReviewListResult> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const boundedPage = Math.max(page, 1);
    const skip = (boundedPage - 1) * boundedLimit;

    const where: Prisma.ReviewWhereInput = { productId, status: 'Approved' };
    const [rows, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: boundedLimit,
        select: reviewSelect,
      }),
      prisma.review.count({ where }),
    ]);
    return { items: rows.map(mapReview), total, page: boundedPage, limit: boundedLimit };
  }

  async findByCustomerId(customerId: number, page = 1, limit = 20): Promise<ReviewListResult> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const boundedPage = Math.max(page, 1);
    const skip = (boundedPage - 1) * boundedLimit;

    const where: Prisma.ReviewWhereInput = { customerId };
    const [rows, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: boundedLimit,
        select: reviewSelect,
      }),
      prisma.review.count({ where }),
    ]);
    return { items: rows.map(mapReview), total, page: boundedPage, limit: boundedLimit };
  }

  async findPendingQueue(filters: ReviewListFilters): Promise<ReviewListResult> {
    const page = filters.page && filters.page >= 1 ? filters.page : 1;
    const limit = filters.limit && filters.limit >= 1 ? Math.min(filters.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};
    if (filters.status) where.status = filters.status;

    const [rows, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'asc' }, // oldest-first: moderation queue is FIFO
        skip,
        take: limit,
        select: reviewSelect,
      }),
      prisma.review.count({ where }),
    ]);
    return { items: rows.map(mapReview), total, page, limit };
  }

  async updateStatus(id: number, data: ReviewStatusUpdateData): Promise<Review> {
    // NOTE: transition validity is checked by the SERVICE (inside a $transaction there),
    // not here — mirrors how RefundRepository.updateStatus is a plain field-setter and
    // RefundService.updateStatus owns the transition check. See reviewService.ts.
    try {
      const now = new Date();
      const row = await prisma.review.update({
        where: { id },
        data: {
          status: data.status,
          moderatedByAdminUserId: data.moderatedByAdminUserId,
          moderationNote: data.moderationNote ?? null,
          moderatedAt: now,
          ...(data.status === 'Approved' && { publishedAt: now }),
        },
        select: reviewSelect,
      });
      return mapReview(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ReviewNotFoundError();
      }
      throw err;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await prisma.review.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ReviewNotFoundError();
      }
      throw err;
    }
  }

  async hasVerifiedPurchase(customerId: number, productId: number): Promise<ReviewPurchaseCheck> {
    const item = await prisma.customerOrderItem.findFirst({
      where: {
        productVariant: { productId },
        customerOrder: { customerId, paymentStatus: 'Paid' },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return { verified: !!item, customerOrderItemId: item?.id ?? null };
  }

  async hasExistingReview(customerId: number, productId: number): Promise<boolean> {
    const existing = await prisma.review.findUnique({
      where: { customerId_productId: { customerId, productId } },
      select: { id: true },
    });
    return !!existing;
  }

  async getApprovedSummary(productId: number): Promise<ReviewSummary> {
    const [aggregate, groups] = await prisma.$transaction([
      prisma.review.aggregate({
        where: { productId, status: 'Approved' },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.review.groupBy({
        by: ['rating'],
        where: { productId, status: 'Approved' },
        _count: { rating: true },
      }),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const g of groups) {
      if (g.rating >= 1 && g.rating <= 5) {
        distribution[g.rating as 1 | 2 | 3 | 4 | 5] = g._count.rating;
      }
    }

    return {
      reviewCount: aggregate._count._all,
      averageRating: aggregate._count._all > 0 ? aggregate._avg.rating : null,
      distribution,
    };
  }
}
```

**Task 3.1 note** — the purchase-verification query above uses Prisma's relation-filter shorthand (`productVariant: { productId }`, `customerOrder: { customerId, paymentStatus: 'Paid' }`) instead of a manual multi-`include` join; Prisma compiles this to the equivalent SQL join and it benefits from the existing `CustomerOrderItem.productVariantId`/`customerOrderItemId`/`CustomerOrder.customerId`/`paymentStatus` indexes already in `schema.prisma` (lines 152–158, 179–181) — no new indexes needed on `CustomerOrderItem`/`CustomerOrder` side, matching design.md's Risk mitigation ("reuse existing FK indexes").

**Task 3.2 note** — `_avg.rating` from Prisma's `aggregate` returns a `number | null` already (not a `Decimal`, since `rating` is `Int`) — no `Decimal`-to-`number` conversion needed here, unlike `Refund.amount`/`CustomerOrder.totalAmount`.

**Task 3.3 note** — uniqueness handling lives entirely in `create()`'s `P2002` catch (above), not as a separate up-front `hasExistingReview` check inside `create` — this is intentional per Design Note 1: `hasExistingReview` is a **read-only helper for `checkEligibility`** (so the UI can show "already reviewed" before the user even fills out the form), while the actual write path always relies on the DB constraint as the single source of truth for uniqueness enforcement.

---

## 4. Service Layer (TDD)

### 4.1 Failing tests to write first — `backend/src/application/services/reviewService.test.ts` (new file)

Follow `categoryService.test.ts`'s exact structure: a `jest.Mocked<IReviewRepository>` (+ `jest.Mocked<ICustomerRepository>`), `describe('ReviewService - methodName')` blocks, `beforeEach(() => jest.clearAllMocks())`.

```typescript
import { ReviewService } from './reviewService';
import { IReviewRepository } from '../../domain/repositories/reviewRepository';
import { ICustomerRepository } from '../../domain/repositories/customerRepository';
import { Review } from '../../domain/models/review';
import { Customer } from '../../domain/models/customer';
import { ValidationError } from '../validator';
import {
  ReviewPurchaseNotVerifiedError,
  ReviewAlreadyExistsError,
  ReviewNotFoundError,
  ReviewTransitionInvalidError,
} from '../../infrastructure/repositories/reviewRepository';

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
    id: 1, productId: 10, customerId: 1, rating: 5,
    authorNameSnapshot: 'María C.', status: 'Pending', ...overrides,
  });
```

**`describe('ReviewService - submitReview')`**
- `should create review as Pending when buyer is eligible and data is valid` — `hasVerifiedPurchase` returns `{verified:true, customerOrderItemId:7}`, `mockCustomerRepo.findById` returns `makeCustomer()`, assert `mockReviewRepo.create` called with `{productId, customerId, customerOrderItemId:7, rating, title, body, authorNameSnapshot:'María C.'}` and result equals the repo's returned `Review`.
- `should build authorNameSnapshot from firstName + last-initial` — assert exact string `'María C.'` for `lastName:'Carrillo'`.
- `should throw ReviewPurchaseNotVerifiedError when customer has no paid order containing the product` — `hasVerifiedPurchase` returns `{verified:false, customerOrderItemId:null}`; assert `rejects.toBeInstanceOf(ReviewPurchaseNotVerifiedError)`; assert `mockReviewRepo.create` was **not** called.
- `should propagate ReviewAlreadyExistsError from repo.create on duplicate` — `hasVerifiedPurchase` verified, `mockReviewRepo.create` rejects with `new ReviewAlreadyExistsError()`; assert the same error is thrown by the service (409-mapped).
- `should throw ValidationError when rating is 0` / `should throw ValidationError when rating is 6` / `should throw ValidationError when rating is not an integer (3.5)` — assert `rejects.toBeInstanceOf(ValidationError)`; assert neither `hasVerifiedPurchase` nor `create` was called (validation runs first).
- `should accept a review with only rating, no title or body` — `title`/`body` omitted from input; assert `create` called with `title: null, body: null`.
- `should throw ValidationError when title exceeds 150 characters`.
- `should throw ValidationError when body exceeds 2000 characters`.
- `should throw CustomerNotFoundError when the authenticated customer record is missing` — defensive case; `hasVerifiedPurchase` verified but `mockCustomerRepo.findById` resolves `null`.

**`describe('ReviewService - checkEligibility')`**
- `should return canReview:true, reason:'eligible' for a verified buyer with no existing review`.
- `should return canReview:false, reason:'not_purchased' for a non-buyer` — assert `hasExistingReview` is **not** called (short-circuit not required, but assert whichever order is chosen consistently — see implementation below, which checks `hasExistingReview` first).
- `should return canReview:false, reason:'already_reviewed' when the customer already has a review for the product`.

**`describe('ReviewService - listApprovedForProduct / listOwnReviews / getSummaryForProduct / listModerationQueue')`** — thin pass-through tests, one each, mirroring `CategoryService - findAll`'s "should pass filters to repo" style.

**`describe('ReviewService - approveReview / rejectReview')`** (task 4.3)
- `should set status Approved, publishedAt, moderatedAt, moderatedByAdminUserId on Pending -> Approved` — `mockReviewRepo.findById`-style existing-status read is internal to the service's own `prisma.$transaction` (see 4.4 below), so this test mocks `prisma.review.findUnique`/`update` via `jest.mock('../../infrastructure/prismaClient', ...)` **or** — simpler and consistent with `refundService`/`returnRequestService` having **no dedicated test file today** — this is the first service in the codebase to unit-test the raw-`prisma.$transaction` pattern; recommend mocking `../../infrastructure/prismaClient` with a `$transaction: jest.fn((cb) => cb(mockTx))` and a `mockTx = { review: { findUnique: jest.fn(), update: jest.fn() } }`, matching the callback-style transaction Prisma mock. Assert `mockTx.review.update` called with `status:'Approved', publishedAt: expect.any(Date), moderatedAt: expect.any(Date), moderatedByAdminUserId`.
- `should set status Rejected, moderatedAt, moderatedByAdminUserId and leave publishedAt null on Pending -> Rejected`.
- `should throw ReviewNotFoundError when the review id does not exist`.
- `should throw ReviewTransitionInvalidError when re-approving an already-Approved review`.
- `should throw ReviewTransitionInvalidError when re-moderating an already-Rejected review`.
- `should throw ValidationError when status is not Approved or Rejected` (e.g. `'Pending'` is rejected as a moderation target — it's the system-only initial value).

**`describe('ReviewService - deleteReview')`**
- `should delete an existing review`.
- `should propagate ReviewNotFoundError when review does not exist`.

### 4.2 / 4.4 Implementation — `backend/src/application/services/reviewService.ts` (new file)

```typescript
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prismaClient';
import { Review, ReviewStatus, isValidReviewTransition } from '../../domain/models/review';
import {
  IReviewRepository,
  ReviewListFilters,
  ReviewListResult,
  ReviewSummary,
} from '../../domain/repositories/reviewRepository';
import { ICustomerRepository } from '../../domain/repositories/customerRepository';
import {
  ReviewNotFoundError,
  ReviewPurchaseNotVerifiedError,
  ReviewTransitionInvalidError,
} from '../../infrastructure/repositories/reviewRepository';
import { CustomerNotFoundError } from '../../infrastructure/repositories/customerRepository';
import { validateReviewData, validateReviewStatusUpdate } from '../validator';

function buildAuthorNameSnapshot(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${firstName.trim()} ${initial}.` : firstName.trim();
}

export interface ReviewEligibility {
  canReview: boolean;
  reason: 'eligible' | 'not_purchased' | 'already_reviewed';
}

export class ReviewService {
  constructor(
    private readonly reviewRepository: IReviewRepository,
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async checkEligibility(customerId: number, productId: number): Promise<ReviewEligibility> {
    const alreadyReviewed = await this.reviewRepository.hasExistingReview(customerId, productId);
    if (alreadyReviewed) return { canReview: false, reason: 'already_reviewed' };

    const purchase = await this.reviewRepository.hasVerifiedPurchase(customerId, productId);
    if (!purchase.verified) return { canReview: false, reason: 'not_purchased' };

    return { canReview: true, reason: 'eligible' };
  }

  async submitReview(customerId: number, input: Record<string, unknown>): Promise<Review> {
    validateReviewData(input);

    const productId = input['productId'] as number;
    const rating = input['rating'] as number;
    const title = (input['title'] as string | null | undefined) ?? null;
    const body = (input['body'] as string | null | undefined) ?? null;

    const purchase = await this.reviewRepository.hasVerifiedPurchase(customerId, productId);
    if (!purchase.verified) throw new ReviewPurchaseNotVerifiedError();

    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const authorNameSnapshot = buildAuthorNameSnapshot(customer.firstName, customer.lastName);

    // Uniqueness is enforced by the DB constraint inside repo.create(); see Design Note 1.
    return this.reviewRepository.create({
      productId,
      customerId,
      customerOrderItemId: purchase.customerOrderItemId,
      rating,
      title,
      body,
      authorNameSnapshot,
    });
  }

  async listOwnReviews(customerId: number, page?: number, limit?: number): Promise<ReviewListResult> {
    return this.reviewRepository.findByCustomerId(customerId, page, limit);
  }

  async listApprovedForProduct(productId: number, page?: number, limit?: number): Promise<ReviewListResult> {
    return this.reviewRepository.findApprovedByProductId(productId, page, limit);
  }

  async getSummaryForProduct(productId: number): Promise<ReviewSummary> {
    return this.reviewRepository.getApprovedSummary(productId);
  }

  async listModerationQueue(filters: ReviewListFilters): Promise<ReviewListResult> {
    return this.reviewRepository.findPendingQueue(filters);
  }

  async getById(id: number): Promise<Review> {
    const review = await this.reviewRepository.findById(id);
    if (!review) throw new ReviewNotFoundError();
    return review;
  }

  async moderateReview(
    id: number,
    adminUserId: number,
    input: Record<string, unknown>
  ): Promise<Review> {
    validateReviewStatusUpdate(input);
    const newStatus = input['status'] as ReviewStatus;
    const moderationNote = (input['moderationNote'] as string | null | undefined) ?? null;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.review.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!existing) throw new ReviewNotFoundError();

      if (!isValidReviewTransition(existing.status as ReviewStatus, newStatus)) {
        throw new ReviewTransitionInvalidError(
          `Cannot transition review from ${existing.status} to ${newStatus}`
        );
      }

      const now = new Date();
      const updated = await tx.review.update({
        where: { id },
        data: {
          status: newStatus,
          moderatedByAdminUserId: adminUserId,
          moderationNote,
          moderatedAt: now,
          ...(newStatus === 'Approved' && { publishedAt: now }),
        },
      });

      return new Review({ ...updated });
    });
  }

  async deleteReview(id: number): Promise<void> {
    await this.reviewRepository.delete(id);
  }
}
```

Notes:
- `CustomerNotFoundError` is imported from `infrastructure/repositories/customerRepository.ts` (already exists, lines 15–24) — reused, not redefined.
- `moderateReview` covers both "approve" and "reject" (task 4.4 lists `approveReview`/`rejectReview`/`listModerationQueue` as three separate methods — implemented here as **one** `moderateReview(id, adminUserId, input)` taking `{status, moderationNote?}` in `input`, since `PATCH /api/admin/reviews/:id/status` per task 6.4 is a single endpoint accepting either target status, exactly like `RefundService.updateStatus` and `ReturnRequestService.updateStatus` are single methods, not split `approve`/`reject` methods, despite tasks.md's Refund/ReturnRequest equivalents also being singular `updateStatus`. If a literal `approveReview(id, adminUserId)` / `rejectReview(id, adminUserId, note?)` pair is preferred instead (arguably a slightly nicer controller call-site: `reviewService.approveReview(id, adminId)` vs `reviewService.moderateReview(id, adminId, {status:'Approved'})`), that's a trivial two-thin-wrapper refactor of the same transaction body — flagging so the implementer picks one deliberately rather than doing both.
- `listModerationQueue` is a thin pass-through to `findPendingQueue`, satisfying task 4.4's third named method.

### 4.5 Verification command

```bash
cd backend
npx prisma generate   # after schema changes, before running tests that import PrismaClient types
npm run lint
npm test -- --watchAll=false --testPathPattern=reviewService
```

---

## 5. Validation Rules

### 5.1 Add to `backend/src/application/validator.ts` (append near the `ReturnRequest` validators block, after line 824, before the Stripe/Payment error classes section)

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Review validators
// ─────────────────────────────────────────────────────────────────────────────

// Rejects genuine control characters (null byte, etc.) but deliberately allows
// ordinary punctuation including '<' and '>' — review text is stored as plain
// text and rendered through Seo.tsx's existing <script>-escaping mechanism at
// render time, not sanitized/blacklisted at the input boundary. See backend.md
// Design Note 2 in the product-customer-reviews implementation plan.
// Built from character codes (not a literal escape sequence in source) to avoid
// any editor/tooling mangling of raw control bytes: matches ASCII 0-8, 11, 12,
// 14-31, and 127 (DEL) -- i.e. all C0 control codes except tab(9)/LF(10)/CR(13).
const CONTROL_CHAR_CODES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31, 127,
];
const CONTROL_CHARS_PATTERN =
  '[' + CONTROL_CHAR_CODES.map((c) => String.fromCharCode(c)).join('') + ']';
const CONTROL_CHARS_REGEX = new RegExp(CONTROL_CHARS_PATTERN);

export function validateReviewData(data: Record<string, unknown>): void {
  const productId = data['productId'];
  if (productId === undefined || productId === null) {
    throw new ValidationError("Field 'productId' is required");
  }
  if (!Number.isInteger(productId) || (productId as number) < 1) {
    throw new ValidationError("Field 'productId' must be a positive integer");
  }

  const rating = data['rating'];
  if (rating === undefined || rating === null || rating === '') {
    throw new ValidationError("Field 'rating' is required");
  }
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    throw new ValidationError("Field 'rating' must be an integer between 1 and 5");
  }

  const title = data['title'];
  if (title !== undefined && title !== null && title !== '') {
    if (typeof title !== 'string') {
      throw new ValidationError("Field 'title' must be a string");
    }
    if (title.length > 150) {
      throw new ValidationError("Field 'title' must not exceed 150 characters");
    }
    if (CONTROL_CHARS_REGEX.test(title)) {
      throw new ValidationError("Field 'title' contains invalid control characters");
    }
  }

  const body = data['body'];
  if (body !== undefined && body !== null && body !== '') {
    if (typeof body !== 'string') {
      throw new ValidationError("Field 'body' must be a string");
    }
    if (body.length > 2000) {
      throw new ValidationError("Field 'body' must not exceed 2000 characters");
    }
    if (CONTROL_CHARS_REGEX.test(body)) {
      throw new ValidationError("Field 'body' contains invalid control characters");
    }
  }
}

const REVIEW_MODERATION_STATUSES = ['Approved', 'Rejected'] as const;

export function validateReviewStatusUpdate(data: Record<string, unknown>): void {
  const status = data['status'];
  if (status === undefined || status === null || status === '') {
    throw new ValidationError("Field 'status' is required");
  }
  if (!REVIEW_MODERATION_STATUSES.includes(status as (typeof REVIEW_MODERATION_STATUSES)[number])) {
    throw new ValidationError(
      `Field 'status' must be one of: ${REVIEW_MODERATION_STATUSES.join(', ')}`
    );
  }

  const moderationNote = data['moderationNote'];
  if (moderationNote !== undefined && moderationNote !== null && moderationNote !== '') {
    if (typeof moderationNote === 'string' && moderationNote.length > 500) {
      throw new ValidationError("Field 'moderationNote' must not exceed 500 characters");
    }
  }
}
```

Add corresponding unit tests to a new `backend/src/application/validator.test.ts` **if one doesn't already exist** — confirmed during this planning pass that `validator.ts` currently has **no dedicated test file at all** in the repo (only reached indirectly through service tests). Creating `validator.test.ts` is optional/out-of-scope-creep for this change; the safer minimal approach is to exercise `validateReviewData`/`validateReviewStatusUpdate` only indirectly through `reviewService.test.ts`'s validation-error test cases (section 4.1 above), consistent with how `validateRefundCreateData` etc. have never had dedicated tests either.

---

## 6. Controllers and Routes

### 6.1 `backend/src/presentation/controllers/reviewController.ts` (new file — public, read-only)

```typescript
import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../../application/services/reviewService';
import { ReviewRepository } from '../../infrastructure/repositories/reviewRepository';
import { CustomerRepository } from '../../infrastructure/repositories/customerRepository';
import { ValidationError } from '../../application/validator';
import { logger } from '../../infrastructure/logger';

function parseOptionalQueryInt(value: unknown, paramName: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new ValidationError(`Query parameter '${paramName}' must be a valid integer`);
  }
  return parsed;
}

const reviewService = new ReviewService(new ReviewRepository(), new CustomerRepository());

export async function getProductReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseOptionalQueryInt(req.params['id'], 'id');
    if (productId === undefined) {
      throw new ValidationError("Parameter 'id' must be a valid integer");
    }
    const { page, limit } = req.query;

    const [list, summary] = await Promise.all([
      reviewService.listApprovedForProduct(
        productId,
        parseOptionalQueryInt(page, 'page'),
        parseOptionalQueryInt(limit, 'limit'),
      ),
      reviewService.getSummaryForProduct(productId),
    ]);

    logger.info('Public product reviews listed', { productId, total: list.total });
    res.json({
      success: true,
      data: { items: list.items, total: list.total, page: list.page, limit: list.limit, summary },
      message: 'Reviews retrieved successfully',
    });
  } catch (err) {
    next(err);
  }
}
```

Route wiring — edit `backend/src/routes/public/productRoutes.ts`:
```typescript
import { Router } from 'express';
import {
  listPublicProducts,
  getPublicProductById,
} from '../../presentation/controllers/publicProductController';
import { getProductReviews } from '../../presentation/controllers/reviewController';

const router = Router();

router.get('/', listPublicProducts);
router.get('/:id/reviews', getProductReviews);
router.get('/:id', getPublicProductById);

export default router;
```
Note: `/:id/reviews` is registered **before** `/:id` — not strictly required in Express (both patterns are distinguishable), but placed first for readability/consistency with "more specific route first" convention; verify no regression by re-running the existing `productRoutes` tests if any exist under `routes/public/__tests__/`.

### 6.2 `reviewSummary` on `GET /api/public/products/:id`

Edit `backend/src/presentation/serializers/publicProduct.ts`:
- Add to `PublicProductDTO` (after line 44, before closing brace):
  ```typescript
  reviewSummary?: { averageRating: number | null; reviewCount: number };
  ```
- Change `serializePublicProduct` signature (line 68) to accept an optional third parameter and spread it in only when provided:
  ```typescript
  export function serializePublicProduct(
    product: Product,
    locale?: string | null,
    reviewSummary?: { averageRating: number | null; reviewCount: number },
  ): PublicProductDTO {
    const resolved = resolveProductLocale(product, locale);
    const variants = (product.variants ?? []).filter((v) => v.status === 'Active').map(serializeVariant);
    const images = (product.images ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder).map(serializeImage);

    return {
      id: product.id,
      name: resolved.name,
      slug: product.slug,
      description: resolved.description,
      brand: product.brand ?? null,
      status: product.status,
      mainImageUrl: product.mainImageUrl ?? null,
      categoryId: product.categoryId ?? null,
      variants,
      images,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      ...(reviewSummary !== undefined && { reviewSummary }),
    };
  }
  ```
  (The `...(cond && {...})` conditional-spread style is exactly the pattern context session flagged as the one to reuse from `product-gtin-identifier`'s `ProductPage.tsx` JSON-LD — reusing it backend-side here too, for the same "omit key entirely rather than emit `null`" reason.)

Edit `backend/src/presentation/controllers/publicProductController.ts` (**not** the admin `productController.ts` — see Design Note 3):
```typescript
import { ReviewService } from '../../application/services/reviewService';
import { ReviewRepository } from '../../infrastructure/repositories/reviewRepository';
import { CustomerRepository } from '../../infrastructure/repositories/customerRepository';
// ...existing imports...

const reviewService = new ReviewService(new ReviewRepository(), new CustomerRepository());

export async function getPublicProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseOptionalQueryInt(req.params['id'], 'id');
    if (id === undefined) {
      throw new ValidationError("Parameter 'id' must be a valid integer");
    }

    const product = await productService.findById(id);
    if (product.status !== 'Active') {
      throw new ProductNotFoundError();
    }

    const reviewSummary = await reviewService.getSummaryForProduct(id);

    const locale = req.headers?.['accept-language'];
    res.setHeader('Vary', 'Accept-Language');
    logger.info('Public product retrieved', { productId: id });
    res.json({
      success: true,
      data: serializePublicProduct(product, locale, {
        averageRating: reviewSummary.averageRating,
        reviewCount: reviewSummary.reviewCount,
      }),
      message: 'Product retrieved successfully',
    });
  } catch (err) {
    next(err);
  }
}
```
`listPublicProducts` is **not** touched (Design Note 4) — its call to `serializePublicProduct(p, locale)` stays two-argument, so `reviewSummary` stays `undefined` and is omitted from list items' JSON.

**Existing test impact (task 10.1, flagged here since it's directly caused by this section's edit):** `routes/public/__tests__/supplierIsolation.test.ts` calls `serializePublicProduct(product)` (2-arg, line 66) and asserts on the JSON string — unaffected, since the 3rd param is optional and omitting it produces identical output to before. Any other existing test asserting an **exact** object equality against `serializePublicProduct`'s / `getPublicProductById`'s full response shape (none found in this repo currently — `publicProductController.ts` has no `.test.ts` file yet) would need updating if one exists; the repo currently has no such controller test file, so no update is expected but the implementer should grep for one before assuming this is a no-op change.

### 6.3 Customer account endpoints — new controller + edit `accountRoutes.ts`

New file `backend/src/presentation/controllers/reviewAccountController.ts` (mirrors `wishlistController.ts`'s use of `CustomerAuthRequest`):

```typescript
import { Response, NextFunction } from 'express';
import { CustomerAuthRequest } from '../../middleware/requireCustomerAuth';
import { ReviewService } from '../../application/services/reviewService';
import { ReviewRepository } from '../../infrastructure/repositories/reviewRepository';
import { CustomerRepository } from '../../infrastructure/repositories/customerRepository';
import { ValidationError } from '../../application/validator';

const reviewService = new ReviewService(new ReviewRepository(), new CustomerRepository());

export async function getReviewEligibility(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params['productId'] as string, 10);
    if (Number.isNaN(productId)) {
      throw new ValidationError("Parameter 'productId' must be a valid integer");
    }
    const eligibility = await reviewService.checkEligibility(req.customer!.customerId, productId);
    res.json({ success: true, data: eligibility, message: 'Review eligibility retrieved' });
  } catch (err) {
    next(err);
  }
}

export async function submitReview(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const review = await reviewService.submitReview(req.customer!.customerId, req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: review, message: 'Review submitted for moderation' });
  } catch (err) {
    next(err);
  }
}

export async function listOwnReviews(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query;
    const result = await reviewService.listOwnReviews(
      req.customer!.customerId,
      page ? parseInt(String(page), 10) : undefined,
      limit ? parseInt(String(limit), 10) : undefined,
    );
    res.json({ success: true, data: result, message: 'Your reviews retrieved' });
  } catch (err) {
    next(err);
  }
}
```

Edit `backend/src/routes/public/accountRoutes.ts` — add import + three routes (auth + rate-limiting already apply globally via the existing `router.use(accountLimiter)` / `router.use(requireCustomerAuth)` at lines 28–29, nothing new needed there):
```typescript
import {
  getReviewEligibility,
  submitReview,
  listOwnReviews,
} from '../../presentation/controllers/reviewAccountController';

// ...after the existing wishlist routes (line 42)...
router.get('/products/:productId/review-eligibility', getReviewEligibility);
router.post('/reviews', submitReview);
router.get('/reviews', listOwnReviews);
```

### 6.4 Admin endpoints — new controller + new route file

New file `backend/src/presentation/controllers/reviewAdminController.ts` (mirrors `refundController.ts`):

```typescript
import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../../application/services/reviewService';
import { ReviewRepository } from '../../infrastructure/repositories/reviewRepository';
import { CustomerRepository } from '../../infrastructure/repositories/customerRepository';
import { ReviewStatus } from '../../domain/models/review';
import { ValidationError } from '../../application/validator';
import { AdminAuthRequest } from '../../middleware/requireAdminAuth';
import { logger } from '../../infrastructure/logger';

function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'id' must be a valid integer");
  return id;
}

const reviewService = new ReviewService(new ReviewRepository(), new CustomerRepository());

export async function listReviewsAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, page, limit } = req.query;
    const result = await reviewService.listModerationQueue({
      status: status as ReviewStatus | undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    logger.info('Admin reviews listed', { total: result.total, status });
    res.json({ success: true, data: result, message: 'Reviews retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateReviewStatus(req: AdminAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const review = await reviewService.moderateReview(id, req.admin!.id, req.body as Record<string, unknown>);
    logger.info('Review status updated', { reviewId: review.id, status: review.status, adminId: req.admin!.id });
    res.json({ success: true, data: review, message: 'Review status updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    await reviewService.deleteReview(id);
    logger.info('Review deleted', { reviewId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
```

New file `backend/src/routes/admin/reviewRoutes.ts` (mirrors `refundRoutes.ts`):
```typescript
import { Router } from 'express';
import {
  listReviewsAdmin,
  updateReviewStatus,
  deleteReview,
} from '../../presentation/controllers/reviewAdminController';

const reviewRouter = Router();

reviewRouter.get('/', listReviewsAdmin);
reviewRouter.patch('/:id/status', updateReviewStatus);
reviewRouter.delete('/:id', deleteReview);

export default reviewRouter;
```

### 6.5 Wiring + error-handler + auth-gating tests

Edit `backend/src/index.ts`:
- Add import (alongside line 14's `refundAdminRoutes`):
  ```typescript
  import reviewAdminRoutes from './routes/admin/reviewRoutes';
  ```
- Add mount (alongside line 110's `adminRouter.use('/refunds', refundAdminRoutes);`):
  ```typescript
  adminRouter.use('/reviews', reviewAdminRoutes);
  ```
- **No change needed** for the public routes — `reviewController.ts`'s route is added directly inside `productRoutes.ts` (6.1) and `reviewAccountController.ts`'s routes directly inside `accountRoutes.ts` (6.3), both of which are already mounted in `index.ts` (lines 123, 127).

Edit `backend/src/middleware/errorHandler.ts`:
- Add import (alongside the `RefundNotFoundError` etc. import block, lines 38–43):
  ```typescript
  import {
    ReviewNotFoundError,
    ReviewAlreadyExistsError,
    ReviewPurchaseNotVerifiedError,
    ReviewTransitionInvalidError,
  } from '../infrastructure/repositories/reviewRepository';
  ```
- Add branches (alongside the `RefundTransitionInvalidError` branch, after line 169):
  ```typescript
  } else if (err instanceof ReviewNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof ReviewAlreadyExistsError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof ReviewPurchaseNotVerifiedError) {
    statusCode = 403; code = err.code; message = err.message;
  } else if (err instanceof ReviewTransitionInvalidError) {
    statusCode = 409; code = err.code; message = err.message;
  ```

**Task 6.5 controller-level auth-gating tests** — two new test files, following the lightweight router-unit-test pattern (`supplierIsolation.test.ts`), not the full-app-with-real-DB pattern (`adminAuthRoutes.test.ts`) — see Design Note 6 for why the admin one needs the middleware mounted explicitly:

`backend/src/routes/public/__tests__/reviewAccountRoutes.test.ts` (new):
```typescript
import request from 'supertest';
import express from 'express';

jest.mock('../../../application/services/reviewService', () => ({
  ReviewService: jest.fn().mockImplementation(() => ({
    checkEligibility: jest.fn(),
    submitReview: jest.fn(),
    listOwnReviews: jest.fn(),
  })),
}));
jest.mock('../../../infrastructure/repositories/reviewRepository', () => ({
  ReviewRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/customerRepository', () => ({
  CustomerRepository: jest.fn().mockImplementation(() => ({})),
}));

import accountRoutes from '../accountRoutes';
import { notFoundHandler, globalErrorHandler } from '../../../middleware/errorHandler';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/public/account', accountRoutes);
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
};

describe('review account routes — auth gating', () => {
  it('GET /products/:productId/review-eligibility without token returns 401', async () => {
    const res = await request(buildApp()).get('/api/public/account/products/1/review-eligibility');
    expect(res.status).toBe(401);
  });

  it('POST /reviews without token returns 401', async () => {
    const res = await request(buildApp()).post('/api/public/account/reviews').send({ productId: 1, rating: 5 });
    expect(res.status).toBe(401);
  });

  it('GET /reviews without token returns 401', async () => {
    const res = await request(buildApp()).get('/api/public/account/reviews');
    expect(res.status).toBe(401);
  });
});
```
Note: mocking `CustomerRepository`/`ReviewRepository` as empty classes (not full mocks) here is unnecessary for a pure-401 test since `requireCustomerAuth` rejects before any controller code runs, but is included for consistency/safety with how `supplierIsolation.test.ts` mocks repositories it doesn't otherwise touch (avoids `PrismaClient` construction at import time in a DB-less test run).

`backend/src/routes/admin/__tests__/reviewRoutes.test.ts` (new) — **must** mount `requireAdminAuth` explicitly, mirroring the real composition in `index.ts` (Design Note 6):
```typescript
import request from 'supertest';
import express from 'express';

jest.mock('../../../application/services/reviewService', () => ({
  ReviewService: jest.fn().mockImplementation(() => ({
    listModerationQueue: jest.fn(),
    moderateReview: jest.fn(),
    deleteReview: jest.fn(),
  })),
}));
jest.mock('../../../infrastructure/repositories/reviewRepository', () => ({
  ReviewRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/customerRepository', () => ({
  CustomerRepository: jest.fn().mockImplementation(() => ({})),
}));

import reviewAdminRoutes from '../reviewRoutes';
import { requireAdminAuth } from '../../../middleware/requireAdminAuth';
import { notFoundHandler, globalErrorHandler } from '../../../middleware/errorHandler';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/reviews', requireAdminAuth, reviewAdminRoutes); // mirrors index.ts's adminRouter.use(requireAdminAuth) composition
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
};

describe('admin review routes — auth gating', () => {
  it('GET / without token returns 401', async () => {
    const res = await request(buildApp()).get('/api/admin/reviews');
    expect(res.status).toBe(401);
  });

  it('PATCH /:id/status without token returns 401', async () => {
    const res = await request(buildApp()).patch('/api/admin/reviews/1/status').send({ status: 'Approved' });
    expect(res.status).toBe(401);
  });

  it('DELETE /:id without token returns 401', async () => {
    const res = await request(buildApp()).delete('/api/admin/reviews/1');
    expect(res.status).toBe(401);
  });
});
```

Business-rule status codes (403 non-buyer, 409 duplicate, 409 re-moderation) are **not** re-asserted at this router-test layer — they're already covered by `reviewService.test.ts` (section 4.1) at the service layer, and by the mandatory curl testing in tasks.md section 12 (12.7/12.8) end-to-end. Duplicating them here as router tests would require standing up real JWTs and a real DB (see Design Note 6's discussion of `adminAuthRoutes.test.ts`'s heavier pattern), which is unnecessary for what task 6.5 asks for ("auth gating ... and correct status codes" — read as: prove the middleware chain rejects unauthenticated calls, and that a happy-path mocked call returns the right 2xx code, both of which the above tests do once one success-case test per endpoint is added alongside the 401 cases — add e.g. `mockListModerationQueue.mockResolvedValue({items:[],total:0,page:1,limit:20}); ... .set(withAdminAuth(fakeValidToken))` if a lightweight fake-JWT helper is added, or defer full happy-path verification to the mandatory curl step in section 12).

---

## Summary of new/changed files (sections 1–6 only)

**New files:**
- `backend/src/domain/models/review.ts`
- `backend/src/domain/repositories/reviewRepository.ts`
- `backend/src/infrastructure/repositories/reviewRepository.ts`
- `backend/src/application/services/reviewService.ts`
- `backend/src/application/services/reviewService.test.ts`
- `backend/src/presentation/controllers/reviewController.ts` (public)
- `backend/src/presentation/controllers/reviewAccountController.ts`
- `backend/src/presentation/controllers/reviewAdminController.ts`
- `backend/src/routes/admin/reviewRoutes.ts`
- `backend/src/routes/public/__tests__/reviewAccountRoutes.test.ts`
- `backend/src/routes/admin/__tests__/reviewRoutes.test.ts`
- `backend/prisma/migrations/<timestamp>_add_review/` (generated by `prisma migrate dev`)

**Edited files:**
- `backend/prisma/schema.prisma` (new `Review` model + 3 back-relations on `Product`, `Customer`, `CustomerOrderItem`, `AdminUser`)
- `backend/src/application/validator.ts` (`validateReviewData`, `validateReviewStatusUpdate`)
- `backend/src/middleware/errorHandler.ts` (4 new error-class branches)
- `backend/src/presentation/serializers/publicProduct.ts` (`reviewSummary` field + optional 3rd param)
- `backend/src/presentation/controllers/publicProductController.ts` (inject `ReviewService`, populate `reviewSummary` in `getPublicProductById` only)
- `backend/src/routes/public/productRoutes.ts` (`GET /:id/reviews`)
- `backend/src/routes/public/accountRoutes.ts` (3 new customer routes)
- `backend/src/index.ts` (import + mount `reviewAdminRoutes`)

**Verification commands (run after implementation, before moving to section 7+):**
```bash
cd backend
npx prisma migrate dev --name add_review
npx prisma generate
npm run lint
npm test -- --watchAll=false --testPathPattern=review
npm test -- --watchAll=false   # full suite, confirm no regressions in publicProduct/supplierIsolation tests
```
