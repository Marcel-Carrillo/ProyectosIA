# Frontend Implementation Plan: unified-auth-checkout

> **Change:** OpenSpec `unified-auth-checkout` — KAN-51, KAN-21, KAN-23  
> **Branch:** `feature/unified-auth-checkout`  
> **Tasks covered:** A2 (admin auth frontend), B4 (customer auth + wishlist), C2 (cart + checkout)  
> **ONLY plan — do not implement until prompted.**

---

## Implementation Order

Follow the same layering as the overall change:

1. **Phase A2** — Admin auth (security gate): contexts, service, login page, route guard, Layout logout
2. **Phase B4** — Customer auth + wishlist: contexts, services, storefront pages, route guard, header update
3. **Phase C2** — Cart + checkout: CartContext, checkoutService, CartPage, CheckoutPage, OrderConfirmationPage, PDP wiring

Each phase adds new files and minimally modifies existing ones.

---

## Phase A2 — Admin Authentication Frontend (KAN-47)

### A2.1 · NEW `frontend/src/types/auth.ts`

Central type definitions for both admin and customer auth. Keep them in one file since they are symmetrical and referenced from multiple services.

```
Purpose: Type definitions for AdminUser, CustomerAccount, and all auth request/response shapes.
```

**Contents to define:**

```ts
// --- Admin ---
export interface AdminUser {
  id: number;
  email: string;
  status: 'Active' | 'Disabled';
  createdAt: string;
  updatedAt: string;
}

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  data: { admin: AdminUser; accessToken: string };
  message: string;
}

export interface AdminMeResponse {
  success: boolean;
  data: { admin: AdminUser };
  message: string;
}

export interface AdminRefreshResponse {
  success: boolean;
  data: { accessToken: string };
  message: string;
}

export interface AdminAuthApiError {
  success: false;
  error: { code: string; message: string };
}

// --- Customer ---
export type CustomerAuthProvider = 'local' | 'google' | 'apple' | 'facebook';

export interface CustomerAccount {
  id: number;
  customerId: number;
  email: string;
  authProvider: CustomerAuthProvider;
  totpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface CustomerAuthResponse {
  success: boolean;
  data: {
    account: CustomerAccount;
    customer: import('./customer').Customer;
    accessToken: string;
  };
  message: string;
}

export interface CustomerMeResponse {
  success: boolean;
  data: {
    account: CustomerAccount;
    customer: import('./customer').Customer;
  };
  message: string;
}

export interface CustomerRefreshResponse {
  success: boolean;
  data: { accessToken: string };
  message: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface MfaLoginResponse {
  success: boolean;
  data: { mfaRequired: true; mfaToken: string };
  message: string;
}

export interface CustomerAuthApiError {
  success: false;
  error: { code: string; message: string };
}
```

---

### A2.2 · NEW `frontend/src/services/adminAuthService.ts`

Service module for all admin auth API calls. Uses plain `axios` (not the admin interceptor instance) because the auth endpoints themselves are public.

**Endpoints covered:**
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `POST /api/admin/auth/refresh`
- `GET /api/admin/auth/me`

```ts
import axios, { AxiosError } from 'axios';
import {
  AdminLoginInput,
  AdminLoginResponse,
  AdminMeResponse,
  AdminRefreshResponse,
  AdminAuthApiError,
} from '../types/auth';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const BASE = `${API_BASE_URL}/api/admin/auth`;

export function mapAdminAuthError(code: string): string {
  switch (code) {
    case 'INVALID_CREDENTIALS': return 'Invalid email or password.';
    case 'ADMIN_DISABLED': return 'This admin account has been disabled.';
    case 'REFRESH_TOKEN_INVALID': return 'Session expired. Please log in again.';
    default: return 'An unexpected error occurred. Please try again.';
  }
}

export function extractAdminAuthError(error: unknown): string {
  const code = (error as AxiosError<AdminAuthApiError>).response?.data?.error?.code;
  return mapAdminAuthError(code ?? '');
}

export const adminAuthService = {
  login: async (data: AdminLoginInput): Promise<AdminLoginResponse> => {
    const response = await axios.post<AdminLoginResponse>(`${BASE}/login`, data, {
      withCredentials: true,
    });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await axios.post(`${BASE}/logout`, {}, { withCredentials: true });
  },

  refresh: async (): Promise<AdminRefreshResponse> => {
    const response = await axios.post<AdminRefreshResponse>(`${BASE}/refresh`, {}, {
      withCredentials: true,
    });
    return response.data;
  },

  me: async (accessToken: string): Promise<AdminMeResponse> => {
    const response = await axios.get<AdminMeResponse>(`${BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  },
};
```

**Important notes:**
- All auth calls use `{ withCredentials: true }` so the browser sends/receives the httpOnly refresh cookie.
- `me()` takes the access token directly to avoid the interceptor being set up yet during bootstrap.

---

### A2.3 · NEW `frontend/src/contexts/AdminAuthContext.tsx`

Central context for admin authentication state. Mounts **one** global axios request interceptor that:
1. Attaches `Authorization: Bearer <token>` to every request whose URL contains `/api/admin/` (except login/refresh).
2. Handles 401 responses from admin API routes by calling `refresh()` once, then retrying the request; if refresh fails, redirects to `/admin/login`.

**State shape:**
```ts
interface AdminAuthState {
  admin: AdminUser | null;
  accessToken: string | null;
  isLoading: boolean;          // true while bootstrapping
}
```

**Context value:**
```ts
interface AdminAuthContextValue extends AdminAuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

**Implementation notes:**
- On mount (`useEffect` with `[]`), call `adminAuthService.refresh()` to silently restore session from the httpOnly cookie. If refresh succeeds, store the new `accessToken` in state. If it fails (401/any), set `admin: null` and continue.
- Store `accessToken` in component state only — **never in localStorage** (XSS risk). The httpOnly cookie handles persistence.
- The axios request interceptor reads `accessToken` from a `useRef` (avoids stale closure) and injects the header.
- The axios response interceptor intercepts 401 from `/api/admin/` paths. It attempts one token refresh, updates the ref, and retries the original request. If refresh also 401s, it calls `logout()` and navigates to `/admin/login`.
- Use `React.createContext` with an explicit `undefined` default; `useAdminAuth()` hook asserts non-null.
- Clean up interceptors in the `useEffect` return function.

**Export:** `AdminAuthProvider`, `useAdminAuth`.

---

### A2.4 · NEW `frontend/src/pages/AdminLoginPage.tsx`

Login page for admin at route `/admin/login`.

**Route:** `/admin/login` — outside `RequireAdminAuth`, inside a bare `<Route>` (no `Layout` wrapper).

**UI layout (React Bootstrap):**
- Centered `<Container style={{ maxWidth: 400 }}>` with top margin.
- `<Card>` with `<Card.Body>`.
- Title: "Admin Login".
- Controlled `<Form>` with:
  - Email `<Form.Control type="email">` — required.
  - Password `<Form.Control type="password">` — required.
  - `<Button type="submit" disabled={saving}>` — shows "Signing in…" while loading.
- `<Alert variant="danger">` shown on error.
- On successful login, `useNavigate` to `location.state?.from ?? '/products'` (so redirects back to the protected page the user was trying to reach).

**Important notes:**
- Use `useAdminAuth()` to call `login()`.
- After successful login redirect, the interceptor will be set and all admin API calls will be authenticated.
- Do NOT show a link back to the storefront from this page to keep admin and storefront visually isolated.

---

### A2.5 · NEW `frontend/src/components/admin/RequireAdminAuth.tsx`

React Router guard for admin routes.

```ts
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Navigate, useLocation } from 'react-router-dom';

const RequireAdminAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { admin, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    // Show nothing (or a full-screen spinner) while the refresh check runs
    return <div style={{ minHeight: '100vh' }} />;
  }

  if (!admin) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};
```

**Important notes:**
- The `isLoading` guard is critical: without it, the page flickers to `/admin/login` on every hard refresh while the silent refresh call is in flight.
- Wrap the entire admin `<Layout>` subtree (not individual routes) in `RequireAdminAuth` in `App.tsx`.

---

### A2.6 · MODIFY `frontend/src/components/Layout.tsx`

Add a **Logout** button to the admin navbar.

**Changes:**
- Import `useAdminAuth` from `../../contexts/AdminAuthContext`.
- Import `useNavigate` from `react-router-dom`.
- Add a `<Nav.Link as="button">` (or `<Button variant="link">`) on the right side of the navbar that calls `logout()` then navigates to `/admin/login`.
- Display the logged-in admin email next to the logout button (`admin?.email`).

**Exact additions to the navbar JSX:**
```tsx
// After <Nav className="me-auto">...</Nav>
<Nav className="ms-auto align-items-center">
  {admin && (
    <Navbar.Text className="me-3 text-white-50" style={{ fontSize: '0.8rem' }}>
      {admin.email}
    </Navbar.Text>
  )}
  <Button variant="outline-light" size="sm" onClick={handleLogout}>
    Logout
  </Button>
</Nav>
```

---

### A2.7 · MODIFY `frontend/src/App.tsx`

**Changes needed:**

1. Import `AdminAuthProvider` from `./contexts/AdminAuthContext`.
2. Import `AdminLoginPage` from `./pages/AdminLoginPage` (eager, not lazy — it's lightweight).
3. Import `RequireAdminAuth` from `./components/admin/RequireAdminAuth`.
4. Wrap the entire `<BrowserRouter>` content with `<AdminAuthProvider>`.
5. Add `/admin/login` route **outside** the `Layout` route group but inside `AdminAuthProvider`:
   ```tsx
   <Route path="/admin/login" element={<AdminLoginPage />} />
   ```
6. Wrap the existing admin `<Route path="/" element={<Layout />}>` with `RequireAdminAuth`:
   ```tsx
   <Route
     path="/"
     element={
       <RequireAdminAuth>
         <Layout />
       </RequireAdminAuth>
     }
   >
     {/* existing admin child routes unchanged */}
   </Route>
   ```

**Important notes:**
- `AdminAuthProvider` must be outside `BrowserRouter` child routes but inside `BrowserRouter` (so it can use `useNavigate` internally via the interceptor redirect). Actually, since `AdminAuthContext` uses `useNavigate` inside the interceptor, `AdminAuthProvider` must be rendered **inside** `<BrowserRouter>`. Place it as a wrapper just inside `<Routes>` or as a parent of the route elements.
- The safest pattern: wrap only the admin subtree's `<Routes>` section. Or wrap the whole `<Routes>` in `<AdminAuthProvider>` since it needs to be inside `<BrowserRouter>`.

---

### A2.8 · NEW `frontend/src/components/admin/__tests__/RequireAdminAuth.test.tsx`

Unit test for the `RequireAdminAuth` guard.

**Test cases:**
1. Renders children when `admin` is not null and `isLoading` is false.
2. Redirects to `/admin/login` when `admin` is null and `isLoading` is false.
3. Renders a blank placeholder when `isLoading` is true.

Mock `useAdminAuth` with `jest.mock('../../../contexts/AdminAuthContext')`.

---

## Phase B4 — Customer Authentication + Wishlist Frontend (KAN-53)

### B4.1 · NEW `frontend/src/services/customerAuthService.ts`

Service module for all customer auth API calls. Uses plain `axios` with `withCredentials: true`.

**Endpoints covered:**
- `POST /api/public/auth/register`
- `POST /api/public/auth/login`
- `POST /api/public/auth/logout`
- `POST /api/public/auth/refresh`
- `GET /api/public/auth/me`
- `POST /api/public/auth/forgot-password`
- `POST /api/public/auth/reset-password`
- `POST /api/public/auth/2fa/verify`
- `POST /api/public/account/security/2fa/setup`
- `POST /api/public/account/security/2fa/confirm`
- `POST /api/public/account/security/2fa/disable`
- `GET /api/public/account/profile`
- `PATCH /api/public/account/profile`
- `GET /api/public/account/orders` (paginated)
- `GET /api/public/account/orders/:id`

**Notes:**
- All calls use `{ withCredentials: true }`.
- Protected calls (profile, orders, 2FA management) accept the `accessToken` as a parameter and set `Authorization: Bearer <token>` in the header.
- Export `mapCustomerAuthError(code)` and `extractCustomerAuthError(error)` following the same pattern as `customerService.ts`.

**Error codes to map:**
- `ACCOUNT_EMAIL_CONFLICT` → "An account with this email already exists."
- `INVALID_CREDENTIALS` → "Invalid email or password."
- `ACCOUNT_DISABLED` → "This account has been disabled."
- `REFRESH_TOKEN_INVALID` → "Session expired. Please log in again."
- `RESET_TOKEN_INVALID` → "This reset link is invalid or has expired."
- `INVALID_TOTP_CODE` → "Invalid authentication code. Please try again."
- `OAUTH_VERIFICATION_FAILED` → "OAuth sign-in failed. Please try again."
- `VALIDATION_ERROR` → "Please check your details and try again."

---

### B4.2 · NEW `frontend/src/services/wishlistService.ts`

Service for wishlist CRUD.

**Endpoints:**
- `GET /api/public/account/wishlist`
- `POST /api/public/account/wishlist`
- `DELETE /api/public/account/wishlist/:productVariantId`

**Types to add to `frontend/src/types/wishlist.ts`** (create this file):
```ts
export interface WishlistItem {
  id: number;
  customerId: number;
  productVariantId: number;
  createdAt: string;
  variant?: {
    id: number;
    sku: string;
    publicPrice: string;
    compareAtPrice?: string | null;
    attributes?: Record<string, unknown>;
    product?: {
      id: number;
      name: string;
      slug: string;
      images?: Array<{ url: string; altText?: string | null }>;
    };
  };
}

export interface WishlistListResponse {
  success: boolean;
  data: WishlistItem[];
  message: string;
}

export interface WishlistItemResponse {
  success: boolean;
  data: WishlistItem;
  message: string;
}
```

All service methods receive `accessToken: string` as first parameter and pass `Authorization: Bearer`.

**Error codes:** `VARIANT_NOT_FOUND`.

---

### B4.3 · NEW `frontend/src/types/cart.ts`

Types for cart context.

```ts
export interface CartItem {
  productVariantId: number;
  quantity: number;
  // Display data captured at add-to-cart time (snapshot for display only)
  productId: number;
  productName: string;
  variantAttributes: Record<string, unknown>;
  sku: string;
  publicPrice: string;
  compareAtPrice?: string | null;
  imageUrl?: string | null;
}

export interface Cart {
  items: CartItem[];
}
```

---

### B4.4 · NEW `frontend/src/types/checkout.ts`

Types for checkout service.

```ts
import { AddressSnapshot } from './customerOrder';

export interface CheckoutItem {
  productVariantId: number;
  quantity: number;
}

export interface GuestCheckoutInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  items: CheckoutItem[];
  shippingAddressSnapshot: AddressSnapshot;
  billingAddressSnapshot: AddressSnapshot;
  couponCode?: string;
}

export interface AuthCheckoutInput {
  items: CheckoutItem[];
  shippingAddressSnapshot: AddressSnapshot;
  billingAddressSnapshot: AddressSnapshot;
  couponCode?: string;
}

export interface CheckoutOrderResponse {
  success: boolean;
  data: import('./customerOrder').CustomerOrder;
  message: string;
}

export interface CouponValidateInput {
  code: string;
  subtotalAmount: number;
}

export interface CouponValidateResult {
  valid: boolean;
  discountAmount?: number;
  type?: string;
  value?: number;
  reason?: string;
}

export interface CouponValidateResponse {
  success: boolean;
  data: CouponValidateResult;
  message: string;
}

export interface CheckoutApiError {
  success: false;
  error: { code: string; message: string };
}
```

---

### B4.5 · NEW `frontend/src/contexts/CustomerAuthContext.tsx`

Central context for storefront customer authentication.

**State shape:**
```ts
interface CustomerAuthState {
  account: CustomerAccount | null;
  customer: Customer | null;
  accessToken: string | null;
  isLoading: boolean;
}
```

**Context value (extends state):**
```ts
interface CustomerAuthContextValue extends CustomerAuthState {
  login: (email: string, password: string) => Promise<void | { mfaRequired: true; mfaToken: string }>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  verify2fa: (mfaToken: string, totpCode: string) => Promise<void>;
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string }) => Promise<void>;
  refreshAuth: () => Promise<void>;
}
```

**Implementation notes:**
- On mount, call `customerAuthService.refresh()` silently. If success, store token and then call `customerAuthService.me(token)` to populate `account` and `customer`. If fails, `account: null`.
- Store `accessToken` in component state only (never localStorage — same XSS reasoning as admin).
- Do NOT mount a global axios interceptor for customer calls (to avoid complexity). Instead, `CustomerAuthContext` exposes `accessToken` via context and each storefront service call receives it as a parameter. This is simpler and consistent with the project's local-state approach.
- On `login()`, if the response contains `mfaRequired: true`, return `{ mfaRequired: true, mfaToken }` instead of setting session state — let the calling page handle the 2FA step.
- Export `CustomerAuthProvider` and `useCustomerAuth()`.

---

### B4.6 · NEW `frontend/src/contexts/CartContext.tsx`

Cart context persisted to localStorage key `storefront_cart`.

**State:** `{ items: CartItem[] }` derived from localStorage on init.

**Context value:**
```ts
interface CartContextValue {
  items: CartItem[];
  count: number;                                   // total items across all lines
  addItem: (item: CartItem) => void;
  removeItem: (productVariantId: number) => void;
  updateQuantity: (productVariantId: number, quantity: number) => void;
  clearCart: () => void;
}
```

**Implementation notes:**
- Init state with `JSON.parse(localStorage.getItem('storefront_cart') ?? '[]')`.
- Every state mutation writes back to `localStorage.setItem('storefront_cart', JSON.stringify(items))`.
- `addItem`: if the variant already exists in cart, increment quantity. Otherwise push new item.
- `count`: `items.reduce((sum, i) => sum + i.quantity, 0)`.
- Export `CartProvider` and `useCart()`.

---

### B4.7 · NEW `frontend/src/pages/storefront/LoginPage.tsx`

Customer login page at `/login`.

**UI (storefront design tokens — no React Bootstrap Card, keep storefront look):**
- Full-width centered layout, max-width 440px.
- Heading "Sign In".
- Controlled form: email + password.
- On `login()` call: if `mfaRequired`, show an inline TOTP input form that calls `verify2fa()` with the returned `mfaToken`.
- On success: navigate to `location.state?.from ?? '/'`.
- Error `<Alert variant="danger">` below the form.
- Links: "Don't have an account? Register" → `/register`.
- "Forgot password?" → `/forgot-password`.
- `<OAuthButtons />` section below the form divider.

**Important notes:**
- Use `useCustomerAuth()` for `login` and `verify2fa`.
- MFA step: after `login()` returns `{ mfaRequired: true, mfaToken }`, swap the form to show a "Enter your authentication code" input for the 6-digit TOTP.

---

### B4.8 · NEW `frontend/src/pages/storefront/RegisterPage.tsx`

Customer registration page at `/register`.

**UI:**
- Fields: First Name, Last Name, Email, Password, Phone (optional).
- Password strength hint: "At least 8 characters with letters and digits."
- On success, auto-login (the register endpoint returns tokens), navigate to `/account/profile`.
- Error mapping: `ACCOUNT_EMAIL_CONFLICT` shows inline form error; `VALIDATION_ERROR` highlights fields.
- `<OAuthButtons />` section below the form.

---

### B4.9 · NEW `frontend/src/components/storefront/OAuthButtons.tsx`

Renders three social login buttons.

**Props:** none (uses window.location to trigger redirect flow).

**Buttons:** Google, Apple, Facebook — each is an `<a href="/api/public/auth/{provider}">` link (server-side OAuth redirect). Use brand-appropriate colors/icons via simple SVG inline icons or Unicode placeholder. Respect the storefront design tokens for layout.

**Note:** These are anchor tags, not buttons, since they initiate a server-side redirect flow.

---

### B4.10 · NEW `frontend/src/pages/storefront/ForgotPasswordPage.tsx`

Route: `/forgot-password`.

**UI:** Single email field + submit. On success show a generic confirmation message ("If that email is registered, you'll receive a reset link shortly.") — never confirm whether the email exists.

---

### B4.11 · NEW `frontend/src/pages/storefront/ResetPasswordPage.tsx`

Route: `/reset-password?token=<token>`.

**UI:** New password + confirm password fields. Reads `token` from `useSearchParams()`. On success navigate to `/login` with a success message. Map `RESET_TOKEN_INVALID` to a clear error.

---

### B4.12 · NEW `frontend/src/pages/storefront/AccountProfilePage.tsx`

Route: `/account/profile` — behind `RequireCustomerAuth`.

**UI:**
- Display: name, email (read-only), phone.
- Editable: First Name, Last Name, Phone.
- "Save Changes" button triggers `PATCH /api/public/account/profile`.
- Uses `useCustomerAuth().accessToken` for the request.
- Success feedback via `<Alert variant="success">` dismissible.

---

### B4.13 · NEW `frontend/src/pages/storefront/AccountOrdersPage.tsx`

Route: `/account/orders` — behind `RequireCustomerAuth`.

**UI:**
- Paginated list of own orders from `GET /api/public/account/orders`.
- Each row: order number, date, total, status badge.
- Click navigates to `/account/orders/:id`.
- Storefront `Pagination` component reused from `frontend/src/components/storefront/Pagination.tsx`.
- No supplier fields rendered.

---

### B4.14 · NEW `frontend/src/pages/storefront/AccountOrderDetailPage.tsx`

Route: `/account/orders/:id` — behind `RequireCustomerAuth`.

**UI:**
- Order header: order number, date, status badges.
- Items table: product name, variant, quantity, unit price, line total.
- Address snapshots: shipping and billing.
- Order totals: subtotal, discount, shipping, total.
- **Critical:** render only customer-safe fields from `CustomerOrder`. Never render `supplierId`, `supplierCost`, `supplierReference`, or internal notes.
- "Back to My Orders" navigation link.

---

### B4.15 · NEW `frontend/src/pages/storefront/AccountWishlistPage.tsx`

Route: `/account/wishlist` — behind `RequireCustomerAuth`.

**UI:**
- Grid of wishlist items using `<ProductCard />` variant or a simplified list card.
- Each card: product image, name, variant attributes, price, "Remove" button and "Add to Cart" button.
- "Add to Cart" calls `useCart().addItem()` then navigates to `/cart`.
- Uses `wishlistService` with `useCustomerAuth().accessToken`.

---

### B4.16 · NEW `frontend/src/pages/storefront/TwoFactorSetupPage.tsx`

Route: `/account/security/2fa` — behind `RequireCustomerAuth`.

**UI:**
- If `account.totpEnabled = false`: Show "Set up two-factor authentication" flow.
  1. Call `POST /api/public/account/security/2fa/setup` to get QR code / secret.
  2. Display QR code (use `<img>` with the base64 returned from backend) and secret text for manual entry.
  3. Input for "Enter code from authenticator app" → calls `POST /api/public/account/security/2fa/confirm`.
  4. On success, refresh auth context to reflect `totpEnabled: true`.
- If `account.totpEnabled = true`: Show "Disable 2FA" with password confirmation input → calls `POST /api/public/account/security/2fa/disable`.

---

### B4.17 · NEW `frontend/src/components/storefront/RequireCustomerAuth.tsx`

Guard for storefront account routes.

```tsx
const RequireCustomerAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { account, isLoading } = useCustomerAuth();
  const location = useLocation();

  if (isLoading) return <div style={{ minHeight: '60vh' }} />;
  if (!account) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
};
```

**Note:** mirrors `RequireAdminAuth` exactly but uses `useCustomerAuth()`.

---

### B4.18 · NEW `frontend/src/components/storefront/WishlistButton.tsx`

Toggle button to add/remove a variant from the wishlist. Used on `ProductPage` and `AccountWishlistPage`.

**Props:**
```ts
type WishlistButtonProps = {
  productVariantId: number;
  // optional: initial state if known (e.g., from wishlist page)
  initialWishlisted?: boolean;
};
```

**Behavior:**
- If customer is not logged in, clicking navigates to `/login`.
- If logged in, calls `wishlistService.add()` or `wishlistService.remove()` and toggles visual state.
- Uses heart icon SVG (can inline or use a react-bootstrap-icons `Heart`/`HeartFill` icon).

---

### B4.19 · MODIFY `frontend/src/components/storefront/StorefrontHeader.tsx`

Update the header to reflect customer auth state and cart count.

**Changes:**
1. Import `useCustomerAuth` from `../../contexts/CustomerAuthContext`.
2. Import `useCart` from `../../contexts/CartContext`.
3. The existing "Cart" icon button → replace with `<Link to="/cart">` that shows a small count badge when `count > 0`.
4. Add account icon button:
   - If customer is logged in: `<Link to="/account/profile">` with a person icon + first name or just the icon.
   - If not logged in: `<Link to="/login">` with person icon.
5. Keep all existing CSS class names (`storefront-header__icon-btn`) for the new links.

**Badge styling:** Use `position: relative` on the cart button container and an absolutely positioned `<span>` for the count. Do not use Bootstrap Badge to keep consistent with the storefront's custom CSS approach. Add styles inline or in `storefront.css`.

---

### B4.20 · MODIFY `frontend/src/App.tsx` (Phase B4 additions)

**Additional changes on top of Phase A2:**

1. Import `CustomerAuthProvider` from `./contexts/CustomerAuthContext`.
2. Import `CartProvider` from `./contexts/CartContext`.
3. Import all new storefront pages (lazy-loaded):
   ```ts
   const LoginPage = lazy(() => import('./pages/storefront/LoginPage'));
   const RegisterPage = lazy(() => import('./pages/storefront/RegisterPage'));
   const ForgotPasswordPage = lazy(() => import('./pages/storefront/ForgotPasswordPage'));
   const ResetPasswordPage = lazy(() => import('./pages/storefront/ResetPasswordPage'));
   const AccountProfilePage = lazy(() => import('./pages/storefront/AccountProfilePage'));
   const AccountOrdersPage = lazy(() => import('./pages/storefront/AccountOrdersPage'));
   const AccountOrderDetailPage = lazy(() => import('./pages/storefront/AccountOrderDetailPage'));
   const AccountWishlistPage = lazy(() => import('./pages/storefront/AccountWishlistPage'));
   const TwoFactorSetupPage = lazy(() => import('./pages/storefront/TwoFactorSetupPage'));
   const CartPage = lazy(() => import('./pages/storefront/CartPage'));
   const CheckoutPage = lazy(() => import('./pages/storefront/CheckoutPage'));
   const OrderConfirmationPage = lazy(() => import('./pages/storefront/OrderConfirmationPage'));
   ```
4. Wrap the `<StorefrontLayout />` route subtree with `<CustomerAuthProvider>` and `<CartProvider>`. Both must be **inside** `<BrowserRouter>` (so they can use `useNavigate`).
5. Add new storefront routes inside the `<StorefrontLayout />` route group:
   ```
   /login                      → LoginPage
   /register                   → RegisterPage
   /forgot-password            → ForgotPasswordPage
   /reset-password             → ResetPasswordPage
   /cart                       → CartPage
   /checkout                   → CheckoutPage
   /order-confirmation/:id     → OrderConfirmationPage
   /account/profile            → RequireCustomerAuth > AccountProfilePage
   /account/orders             → RequireCustomerAuth > AccountOrdersPage
   /account/orders/:id         → RequireCustomerAuth > AccountOrderDetailPage
   /account/wishlist           → RequireCustomerAuth > AccountWishlistPage
   /account/security/2fa       → RequireCustomerAuth > TwoFactorSetupPage
   ```

**Final App.tsx route structure outline:**
```tsx
<BrowserRouter>
  <AdminAuthProvider>
    <Routes>
      {/* Storefront */}
      <Route element={<CustomerAuthProvider><CartProvider><StorefrontLayout /></CartProvider></CustomerAuthProvider>}>
        <Route path="/" element={<Navigate to="/catalog" replace />} />
        <Route path="/catalog" element={<Suspense>...<CatalogPage /></Suspense>} />
        <Route path="/catalog/:id" element={<Suspense>...<StorefrontProductPage /></Suspense>} />
        <Route path="/login" element={<Suspense>...<LoginPage /></Suspense>} />
        <Route path="/register" element={<Suspense>...<RegisterPage /></Suspense>} />
        <Route path="/forgot-password" element={<Suspense>...<ForgotPasswordPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense>...<ResetPasswordPage /></Suspense>} />
        <Route path="/cart" element={<Suspense>...<CartPage /></Suspense>} />
        <Route path="/checkout" element={<Suspense>...<CheckoutPage /></Suspense>} />
        <Route path="/order-confirmation/:id" element={<Suspense>...<OrderConfirmationPage /></Suspense>} />
        <Route path="/account/profile" element={<RequireCustomerAuth><Suspense>...<AccountProfilePage /></Suspense></RequireCustomerAuth>} />
        <Route path="/account/orders" element={<RequireCustomerAuth><Suspense>...<AccountOrdersPage /></Suspense></RequireCustomerAuth>} />
        <Route path="/account/orders/:id" element={<RequireCustomerAuth><Suspense>...<AccountOrderDetailPage /></Suspense></RequireCustomerAuth>} />
        <Route path="/account/wishlist" element={<RequireCustomerAuth><Suspense>...<AccountWishlistPage /></Suspense></RequireCustomerAuth>} />
        <Route path="/account/security/2fa" element={<RequireCustomerAuth><Suspense>...<TwoFactorSetupPage /></Suspense></RequireCustomerAuth>} />
      </Route>

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/" element={<RequireAdminAuth><Layout /></RequireAdminAuth>}>
        {/* existing admin routes */}
      </Route>
    </Routes>
  </AdminAuthProvider>
</BrowserRouter>
```

**Important:** `AdminAuthProvider` must wrap everything so the admin interceptor is registered before any `<Layout />` child tries to call an admin API. `CustomerAuthProvider` and `CartProvider` only need to wrap storefront routes.

---

## Phase C2 — Cart + Checkout Frontend (KAN-44)

### C2.1 · NEW `frontend/src/services/checkoutService.ts`

Service for checkout and coupon validation.

**Endpoints:**
- `POST /api/public/checkout/guest`
- `POST /api/public/checkout` (auth — requires `Authorization: Bearer`)
- `POST /api/public/coupons/validate`

**Error codes to map:**
- `VARIANT_NOT_FOUND` → "One or more items in your cart are no longer available."
- `COUPON_NOT_FOUND` → "Coupon code not found."
- `COUPON_EXHAUSTED` → "This coupon has reached its usage limit."
- `VALIDATION_ERROR` → "Please check your details and try again."

**Exports:** `checkoutService` object, `mapCheckoutError(code)`, `extractCheckoutError(error)`.

---

### C2.2 · NEW `frontend/src/components/storefront/AddressForm.tsx`

Reusable address form component used inside `CheckoutPage`.

**Props:**
```ts
type AddressFormProps = {
  value: AddressSnapshot;
  onChange: (snapshot: AddressSnapshot) => void;
  label?: string;         // e.g. "Shipping Address"
  disabled?: boolean;
};
```

Fields: Full Name, Phone (optional), Street Line 1, Street Line 2 (optional), City, Province/State, Postal Code, Country. All fields are controlled. Uses inline validation feedback.

---

### C2.3 · NEW `frontend/src/pages/storefront/CartPage.tsx`

Route: `/cart`.

**UI:**
- If cart is empty: "Your cart is empty" message + "Continue Shopping" → `/catalog`.
- Cart items list (table on desktop, stacked cards on mobile):
  - Product image, name, variant attributes, price, quantity input, remove button, line total.
  - Quantity input: number input with min=1; calls `updateQuantity()` on change.
  - Remove: calls `removeItem()`.
- Order summary sidebar (or bottom section on mobile):
  - Subtotal.
  - "Proceed to Checkout" → `/checkout`.
- Responsive at 360px: cards stacked, full-width buttons (min-height 44px, `.admin-touch-btn` pattern adapted for storefront).

**Notes:**
- Cart items display data comes from `CartItem` (captured at add-time). Prices are display-only here — server re-validates at checkout.
- No API calls on this page. Purely reads `useCart()`.

---

### C2.4 · NEW `frontend/src/pages/storefront/CheckoutPage.tsx`

Route: `/checkout`.

**Redirect guard:** On mount, if cart is empty, `<Navigate to="/cart" replace />`.

**Layout:** Linear single-page form (no multi-step wizard needed for MVP, keep it simple).

**Sections:**
1. **Order review:** Read-only summary of cart items (product name, variant, qty, price).
2. **Contact & Shipping:**
   - Guest path: Email, First Name, Last Name, Phone fields + `<AddressForm label="Shipping Address" />`.
   - Auth path: pre-populated from `useCustomerAuth().customer`; `<AddressForm>` still editable.
3. **Billing Address:**
   - Checkbox "Same as shipping" (default: checked). If unchecked, show second `<AddressForm label="Billing Address" />`.
4. **Coupon:**
   - Coupon code input + "Apply" button.
   - On apply: call `checkoutService.validateCoupon({ code, subtotalAmount })`.
   - Display discount amount if valid, error message if invalid.
5. **Order Summary:** Subtotal, discount (if coupon applied), shipping (€0 for MVP), total.
6. **Place Order button:**
   - Disabled while submitting.
   - Guest path: calls `checkoutService.createGuestOrder(guestCheckoutInput)`.
   - Auth path: calls `checkoutService.createAuthOrder(authCheckoutInput, accessToken)`.
   - On success: `clearCart()` then `navigate('/order-confirmation/<orderId>')`.
   - On error: display `extractCheckoutError(error)` in an `<Alert>`.

**Responsive:** Layout must work at 360px. Use Bootstrap grid: single column on `xs`, two columns (form + summary) on `md+`.

---

### C2.5 · NEW `frontend/src/pages/storefront/OrderConfirmationPage.tsx`

Route: `/order-confirmation/:id`.

**Behavior:**
- On mount, fetch `GET /api/public/account/orders/:id` if user is logged in, or use `location.state.order` (passed from `CheckoutPage` navigate call via `navigate('/order-confirmation/...', { state: { order } })`).
- For guest checkout, `CheckoutPage` passes the returned order data via navigate state to avoid requiring auth.

**UI:**
- Checkmark icon (SVG inline — no extra library).
- "Order Confirmed!" heading.
- Order number displayed prominently.
- Summary: items, total amount, shipping address.
- "Continue Shopping" → `/catalog`.
- If logged in: "View My Orders" → `/account/orders`.

**Security:** Do not render any supplier-internal fields.

---

### C2.6 · MODIFY `frontend/src/pages/storefront/ProductPage.tsx`

Wire the existing "Add to Cart" placeholder button to `CartContext`.

**Changes:**
1. Import `useCart` from `../../contexts/CartContext`.
2. Import `useNavigate` from `react-router-dom`.
3. Add local state `addedToCart: boolean` for brief feedback ("Added!" text for 2 seconds).
4. Replace the existing inert `<button>` with a handler:
   ```ts
   const handleAddToCart = () => {
     if (!selectedVariant) return;
     addItem({
       productVariantId: selectedVariant.id,
       quantity: 1,
       productId: product.id,
       productName: product.name,
       variantAttributes: selectedVariant.attributes ?? {},
       sku: selectedVariant.sku,
       publicPrice: selectedVariant.publicPrice,
       compareAtPrice: selectedVariant.compareAtPrice,
       imageUrl: product.images?.[0]?.url ?? null,
     });
     setAddedToCart(true);
     setTimeout(() => setAddedToCart(false), 2000);
   };
   ```
5. Disable the button if `!selectedVariant` (no variant selected).
6. Show `addedToCart ? 'Added to Cart ✓' : 'Add to Cart'` as button text.
7. Add `<WishlistButton productVariantId={selectedVariant?.id ?? 0} />` below the add-to-cart button (only render when `selectedVariant` is not null).

---

## Unit Tests Summary (Tasks A2.4, B4.4, C2.4)

### NEW `frontend/src/components/admin/__tests__/RequireAdminAuth.test.tsx`

Uses `jest.mock('../../../contexts/AdminAuthContext')`.

**Cases:**
1. Shows blank while `isLoading: true`.
2. Renders children when `admin` is set.
3. Navigates to `/admin/login` when `admin` is null.

---

### NEW `frontend/src/contexts/__tests__/AdminAuthContext.test.tsx`

Uses `axios-mock-adapter` or `jest.mock('axios')`.

**Cases:**
1. Silent refresh on mount succeeds → admin and token are set.
2. Silent refresh on mount fails → admin is null, `isLoading` becomes false.
3. `login()` sets admin and token.
4. `logout()` clears admin and token.

---

### NEW `frontend/src/pages/storefront/__tests__/LoginPage.test.tsx`

Mocks `useCustomerAuth`.

**Cases:**
1. Renders email and password fields.
2. Submit calls `login()`.
3. Shows error alert on rejected login.
4. Shows TOTP input when `mfaRequired` is returned.

---

### NEW `frontend/src/contexts/__tests__/CustomerAuthContext.test.tsx`

Similar to admin auth context test.

**Cases:**
1. Bootstraps from cookie on mount.
2. `login()` with credentials stores tokens.
3. `login()` returns `{ mfaRequired }` without setting session.
4. `verify2fa()` completes session.
5. `logout()` clears state.

---

### NEW `frontend/src/contexts/__tests__/CartContext.test.tsx`

**Cases:**
1. `addItem()` creates new line.
2. `addItem()` with existing variant increments quantity.
3. `removeItem()` removes the line.
4. `updateQuantity()` changes quantity.
5. `clearCart()` empties items.
6. State persists to localStorage.
7. Init reads from localStorage.

---

### NEW `frontend/src/pages/storefront/__tests__/CartPage.test.tsx`

Mocks `useCart`.

**Cases:**
1. Renders "cart is empty" when `items` is `[]`.
2. Renders cart items correctly.
3. Quantity change calls `updateQuantity()`.
4. Remove button calls `removeItem()`.
5. "Proceed to Checkout" link renders.

---

## Complete File List

### New files (all `.tsx` unless noted)

| File | Phase |
|------|-------|
| `frontend/src/types/auth.ts` | A2 |
| `frontend/src/services/adminAuthService.ts` | A2 |
| `frontend/src/contexts/AdminAuthContext.tsx` | A2 |
| `frontend/src/pages/AdminLoginPage.tsx` | A2 |
| `frontend/src/components/admin/RequireAdminAuth.tsx` | A2 |
| `frontend/src/components/admin/__tests__/RequireAdminAuth.test.tsx` | A2 |
| `frontend/src/contexts/__tests__/AdminAuthContext.test.tsx` | A2 |
| `frontend/src/services/customerAuthService.ts` | B4 |
| `frontend/src/services/wishlistService.ts` | B4 |
| `frontend/src/types/wishlist.ts` | B4 |
| `frontend/src/types/cart.ts` | C2 |
| `frontend/src/types/checkout.ts` | C2 |
| `frontend/src/contexts/CustomerAuthContext.tsx` | B4 |
| `frontend/src/contexts/CartContext.tsx` | C2 |
| `frontend/src/contexts/__tests__/CustomerAuthContext.test.tsx` | B4 |
| `frontend/src/contexts/__tests__/CartContext.test.tsx` | C2 |
| `frontend/src/pages/storefront/LoginPage.tsx` | B4 |
| `frontend/src/pages/storefront/RegisterPage.tsx` | B4 |
| `frontend/src/pages/storefront/ForgotPasswordPage.tsx` | B4 |
| `frontend/src/pages/storefront/ResetPasswordPage.tsx` | B4 |
| `frontend/src/pages/storefront/AccountProfilePage.tsx` | B4 |
| `frontend/src/pages/storefront/AccountOrdersPage.tsx` | B4 |
| `frontend/src/pages/storefront/AccountOrderDetailPage.tsx` | B4 |
| `frontend/src/pages/storefront/AccountWishlistPage.tsx` | B4 |
| `frontend/src/pages/storefront/TwoFactorSetupPage.tsx` | B4 |
| `frontend/src/pages/storefront/CartPage.tsx` | C2 |
| `frontend/src/pages/storefront/CheckoutPage.tsx` | C2 |
| `frontend/src/pages/storefront/OrderConfirmationPage.tsx` | C2 |
| `frontend/src/pages/storefront/__tests__/LoginPage.test.tsx` | B4 |
| `frontend/src/pages/storefront/__tests__/CartPage.test.tsx` | C2 |
| `frontend/src/components/storefront/OAuthButtons.tsx` | B4 |
| `frontend/src/components/storefront/RequireCustomerAuth.tsx` | B4 |
| `frontend/src/components/storefront/WishlistButton.tsx` | B4 |
| `frontend/src/components/storefront/AddressForm.tsx` | C2 |
| `frontend/src/services/checkoutService.ts` | C2 |

### Modified files

| File | What changes |
|------|-------------|
| `frontend/src/App.tsx` | Providers wrap, new admin + storefront routes |
| `frontend/src/components/Layout.tsx` | Logout button + admin email display |
| `frontend/src/components/storefront/StorefrontHeader.tsx` | Cart count badge + account icon link |
| `frontend/src/pages/storefront/ProductPage.tsx` | Wire Add to Cart + WishlistButton |

---

## Critical Notes for Implementor

1. **`withCredentials: true` on every auth call.** The refresh cookie is httpOnly and sameSite; it will not be sent unless `withCredentials` is set on the axios request.

2. **Axios interceptor cleanup.** Both `AdminAuthContext` and `CustomerAuthContext` (if it uses one) must eject their interceptors in the `useEffect` cleanup to prevent double-registration on React StrictMode double-mount.

3. **Token in state, not localStorage.** `accessToken` lives only in React state. The httpOnly cookie maintains the session across page reloads via the silent refresh on mount. This is intentional — no XSS exposure.

4. **`isLoading` guard in both route guards.** Without the `isLoading` guard, a hard page refresh always briefly redirects to the login page before the silent refresh completes.

5. **Supplier field suppression.** `AccountOrderDetailPage` and `OrderConfirmationPage` must never render `supplierId`, `supplierCost`, `supplierReference`, or fulfillment notes — even if those fields appear in the API response type. Do not add them to the display JSX.

6. **Cart snapshot data.** `CartItem` captures `publicPrice` and display metadata at add-time for local display on `CartPage`. At checkout time, the server re-validates all prices from the DB — the client-side price is only for display, never authoritative.

7. **MFA login flow.** `LoginPage` must handle two states: (a) normal credential form → calls `login()`, (b) TOTP input → calls `verify2fa(mfaToken, totpCode)`. The `mfaToken` is a short-lived token returned by the server to bridge the two calls.

8. **Guest vs. auth checkout.** `CheckoutPage` detects auth state from `useCustomerAuth()`. If `account !== null`, it calls `checkoutService.createAuthOrder()` with the `accessToken`; otherwise calls `checkoutService.createGuestOrder()` (no token needed).

9. **`CustomerAuthProvider` + `CartProvider` placement.** Both must be inside `<BrowserRouter>` (to use `useNavigate`) and must wrap the `<StorefrontLayout />` route element, not the global root — admin routes must not be wrapped in them.

10. **`AdminAuthProvider` placement.** Must wrap the entire `<Routes>` tree (inside `<BrowserRouter>`) so the admin interceptor is in place before any admin child component mounts and makes API calls.

11. **OAuth callback.** OAuth buttons link to `GET /api/public/auth/{provider}` which is a server redirect. On callback success, the backend sets the refresh cookie and redirects to a storefront URL (e.g., `/catalog`). `CustomerAuthProvider`'s `useEffect` will pick up the session on next mount via silent refresh. No special frontend OAuth callback route is needed.

12. **Design tokens only.** All storefront pages and new storefront components must use CSS custom properties from `frontend/src/styles/tokens.css` (e.g., `var(--color-near-black)`, `var(--spacing-4)`) for colors and spacing. Do not use hardcoded hex values.

13. **React Bootstrap only for admin pages.** `AdminLoginPage` uses React Bootstrap `<Form>`, `<Card>`, `<Button>`, `<Alert>`. Storefront pages (Login, Register, Checkout, etc.) follow the existing storefront CSS approach with custom CSS classes and design tokens — not Bootstrap Cards.

14. **Responsive at 360px.** `CartPage` and `CheckoutPage` must be verified at 360px minimum width. Use Bootstrap grid `Col xs={12}` and inline `minHeight: 44px` on tap targets per the storefront standards.
