## Why

New customer accounts receive no post-registration communication today, wasting the highest-intent moment in the acquisition funnel. A branded welcome email with a one-time 15% discount coupon converts the sign-up event into an immediate purchase incentive and anchors the first customer–brand interaction.

## What Changes

- **New transactional email template** `welcomeEmail.ts` following the existing `passwordResetEmail.ts` pattern (Mavile palette, inline CSS, HTML + text variants, Spanish copy).
- **New `sendWelcomeEmail` method** on `EmailService`, fire-and-forget (SMTP failure does not abort or revert registration).
- **Auto-generated welcome coupon** on every new account: type `percentage`, value `15`, single-use (`maxUses=1`), configurable expiry (default 30 days), unique code `WELCOME-<token>`.
- **Registration hook** in `CustomerAuthService.register()` and in the new-account branch of `oauthLogin()`: generate coupon → send email after account creation, without blocking the response.
- **New environment variables**: `WELCOME_COUPON_PERCENT` (default `15`), `WELCOME_COUPON_VALIDITY_DAYS` (default `30`), `WELCOME_COUPON_MIN_ORDER` (default `0`).
- **`docs/development_guide.md`** updated with new env vars.
- **No new public endpoints**: welcome coupon is validated and redeemed through existing `POST /api/public/coupons/validate` and checkout flows.

## Capabilities

### New Capabilities

- `customer-welcome-email`: Branded transactional welcome email with auto-generated 15% discount coupon sent on new customer account creation (local and OAuth).

### Modified Capabilities

- `customer-account-authentication`: Registration and OAuth new-account flows now trigger welcome email + coupon generation as a post-creation side effect.
- `storefront-coupons`: System-generated welcome coupons are created programmatically (not through the admin panel); requires documenting auto-generation path and uniqueness guarantee.

## Non-goals

- Admin UI to manage or revoke welcome coupons (coupons are visible in the existing admin coupon list but management is out of scope here).
- Email marketing opt-in / unsubscribe tracking — this is a transactional email, not marketing.
- Multi-language email templates (Spanish only in this iteration, consistent with existing emails).
- Push notifications, SMS, or in-app notifications.
- Automated re-send or retry mechanism for failed sends.

## Impact

- **Backend**: `CustomerAuthService`, `EmailService`, new `welcomeEmail.ts` template, `CouponService` or inline coupon creation, Prisma `Coupon` model (no schema change required — uses existing fields).
- **APIs**: No contract changes; welcome coupon redeemable through existing coupon + checkout endpoints.
- **Configuration**: Three new optional env vars with safe defaults.
- **Customer-facing behavior**: Yes — customers receive a new email and a usable discount code immediately after registration.
- **Internal fulfillment / supplier data**: No impact.
