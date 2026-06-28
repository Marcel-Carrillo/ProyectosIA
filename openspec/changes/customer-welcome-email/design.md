## Context

The system already sends transactional emails via nodemailer (`EmailService` + `sendPasswordResetEmail`). The `Coupon` / `CouponRedemption` model is fully implemented and used in checkout. `CustomerAuthService.register()` creates `Customer` + `CustomerAccount` inside a Prisma transaction; `oauthLogin()` has a branch for first-time account creation.

No Prisma migration is required: the existing `Coupon` table has all necessary columns (`code`, `type`, `value`, `maxUses`, `usedCount`, `active`, `startsAt`, `expiresAt`, `minOrderAmount`). `Coupon` has no `customerId` column — trazability of welcome coupons is handled by the unique `WELCOME-<token>` code prefix, which is sufficient for this iteration.

## Goals / Non-Goals

**Goals:**
- Send a branded welcome email with a unique 15% coupon immediately after every new customer account (local + OAuth new-account path).
- Keep registration idempotent: SMTP failure cannot block or revert account creation.
- Reuse existing email infrastructure (`EmailService`, nodemailer transport) and template conventions (`passwordResetEmail.ts`).
- Reuse existing coupon validation and checkout logic — no changes to coupon endpoints.

**Non-Goals:**
- Admin UI for welcome coupon management.
- Multi-language email templates (Spanish only, consistent with existing emails).
- `Coupon.customerId` FK or migration.
- Push / SMS notification.
- Retry mechanism for failed sends.

## Decisions

### D1: Fire-and-forget email dispatch (not awaited in the registration response path)

The welcome email is sent with `sendWelcomeEmail(...).catch(err => logger.warn(...))` — not awaited — so SMTP latency or failure has zero impact on registration response time and `201` contract. This matches the existing `sendPasswordResetEmail` usage pattern and keeps the Application layer free of infrastructure coupling.

**Alternative considered:** Await the send and return `207` on partial success. Rejected — adds response complexity and couples registration correctness to email availability, which violates the principle of least surprise for the client.

### D2: Coupon created inside the registration transaction

The welcome `Coupon` is created via `prisma.coupon.create(...)` within the same Prisma transaction as `CustomerAccount` creation. If coupon creation fails (e.g., unique code collision on retry), the entire registration rolls back — preventing a ghost account with no coupon. The probability of collision is negligible given `crypto.randomBytes(16).toString('hex')` (128-bit token space).

**Alternative considered:** Create coupon after the transaction commits. Rejected — allows a window where an account exists but no coupon was generated; harder to guarantee exactly-once semantics.

### D3: New `welcomeEmail.ts` template, not a generic `transactionalEmail.ts`

A dedicated template is simpler, mirrors the existing `passwordResetEmail.ts` pattern, and avoids premature abstraction. A generic email builder can be extracted later when a second transactional template needs the same structure.

### D4: No Prisma migration for `customerId` on `Coupon`

The `WELCOME-<token>` prefix provides sufficient operational traceability (admins can filter by prefix in the coupon list). Adding a `customerId` FK would require a migration, a schema change approval, and data-model doc updates — disproportionate to the MVP value. This decision is revisited when admin-side coupon analytics become a priority.

## Affected Files

| File | Change |
|---|---|
| `backend/src/infrastructure/email/templates/welcomeEmail.ts` | **NEW** — template builder |
| `backend/src/infrastructure/email/emailService.ts` | **MODIFY** — add `sendWelcomeEmail` method |
| `backend/src/application/services/customerAuthService.ts` | **MODIFY** — hook coupon creation + email after account creation in `register()` and `oauthLogin()` |
| `docs/development_guide.md` | **MODIFY** — document `WELCOME_COUPON_PERCENT`, `WELCOME_COUPON_VALIDITY_DAYS`, `WELCOME_COUPON_MIN_ORDER` |
| `backend/src/infrastructure/email/templates/__tests__/welcomeEmail.test.ts` | **NEW** — unit tests for template |
| `backend/src/application/services/__tests__/customerAuthService.test.ts` | **MODIFY** — add welcome email + coupon test cases |

## Risks / Trade-offs

[Coupon code collision] → Mitigation: `crypto.randomBytes(16)` gives 2^128 space; Prisma `create` will throw on unique constraint violation, causing the registration transaction to roll back cleanly. The client retries registration normally.

[SMTP not configured in dev] → Mitigation: `SMTP_STRICT=false` (already the default) means nodemailer silently no-ops. Developers without SMTP credentials are not blocked. The `logger.warn` is emitted so the failure is observable.

[OAuth branch complexity] → Mitigation: The `oauthLogin()` function already has an explicit `isNewAccount` boolean / branch for first-time account creation. Coupon + email are triggered only there, not on every OAuth call.

## Migration Plan

1. Deploy backend with new env vars (`WELCOME_COUPON_*`) — defaults are safe; no SMTP calls until a new registration occurs.
2. No database migration required.
3. Rollback: remove the three env vars and revert `customerAuthService.ts` — existing coupons and accounts are unaffected.

## Open Questions

- *(Resolved)* Unique per-customer coupon vs shared code: **unique code** chosen (see D2).
- *(Resolved)* Fire-and-forget vs awaited dispatch: **fire-and-forget** chosen (see D1).
- *(Resolved)* Prisma migration for `customerId`: **deferred** (see D4).
- Should welcome coupons be sent to OAuth registrations on all providers (Google, Apple, Facebook)? **Yes** — the existing `oauthLogin` new-account branch covers all OAuth providers uniformly.
