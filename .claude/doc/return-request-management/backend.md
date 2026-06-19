# Backend Implementation Plan — return-request-management (KAN-25)

Generated: 2026-06-19  
Feature branch: `feature/KAN-25-return-request-management`

---

## Overview

This plan covers every backend file that must be created or modified to deliver the admin RMA (Return Merchandise Authorization) lifecycle. The implementation mirrors the `refunds`/`shipments` vertical-slice pattern exactly. Read the files listed in each section before writing code.

**Implementation order** (strict — each layer depends on the previous):
1. Prisma schema  
2. Domain model  
3. Repository interface (domain layer)  
4. Repository implementation (infrastructure layer)  
5. Validator additions  
6. Application service  
7. Serializer  
8. Controller  
9. Routes  
10. `index.ts` mount  
11. `errorHandler.ts` registration  
12. Tests  

---

## File 1 — `backend/prisma/schema.prisma`

**Action:** Modify (existing file)  
**Reference:** Current content already read; `Refund` model at lines 221–238.

### Changes Required

#### A. Add new `ReturnRequest` model (insert after the `Shipment` model, before `AdminUser`)

```prisma
model ReturnRequest {
  id                  Int               @id @default(autoincrement())
  customerOrderId     Int
  customerOrder       CustomerOrder     @relation(fields: [customerOrderId], references: [id])
  customerOrderItemId Int
  customerOrderItem   CustomerOrderItem @relation(fields: [customerOrderItemId], references: [id])
  reason              String            @db.VarChar(500)
  status              String            @default("Requested")
  requestedAt         DateTime
  approvedAt          DateTime?
  rejectedAt          DateTime?
  receivedAt          DateTime?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt
  refunds             Refund[]

  @@index([customerOrderId])
  @@index([customerOrderItemId])
  @@index([status])
  @@index([createdAt])
}
```

#### B. Add back-relations to `CustomerOrder` model

Inside the `CustomerOrder` model block, add alongside the existing `shipments` and `refunds` relations:

```prisma
  returnRequests      ReturnRequest[]
```

#### C. Add back-relation to `CustomerOrderItem` model

Inside the `CustomerOrderItem` model block, add alongside `supplierOrderItems`:

```prisma
  returnRequests      ReturnRequest[]
```

#### D. Wire the FK on `Refund` model

The existing `Refund` model has `returnRequestId Int?` with NO relation fields. Replace that bare field with a real Prisma relation:

```prisma
  returnRequestId     Int?
  returnRequest       ReturnRequest? @relation(fields: [returnRequestId], references: [id])
```

The `refunds Refund[]` back-relation on `ReturnRequest` (step A) closes the other side.

### Migration

After schema changes run (from inside `backend/`):

```bash
npx prisma migrate dev --name add_return_request
npx prisma generate
```

The generated SQL will:
- Create `return_requests` table with all fields, PK, FKs to `customer_orders` and `customer_order_items`, and the four indexes.
- Add FK constraint `refunds.return_request_id → return_requests.id` (nullable — safe, no backfill needed).

### Gotcha

The existing `Refund.returnRequestId @@index([returnRequestId])` line stays — it was already there and remains valid. Prisma will only add the FK; the index already exists.

---

## File 2 — `backend/src/domain/models/returnRequest.ts`

**Action:** Create new file  
**Pattern:** `backend/src/domain/models/refund.ts` and `backend/src/domain/models/shipment.ts`

### Full Content Outline

```typescript
// ReturnRequestStatus union type
export type ReturnRequestStatus =
  | 'Requested'
  | 'Approved'
  | 'Rejected'
  | 'Received'
  | 'Refunded'
  | 'Cancelled';

// State machine transition map
// Terminal states: Rejected, Refunded, Cancelled (empty arrays)
export const RETURN_REQUEST_TRANSITIONS: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
  Requested:  ['Approved', 'Rejected', 'Cancelled'],
  Approved:   ['Received', 'Cancelled'],
  Received:   ['Refunded', 'Cancelled'],
  Rejected:   [],
  Refunded:   [],
  Cancelled:  [],
};

// Pure function — no Prisma dependency
export function isValidReturnRequestTransition(
  from: ReturnRequestStatus,
  to: ReturnRequestStatus
): boolean {
  return RETURN_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

// Domain entity class — mirrors Prisma fields exactly
export class ReturnRequest {
  id?: number;
  customerOrderId: number;
  customerOrderItemId: number;
  reason: string;
  status: ReturnRequestStatus;
  requestedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  receivedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    customerOrderId: number;
    customerOrderItemId: number;
    reason: string;
    status?: string;
    requestedAt: Date;
    approvedAt?: Date | null;
    rejectedAt?: Date | null;
    receivedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.customerOrderId = data.customerOrderId;
    this.customerOrderItemId = data.customerOrderItemId;
    this.reason = data.reason;
    this.status = (data.status as ReturnRequestStatus) ?? 'Requested';
    this.requestedAt = data.requestedAt;
    this.approvedAt = data.approvedAt ?? null;
    this.rejectedAt = data.rejectedAt ?? null;
    this.receivedAt = data.receivedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
```

### Key Imports Needed
None (pure domain — no external imports).

---

## File 3 — `backend/src/domain/repositories/returnRequestRepository.ts`

**Action:** Create new file  
**Pattern:** `backend/src/domain/repositories/refundRepository.ts`

### Full Interface Outline

```typescript
import { ReturnRequest, ReturnRequestStatus } from '../models/returnRequest';

export interface ReturnRequestListFilters {
  customerOrderId?: number;
  status?: ReturnRequestStatus;
  page?: number;
  limit?: number;
}

export interface ReturnRequestListResult {
  items: ReturnRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface ReturnRequestCreateData {
  customerOrderId: number;
  customerOrderItemId: number;
  reason: string;
  requestedAt: Date;
}

export interface ReturnRequestStatusUpdateData {
  status: ReturnRequestStatus;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  receivedAt?: Date | null;
}

export interface IReturnRequestRepository {
  findAll(filters: ReturnRequestListFilters): Promise<ReturnRequestListResult>;
  findById(id: number): Promise<ReturnRequest | null>;
  create(data: ReturnRequestCreateData): Promise<ReturnRequest>;
  updateStatus(id: number, data: ReturnRequestStatusUpdateData): Promise<ReturnRequest>;
}
```

---

## File 4 — `backend/src/infrastructure/repositories/returnRequestRepository.ts`

**Action:** Create new file  
**Pattern:** `backend/src/infrastructure/repositories/refundRepository.ts` and `backend/src/infrastructure/repositories/shipmentRepository.ts`

### Full Implementation Outline

**Error classes** (all follow the same pattern — `readonly code`, `readonly status`, `Object.setPrototypeOf`):

```typescript
export class ReturnRequestNotFoundError extends Error {
  readonly code = 'RETURN_REQUEST_NOT_FOUND' as const;
  readonly status = 404;
  constructor() {
    super('Return request not found');
    this.name = 'ReturnRequestNotFoundError';
    Object.setPrototypeOf(this, ReturnRequestNotFoundError.prototype);
  }
}

export class ReturnRequestOrderCancelledError extends Error {
  readonly code = 'RETURN_REQUEST_ORDER_CANCELLED' as const;
  readonly status = 409;
  constructor() {
    super('Cannot create a return request for a cancelled order');
    this.name = 'ReturnRequestOrderCancelledError';
    Object.setPrototypeOf(this, ReturnRequestOrderCancelledError.prototype);
  }
}

export class ReturnRequestItemMismatchError extends Error {
  readonly code = 'RETURN_REQUEST_ITEM_MISMATCH' as const;
  readonly status = 422;
  constructor() {
    super('The order item does not belong to the specified order');
    this.name = 'ReturnRequestItemMismatchError';
    Object.setPrototypeOf(this, ReturnRequestItemMismatchError.prototype);
  }
}

export class ReturnRequestTransitionInvalidError extends Error {
  readonly code = 'RETURN_REQUEST_TRANSITION_INVALID' as const;
  readonly status = 409;
  constructor(message = 'Invalid return request status transition') {
    super(message);
    this.name = 'ReturnRequestTransitionInvalidError';
    Object.setPrototypeOf(this, ReturnRequestTransitionInvalidError.prototype);
  }
}
```

**`returnRequestSelect` constant** (matches all fields on the Prisma model — no relations in list/create, all scalar fields):

```typescript
const returnRequestSelect = {
  id: true,
  customerOrderId: true,
  customerOrderItemId: true,
  reason: true,
  status: true,
  requestedAt: true,
  approvedAt: true,
  rejectedAt: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
```

**`ReturnRequestRepository` class** implementing `IReturnRequestRepository`:

- `findAll`: pagination same as `RefundRepository.findAll` — default `page=1`, `limit=10`, max `100`; filter by `customerOrderId` and/or `status`; order by `createdAt desc`; use `prisma.$transaction([findMany, count])`.
- `findById`: `prisma.returnRequest.findUnique({ where: { id }, select: returnRequestSelect })`; returns `null` if not found.
- `create`: `prisma.returnRequest.create({ data: { ...data }, select: returnRequestSelect })`.
- `updateStatus`: `prisma.returnRequest.update({ where: { id }, data: { status, approvedAt, rejectedAt, receivedAt (only spread the ones !== undefined) }, select: returnRequestSelect })`; catch `P2025` and throw `ReturnRequestNotFoundError`.

**Mapper function:**

```typescript
function mapReturnRequest(row: ReturnRequestRow): ReturnRequest {
  return new ReturnRequest({ ...row });
}
```

**Key imports:** `import { Prisma } from '@prisma/client'`, `import { prisma } from '../prismaClient'`, domain model, domain repository interface.

### Gotcha

Unlike `Refund`, there are no `Decimal` fields here — all timestamps are plain `DateTime` in Prisma. The mapper does NOT need `.toString()` conversion.

---

## File 5 — `backend/src/application/validator.ts`

**Action:** Modify (existing file — append to the end)  
**Reference:** Current file ends at line 733 after `validateShipmentStatusUpdate`.

### Lines to Add (append after line 733)

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// ReturnRequest validators
// ─────────────────────────────────────────────────────────────────────────────

const RETURN_REQUEST_STATUSES = [
  'Requested',
  'Approved',
  'Rejected',
  'Received',
  'Refunded',
  'Cancelled',
] as const;

export function validateReturnRequestCreateData(data: Record<string, unknown>): void {
  const customerOrderId = data['customerOrderId'];
  if (customerOrderId === undefined || customerOrderId === null) {
    throw new ValidationError("Field 'customerOrderId' is required");
  }
  if (!Number.isInteger(customerOrderId) || (customerOrderId as number) < 1) {
    throw new ValidationError("Field 'customerOrderId' must be a positive integer");
  }

  const customerOrderItemId = data['customerOrderItemId'];
  if (customerOrderItemId === undefined || customerOrderItemId === null) {
    throw new ValidationError("Field 'customerOrderItemId' is required");
  }
  if (!Number.isInteger(customerOrderItemId) || (customerOrderItemId as number) < 1) {
    throw new ValidationError("Field 'customerOrderItemId' must be a positive integer");
  }

  const reason = data['reason'];
  if (reason === undefined || reason === null || reason === '') {
    throw new ValidationError("Field 'reason' is required");
  }
  if (typeof reason === 'string' && reason.length > 500) {
    throw new ValidationError("Field 'reason' must not exceed 500 characters");
  }
}

export function validateReturnRequestStatusUpdate(data: Record<string, unknown>): void {
  const status = data['status'];
  if (status === undefined || status === null || status === '') {
    throw new ValidationError("Field 'status' is required");
  }
  if (!RETURN_REQUEST_STATUSES.includes(status as (typeof RETURN_REQUEST_STATUSES)[number])) {
    throw new ValidationError(
      `Field 'status' must be one of: ${RETURN_REQUEST_STATUSES.join(', ')}`
    );
  }
}
```

### Notes

- `validateReturnRequestStatusUpdate` only validates that `status` is a member of the enum. The **transition validity** check is performed in the service (against the current DB state), NOT here. This matches how `validateRefundStatusUpdate` is structured.
- Do NOT validate the transition direction here — that requires knowing the current status, which is DB state.

---

## File 6 — `backend/src/application/services/returnRequestService.ts`

**Action:** Create new file  
**Pattern:** `backend/src/application/services/shipmentService.ts` (transaction pattern for `create`) and `backend/src/application/services/refundService.ts` (transaction pattern for `updateStatus`)

### Full Implementation Outline

**Imports:**

```typescript
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prismaClient';
import { ReturnRequest, ReturnRequestStatus, isValidReturnRequestTransition } from '../../domain/models/returnRequest';
import { IReturnRequestRepository, ReturnRequestListFilters, ReturnRequestListResult } from '../../domain/repositories/returnRequestRepository';
import {
  ReturnRequestNotFoundError,
  ReturnRequestOrderCancelledError,
  ReturnRequestItemMismatchError,
  ReturnRequestTransitionInvalidError,
} from '../../infrastructure/repositories/returnRequestRepository';
import { CustomerOrderNotFoundError } from '../../infrastructure/repositories/customerOrderRepository';
import { validateReturnRequestCreateData, validateReturnRequestStatusUpdate } from '../validator';
```

**`ReturnRequestService` class:**

```typescript
export class ReturnRequestService {
  constructor(private readonly returnRequestRepository: IReturnRequestRepository) {}

  async list(filters: ReturnRequestListFilters): Promise<ReturnRequestListResult> {
    return this.returnRequestRepository.findAll(filters);
  }

  async getById(id: number): Promise<ReturnRequest> {
    const rr = await this.returnRequestRepository.findById(id);
    if (!rr) throw new ReturnRequestNotFoundError();
    return rr;
  }

  async create(input: Record<string, unknown>): Promise<ReturnRequest> {
    validateReturnRequestCreateData(input);

    const customerOrderId = input['customerOrderId'] as number;
    const customerOrderItemId = input['customerOrderItemId'] as number;
    const reason = input['reason'] as string;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Order must exist
      const order = await tx.customerOrder.findUnique({
        where: { id: customerOrderId },
        select: { id: true, status: true },
      });
      if (!order) throw new CustomerOrderNotFoundError();

      // 2. Order must not be cancelled
      if (order.status === 'Cancelled') throw new ReturnRequestOrderCancelledError();

      // 3. Item must exist
      const item = await tx.customerOrderItem.findUnique({
        where: { id: customerOrderItemId },
        select: { id: true, customerOrderId: true },
      });
      if (!item) {
        // Throw a 404 for "item not found" — use CustomerOrderNotFoundError pattern
        // but this is CUSTOMER_ORDER_ITEM_NOT_FOUND; see error class note below
        throw new CustomerOrderItemNotFoundError();
      }

      // 4. Item must belong to the order
      if (item.customerOrderId !== customerOrderId) {
        throw new ReturnRequestItemMismatchError();
      }

      // 5. Create
      const row = await tx.returnRequest.create({
        data: {
          customerOrderId,
          customerOrderItemId,
          reason,
          status: 'Requested',
          requestedAt: new Date(),
        },
      });

      return new ReturnRequest({ ...row });
    });
  }

  async updateStatus(id: number, input: Record<string, unknown>): Promise<ReturnRequest> {
    validateReturnRequestStatusUpdate(input);

    const newStatus = input['status'] as ReturnRequestStatus;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.returnRequest.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existing) throw new ReturnRequestNotFoundError();

      if (!isValidReturnRequestTransition(existing.status as ReturnRequestStatus, newStatus)) {
        throw new ReturnRequestTransitionInvalidError(
          `Cannot transition return request from ${existing.status} to ${newStatus}`
        );
      }

      // Compute per-transition timestamps
      const approvedAt  = newStatus === 'Approved'  ? new Date() : undefined;
      const rejectedAt  = newStatus === 'Rejected'  ? new Date() : undefined;
      const receivedAt  = newStatus === 'Received'  ? new Date() : undefined;

      const updated = await tx.returnRequest.update({
        where: { id },
        data: {
          status: newStatus,
          ...(approvedAt !== undefined && { approvedAt }),
          ...(rejectedAt !== undefined && { rejectedAt }),
          ...(receivedAt !== undefined && { receivedAt }),
        },
      });

      return new ReturnRequest({ ...updated });
    });
  }
}
```

### Additional Error Class Needed

The `CUSTOMER_ORDER_ITEM_NOT_FOUND` (404) error has no existing class. Add `CustomerOrderItemNotFoundError` to `backend/src/infrastructure/repositories/customerOrderRepository.ts` following the exact same pattern as `CustomerOrderNotFoundError`:

```typescript
export class CustomerOrderItemNotFoundError extends Error {
  readonly code = 'CUSTOMER_ORDER_ITEM_NOT_FOUND' as const;
  readonly status = 404;
  constructor() {
    super('Customer order item not found');
    this.name = 'CustomerOrderItemNotFoundError';
    Object.setPrototypeOf(this, CustomerOrderItemNotFoundError.prototype);
  }
}
```

Then import it in `returnRequestService.ts`:

```typescript
import { CustomerOrderNotFoundError, CustomerOrderItemNotFoundError } from '../../infrastructure/repositories/customerOrderRepository';
```

### Gotcha — transaction client vs. repository

Unlike `updateShipmentStatus` which calls `this.shipmentRepository.updateStatus` inside the transaction, this service calls `tx.returnRequest.update` directly to stay inside the same transaction. This is consistent with `refundService.ts`. The `create` path also uses `tx.returnRequest.create` directly.

The `ReturnRequestRepository` is still used for `list` and `getById` (via `findById` on the repo, outside a transaction).

---

## File 7 — `backend/src/presentation/serializers/returnRequestSerializer.ts`

**Action:** Create new file  
**Note:** The refund feature does NOT have a serializer file (no `refundSerializer.ts` exists). The refund controller returns the domain object directly from the service. Follow the same pattern — do NOT create a serializer unless the project's existing pattern requires it.

**Decision:** Skip the serializer file entirely. The `ReturnRequest` domain class contains no sensitive fields (no supplier data, no costs). Return the domain object directly from the controller, as the refund controller does. This is consistent with the existing codebase.

**If a serializer is explicitly required**, it should:
- Export `serializeReturnRequest(rr: ReturnRequest): object`
- Return: `{ id, customerOrderId, customerOrderItemId, reason, status, requestedAt, approvedAt, rejectedAt, receivedAt, createdAt, updatedAt }`
- Explicitly omit nothing (all fields are safe) — but name it clearly so future code knows this is an intentional "no filtering needed" serializer.

---

## File 8 — `backend/src/presentation/controllers/returnRequestController.ts`

**Action:** Create new file  
**Pattern:** `backend/src/presentation/controllers/refundController.ts`

### Full Content Outline

```typescript
import { Request, Response, NextFunction } from 'express';
import { ReturnRequestService } from '../../application/services/returnRequestService';
import { ReturnRequestRepository } from '../../infrastructure/repositories/returnRequestRepository';
import { ReturnRequestStatus } from '../../domain/models/returnRequest';
import { ValidationError } from '../../application/validator';
import { logger } from '../../infrastructure/logger';

function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'id' must be a valid integer");
  return id;
}

const returnRequestService = new ReturnRequestService(new ReturnRequestRepository());

export async function listReturnRequests(req, res, next): Promise<void> {
  try {
    const { customerOrderId, status, page, limit } = req.query;
    const result = await returnRequestService.list({
      customerOrderId: customerOrderId ? parseInt(String(customerOrderId), 10) : undefined,
      status: status as ReturnRequestStatus | undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    logger.info('Return requests listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Return requests retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getReturnRequestById(req, res, next): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const rr = await returnRequestService.getById(id);
    res.json({ success: true, data: rr, message: 'Return request retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createReturnRequest(req, res, next): Promise<void> {
  try {
    const rr = await returnRequestService.create(req.body as Record<string, unknown>);
    logger.info('Return request created', { returnRequestId: rr.id, customerOrderId: rr.customerOrderId });
    res.status(201).json({ success: true, data: rr, message: 'Return request created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateReturnRequestStatus(req, res, next): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const rr = await returnRequestService.updateStatus(id, req.body as Record<string, unknown>);
    logger.info('Return request status updated', { returnRequestId: rr.id, status: rr.status });
    res.json({ success: true, data: rr, message: 'Return request status updated successfully' });
  } catch (err) {
    next(err);
  }
}
```

Use full Express types (`Request`, `Response`, `NextFunction`) in the actual implementation — the outline above omits them for brevity but they must match `refundController.ts` exactly.

### Error Mapping

Error-to-HTTP mapping is **not** handled in the controller. All errors are passed to `next(err)` and resolved by the global `errorHandler.ts`. The controller registers nothing itself. See File 12 (`errorHandler.ts`) below for the handler additions.

---

## File 9 — `backend/src/routes/admin/returnRequestRoutes.ts`

**Action:** Create new file  
**Pattern:** `backend/src/routes/admin/refundRoutes.ts`

### Full Content

```typescript
import { Router } from 'express';
import {
  listReturnRequests,
  createReturnRequest,
  getReturnRequestById,
  updateReturnRequestStatus,
} from '../../presentation/controllers/returnRequestController';

const returnRequestRouter = Router();

returnRequestRouter.get('/', listReturnRequests);
returnRequestRouter.post('/', createReturnRequest);
returnRequestRouter.get('/:id', getReturnRequestById);
returnRequestRouter.patch('/:id/status', updateReturnRequestStatus);

export default returnRequestRouter;
```

Note: `requireAdminAuth` is **NOT** applied here. It is applied globally to `adminRouter` in `index.ts` (line 54: `adminRouter.use(requireAdminAuth)`). All routes mounted under `adminRouter` inherit auth automatically. Do not duplicate it here.

---

## File 10 — `backend/src/index.ts`

**Action:** Modify (existing file)

### Exact Import Line to Add

After line 12 (`import shipmentAdminRoutes from './routes/admin/shipmentRoutes';`), insert:

```typescript
import returnRequestAdminRoutes from './routes/admin/returnRequestRoutes';
```

### Exact Mount Line to Add

After line 61 (`adminRouter.use('/shipments', shipmentAdminRoutes);`), insert:

```typescript
adminRouter.use('/return-requests', returnRequestAdminRoutes);
```

The full updated block will look like:

```typescript
adminRouter.use('/refunds', refundAdminRoutes);
adminRouter.use('/shipments', shipmentAdminRoutes);
adminRouter.use('/return-requests', returnRequestAdminRoutes);  // ADD THIS LINE
app.use('/api/admin', adminRouter);
```

---

## File 11 — `backend/src/middleware/errorHandler.ts`

**Action:** Modify (existing file)

This is the critical file that maps domain errors to HTTP status codes. The controllers call `next(err)` and this handler resolves them. Without registering the new error classes here, all return-request errors will return `500`.

### Import to Add

After the existing shipment imports (around line 46–47), add:

```typescript
import {
  ReturnRequestNotFoundError,
  ReturnRequestOrderCancelledError,
  ReturnRequestItemMismatchError,
  ReturnRequestTransitionInvalidError,
} from '../infrastructure/repositories/returnRequestRepository';
import { CustomerOrderItemNotFoundError } from '../infrastructure/repositories/customerOrderRepository';
```

### `if/else if` Blocks to Add

After the `ShipmentStatusTransitionInvalidError` block (around line 158), add:

```typescript
} else if (err instanceof ReturnRequestNotFoundError) {
  statusCode = 404; code = err.code; message = err.message;
} else if (err instanceof ReturnRequestOrderCancelledError) {
  statusCode = 409; code = err.code; message = err.message;
} else if (err instanceof ReturnRequestItemMismatchError) {
  statusCode = 422; code = err.code; message = err.message;
} else if (err instanceof ReturnRequestTransitionInvalidError) {
  statusCode = 409; code = err.code; message = err.message;
} else if (err instanceof CustomerOrderItemNotFoundError) {
  statusCode = 404; code = err.code; message = err.message;
```

### HTTP Status Codes Summary

| Error Class | HTTP Code | Rationale |
|---|---|---|
| `ReturnRequestNotFoundError` | 404 | Resource not found |
| `ReturnRequestOrderCancelledError` | 409 | Business rule conflict |
| `ReturnRequestItemMismatchError` | 422 | Unprocessable entity (semantic mismatch) |
| `ReturnRequestTransitionInvalidError` | 409 | State machine conflict |
| `CustomerOrderItemNotFoundError` | 404 | Resource not found |

Note: `RefundTransitionInvalidError` maps to 422 in the current code. `ReturnRequestTransitionInvalidError` maps to **409** per the spec (`RETURN_REQUEST_TRANSITION_INVALID → 409`). Do not copy the refund mapping here.

---

## File 12 — `backend/src/infrastructure/repositories/customerOrderRepository.ts`

**Action:** Modify (add one new error class)  
**Reference:** Existing file — read it before modifying to find the correct insertion point.

Add `CustomerOrderItemNotFoundError` after `CustomerOrderNotFoundError`:

```typescript
export class CustomerOrderItemNotFoundError extends Error {
  readonly code = 'CUSTOMER_ORDER_ITEM_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Customer order item not found');
    this.name = 'CustomerOrderItemNotFoundError';
    Object.setPrototypeOf(this, CustomerOrderItemNotFoundError.prototype);
  }
}
```

---

## File 13 — `backend/src/application/services/refundService.ts`

**Action:** Modify (existing file — small addition inside `create` method)

The refund spec (delta spec `specs/refund-management/spec.md`) now requires that when `returnRequestId` is provided, the referenced `ReturnRequest` must exist. The current `refundService.ts` does NOT validate this. Add this check inside the `prisma.$transaction` in the `create` method, after the balance check:

```typescript
// After the balance validation block, before tx.refund.create:
const returnRequestId = (input['returnRequestId'] as number | null) ?? null;
if (returnRequestId !== null) {
  const rr = await tx.returnRequest.findUnique({
    where: { id: returnRequestId },
    select: { id: true },
  });
  if (!rr) throw new ReturnRequestNotFoundError();
}
```

Import `ReturnRequestNotFoundError` from the return request repository:

```typescript
import { ReturnRequestNotFoundError } from '../../infrastructure/repositories/returnRequestRepository';
```

Also update the `tx.refund.create` call to use the local `returnRequestId` variable instead of re-reading from `input`.

---

## File 14 — Test Files

### 14a. `backend/src/application/__tests__/validator.returnRequest.test.ts`

**Action:** Create new file  
**Pattern:** `backend/src/application/__tests__/validator.shipment.test.ts`

**Test groups and cases:**

```
describe('validateReturnRequestCreateData')
  - passes for valid minimal data { customerOrderId: 1, customerOrderItemId: 2, reason: 'Damaged' }
  - throws when customerOrderId is missing
  - throws when customerOrderId is not a positive integer (0, -1, 'abc')
  - throws when customerOrderItemId is missing
  - throws when customerOrderItemId is not a positive integer
  - throws when reason is missing or empty string
  - throws when reason exceeds 500 characters (reason: 'x'.repeat(501))
  - passes with reason exactly 500 characters (boundary)

describe('validateReturnRequestStatusUpdate')
  - passes for each valid status: Requested, Approved, Rejected, Received, Refunded, Cancelled
  - throws when status is missing
  - throws for an invalid/unknown status value
```

### 14b. `backend/src/application/services/__tests__/returnRequestService.test.ts`

**Action:** Create new file  
**Pattern:** `backend/src/application/services/__tests__/shipmentService.test.ts`

**Mock setup** (identical structure to shipmentService.test.ts):

```typescript
const mockCustomerOrderFindUnique = jest.fn();
const mockCustomerOrderItemFindUnique = jest.fn();
const mockReturnRequestCreate = jest.fn();
const mockReturnRequestFindUnique = jest.fn();
const mockReturnRequestUpdate = jest.fn();
const mockTransaction = jest.fn(async (cb) =>
  cb({
    customerOrder: { findUnique: mockCustomerOrderFindUnique },
    customerOrderItem: { findUnique: mockCustomerOrderItemFindUnique },
    returnRequest: {
      create: mockReturnRequestCreate,
      findUnique: mockReturnRequestFindUnique,
      update: mockReturnRequestUpdate,
    },
  })
);

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: { $transaction: (cb) => mockTransaction(cb) },
}));
```

**Mock repository:**

```typescript
const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
};
```

**Helper:**

```typescript
function makeReturnRequest(overrides = {}): ReturnRequest {
  return new ReturnRequest({
    id: 1,
    customerOrderId: 10,
    customerOrderItemId: 20,
    reason: 'Damaged item',
    status: 'Requested',
    requestedAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
    receivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}
```

**Test groups and cases:**

```
describe('ReturnRequestService')

  describe('list')
    - delegates to repository findAll

  describe('getById')
    - returns return request when found
    - throws ReturnRequestNotFoundError when not found (repo returns null)

  describe('create')
    - throws ValidationError when customerOrderId is missing
    - throws ValidationError when customerOrderItemId is missing
    - throws ValidationError when reason is missing
    - throws CustomerOrderNotFoundError when order does not exist (tx returns null)
    - throws ReturnRequestOrderCancelledError when order status is Cancelled
    - throws CustomerOrderItemNotFoundError when item does not exist
    - throws ReturnRequestItemMismatchError when item.customerOrderId !== customerOrderId
    - creates return request with status Requested and requestedAt set

  describe('updateStatus')
    - throws ValidationError for invalid status value
    - throws ReturnRequestNotFoundError when return request does not exist
    - throws ReturnRequestTransitionInvalidError for invalid transition (e.g. Requested→Received)
    - throws ReturnRequestTransitionInvalidError for terminal state (e.g. Rejected→Approved)
    - sets approvedAt when transitioning to Approved
    - sets rejectedAt when transitioning to Rejected
    - sets receivedAt when transitioning to Received
    - allows Refunded from Received (no timestamp, just status update)
    - allows Cancelled from Requested, Approved, Received
    - does NOT set approvedAt/rejectedAt/receivedAt when transitioning to Cancelled
```

**Coverage target:** All branches of the `create` and `updateStatus` methods. Every valid and invalid transition in the state machine must be covered. The 90% threshold requires at minimum all 8 valid transitions and at least 5 invalid transition cases.

### 14c. Existing refund service tests — `backend/src/application/services/__tests__/refundService.test.ts`

**Note:** No `refundService.test.ts` exists yet. If one is written as part of this feature, it must add a test case for the new `returnRequestId` validation:
- throws `ReturnRequestNotFoundError` when a non-null `returnRequestId` references a non-existent return request

If this test file is not being created in KAN-25, document this as a gap.

### 14d. Existing refund tests that reference the `Refund` model

**Action:** Review `backend/src/application/services/__tests__/` for any test that builds a mock `Refund` or `refund.create` data with `returnRequestId`.

After the schema migration, the Prisma-generated type for `refund.create.data` will now enforce that `returnRequestId` is a valid FK. Mock objects in existing tests that pass `returnRequestId: 999` to a mock Prisma will still work (mocks bypass FK validation). No existing test files should break because all Prisma calls in tests are mocked.

---

## Execution Checklist

Execute these in order. Do not skip steps.

1. `backend/prisma/schema.prisma` — add `ReturnRequest` model, update relations on `CustomerOrder`, `CustomerOrderItem`, and `Refund`
2. Run `npx prisma migrate dev --name add_return_request` (inside `backend/`)
3. Run `npx prisma generate` (inside `backend/`)
4. Create `backend/src/domain/models/returnRequest.ts`
5. Create `backend/src/domain/repositories/returnRequestRepository.ts`
6. Modify `backend/src/infrastructure/repositories/customerOrderRepository.ts` — add `CustomerOrderItemNotFoundError`
7. Create `backend/src/infrastructure/repositories/returnRequestRepository.ts`
8. Modify `backend/src/application/validator.ts` — append two new validator functions
9. Create `backend/src/application/services/returnRequestService.ts`
10. Modify `backend/src/application/services/refundService.ts` — add `returnRequestId` existence check
11. Create `backend/src/presentation/controllers/returnRequestController.ts`
12. Create `backend/src/routes/admin/returnRequestRoutes.ts`
13. Modify `backend/src/index.ts` — import + mount
14. Modify `backend/src/middleware/errorHandler.ts` — register all new error classes
15. Create `backend/src/application/__tests__/validator.returnRequest.test.ts`
16. Create `backend/src/application/services/__tests__/returnRequestService.test.ts`
17. Run `npx jest --testPathPattern="returnRequest"` — all must pass
18. Run `npm test` — full suite must pass with ≥90% coverage

---

## Critical Gotchas

1. **`errorHandler.ts` is mandatory.** Without it, all return-request errors silently become 500. This file is easy to forget.

2. **`ReturnRequestTransitionInvalidError` maps to 409, not 422.** `RefundTransitionInvalidError` maps to 422 in the existing handler. The spec for KAN-25 explicitly requires 409 for `RETURN_REQUEST_TRANSITION_INVALID`. Do not copy the refund mapping.

3. **`CustomerOrderItemNotFoundError` is a new class in `customerOrderRepository.ts`, not in `returnRequestRepository.ts`.** It lives next to `CustomerOrderNotFoundError` because it's a customer-order-domain concept. Do not add it to the return-request infrastructure file.

4. **The `create` service method calls `tx.returnRequest.create` directly (not via repository).** This is required to keep all four validation steps in the same Prisma transaction. The repository `create` method is unused by the service but still exists for potential future use.

5. **`requestedAt` is NOT auto-set by Prisma.** Unlike `createdAt` which has `@default(now())`, `requestedAt` has no Prisma default — the service must pass `new Date()` explicitly when creating.

6. **The `Refund.returnRequestId` FK migration is safe.** The column already exists as a nullable integer. The migration only adds the FK constraint. Existing null values are unaffected. Existing non-null values will fail if they point to non-existent IDs — but in dev there are none (column was never populated).

7. **After `prisma generate`, the TypeScript compiler will see the new `returnRequest` relation on `Refund`.** Any existing code that constructs a `Prisma.RefundCreateInput` without the `returnRequest` field will still compile (it's optional). No existing code breaks.

8. **Do not apply `requireAdminAuth` in the routes file.** It is already applied globally to the `adminRouter` in `index.ts`. Adding it again in the routes file would double-apply it.

9. **The state machine function `isValidReturnRequestTransition` treats missing `from` states defensively.** The `?? false` fallback in the implementation handles any unexpected status string from the DB without throwing.

10. **No serializer file needed.** The `ReturnRequest` entity has no sensitive fields. Return the domain object from the service directly as the controller does for `Refund`.
