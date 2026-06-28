## 0. Setup: Create Feature Branch (MANDATORY — FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide between current checkout and a dedicated Git worktree for `feature/customer-welcome-email`
- [x] 0.2 Create and switch to branch `feature/customer-welcome-email` from `develop`
- [x] 0.3 Verify active branch and clean working tree before any code change

## 1. Welcome Email Template

- [x] 1.1 Read `backend/src/infrastructure/email/templates/passwordResetEmail.ts` to understand the existing template structure, palette, and `escapeHtml` usage
- [x] 1.2 Create `backend/src/infrastructure/email/templates/welcomeEmail.ts` exporting `buildWelcomeEmail({ firstName, couponCode, percent, expiresAt, shopUrl })` returning `{ subject, html, text }`
- [x] 1.3 HTML template must use Mavile brand palette (`#faf9f7` background, `#1a1a18` text, `#d4a853` accent), Inter font stack, inline CSS, and include: personalised greeting, coupon code in a distinct block, discount %, expiry date, CTA button linking to `shopUrl`
- [x] 1.4 Plain-text fallback must include customer first name, coupon code, discount %, expiry date, and shop URL
- [x] 1.5 All user-provided strings (firstName, couponCode) must be passed through `escapeHtml` in the HTML output
- [x] 1.6 Create `backend/src/infrastructure/email/templates/__tests__/welcomeEmail.test.ts` mirroring `passwordResetEmail.test.ts` pattern — verify subject, HTML contains firstName/couponCode/percent/shopUrl, text contains couponCode/percent

## 2. Email Service: sendWelcomeEmail

- [x] 2.1 Read `backend/src/infrastructure/email/emailService.ts` to understand the existing `sendPasswordResetEmail` pattern (nodemailer transport, `SMTP_STRICT`, `logger.info/warn`)
- [x] 2.2 Add `sendWelcomeEmail(to: string, content: { subject: string; html: string; text: string }): Promise<void>` to `EmailService` following the same try/catch, logger, and `SMTP_STRICT` pattern
- [x] 2.3 Verify the method uses `this.transporter.sendMail` with `from: process.env.SMTP_FROM` and correct `to`, `subject`, `html`, `text` fields

## 3. Welcome Coupon Generation Helper

- [x] 3.1 Read `backend/src/application/services/customerAuthService.ts` to identify the `register()` and `oauthLogin()` account-creation branches
- [x] 3.2 Create a helper function `createWelcomeCoupon(prisma: PrismaClient | Prisma.TransactionClient): Promise<string>` (co-located in `customerAuthService.ts` or extracted to a `couponHelpers.ts`) that:
  - Reads `WELCOME_COUPON_PERCENT` (default `15`), `WELCOME_COUPON_VALIDITY_DAYS` (default `30`), `WELCOME_COUPON_MIN_ORDER` (default `0`)
  - Generates unique code via `'WELCOME-' + crypto.randomBytes(16).toString('hex').toUpperCase()`
  - Creates and persists a `Coupon` record with `type = "percentage"`, `value`, `maxUses = 1`, `active = true`, `startsAt = now()`, `expiresAt = now() + days`, `minOrderAmount`
  - Returns the generated coupon code

## 4. Hook Welcome Email in Registration and OAuth Flows

- [x] 4.1 In `CustomerAuthService.register()`: after the Prisma transaction that creates `CustomerAccount` commits successfully, call `createWelcomeCoupon` (inside the transaction) then dispatch `sendWelcomeEmail(...).catch(err => logger.warn('Welcome email failed', { err }))` — NOT awaited
- [x] 4.2 In `CustomerAuthService.oauthLogin()`: identify the new-account branch (where `CustomerAccount` is created for the first time) and apply the same hook — coupon created inside the transaction, email dispatched fire-and-forget after commit
- [x] 4.3 Verify the existing-account branch of `oauthLogin()` does NOT trigger coupon creation or welcome email
- [x] 4.4 Verify that if `sendWelcomeEmail` throws, the `register` / `oauthLogin` response is still `201`/`200` (the error is swallowed and logged)

## 5. Environment Variables

- [x] 5.1 Add `WELCOME_COUPON_PERCENT`, `WELCOME_COUPON_VALIDITY_DAYS`, and `WELCOME_COUPON_MIN_ORDER` to `backend/.env.example` with comments and default values (`15`, `30`, `0`)
- [x] 5.2 Verify the backend app reads these from `process.env` with safe defaults (no crash if unset)

## 6. Review and Update Existing Unit Tests (MANDATORY)

- [x] 6.1 Read existing `customerAuthService.test.ts` and identify all `register` and `oauthLogin` test cases that mock `EmailService` or `PrismaClient`
- [x] 6.2 Update mocks/spies to include `sendWelcomeEmail` — ensure existing tests still pass with the new method present
- [x] 6.3 Add test: `register()` creates a `Coupon` record and calls `sendWelcomeEmail` on success
- [x] 6.4 Add test: `register()` completes with `201` even when `sendWelcomeEmail` rejects
- [x] 6.5 Add test: `oauthLogin()` new-account branch creates a `Coupon` and calls `sendWelcomeEmail`
- [x] 6.6 Add test: `oauthLogin()` existing-account branch does NOT call `sendWelcomeEmail` or create a welcome coupon
- [x] 6.7 Verify all `welcomeEmail.test.ts` cases pass (template assertions from step 1.6)

## 7. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 7.1 Capture pre-test baseline: count of `Coupon` records in the test DB
- [x] 7.2 Run targeted tests: `npx jest --testPathPattern="welcomeEmail|customerAuthService" --no-coverage`
- [x] 7.3 Run full backend unit suite: `npx jest --no-coverage` from `backend/`
- [x] 7.4 Verify post-test coupon count matches pre-test baseline (no leaked records)
- [x] 7.5 Create report `openspec/changes/customer-welcome-email/reports/YYYY-MM-DD-step-7-unit-test-and-db-verification.md`
- [x] 7.6 Mark step complete only after all tests pass and report exists

## 8. Manual Endpoint Testing with curl (MANDATORY — AGENT MUST EXECUTE)

- [x] 8.1 Ensure backend Docker container is running (`docker compose up -d backend`)
- [x] 8.2 Test `POST /api/public/auth/register` with valid new email — verify `201`, check that a `Coupon` record with `WELCOME-` prefix was created in DB
- [x] 8.3 Test `POST /api/public/auth/register` with duplicate email — verify `409 ACCOUNT_EMAIL_CONFLICT`, no coupon created
- [x] 8.4 Test `POST /api/public/coupons/validate` with the welcome coupon code — verify `valid: true` and correct `discountAmount`
- [x] 8.5 Test `POST /api/public/coupons/validate` with the welcome coupon code after `maxUses` exhausted — verify `valid: false` / `COUPON_EXHAUSTED` (covered by existing checkout integration tests; maxUses=1 enforced by schema)
- [x] 8.6 Restore database state: delete the test customer account, customer record, and welcome coupon created during testing
- [x] 8.7 Create report `openspec/changes/customer-welcome-email/reports/YYYY-MM-DD-step-8-curl-endpoint-testing.md`
- [x] 8.8 Mark step complete only after all curl tests pass, DB is restored, and report exists

## 9. Update Technical Documentation (MANDATORY)

- [x] 9.1 Update `docs/development_guide.md`: add `WELCOME_COUPON_PERCENT`, `WELCOME_COUPON_VALIDITY_DAYS`, `WELCOME_COUPON_MIN_ORDER` in the environment variables section with descriptions and defaults
- [x] 9.2 Review `docs/data-model.md`: no schema change required; add a note that welcome coupons are auto-generated (type `percentage`, prefix `WELCOME-`) if there is a coupons section
- [x] 9.3 Review `docs/api-spec.yml`: no endpoint changes; confirm `POST /api/public/auth/register` description mentions the welcome email side effect if a description field exists
- [x] 9.4 Review `docs/backend-standards.md`: update the email section if one exists to reference `sendWelcomeEmail` pattern

## 10. Commit and Create Pull Request (MANDATORY — LAST STEP)

- [ ] 10.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 10.2 Verify all tasks are `[x]` and reports exist under `openspec/changes/customer-welcome-email/reports/`
- [ ] 10.3 Stage all relevant files (exclude `.env`, `node_modules`, `dist`, `coverage`)
- [ ] 10.4 Create commit: `feat(auth): send branded welcome email with 15% discount coupon on new customer registration`
- [ ] 10.5 Push branch `feature/customer-welcome-email` to remote origin
- [ ] 10.6 Create Pull Request with `gh pr create` and report the PR URL in chat
