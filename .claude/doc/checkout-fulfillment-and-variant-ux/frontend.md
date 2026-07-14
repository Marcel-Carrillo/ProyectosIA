# Frontend Implementation Plan — checkout-fulfillment-and-variant-ux

Scope: OpenSpec `tasks.md` frontend groups **3** (Stock-Aware Selector + Gallery), **5** (Checkout Prefill/Clone/Save-Default), **7** (Admin Margin Breakdown UI), **11** (Admin Alert/Failure List). Backend groups (1,2,4,6,8,9,10) are out of scope for this doc but their response shapes are assumed below — flagged where uncertain.

Skills/docs loaded: `docs/base-standards.md`, `docs/frontend-standards.md`, `docs/api-spec.yml` (relevant sections), `docs/openspec-tasks-mandatory-steps.md`, `ai-specs/agents/frontend-developer.md`, plus the change's `design.md`, `tasks.md`, and `specs/{checkout-mvp,product-detail,customer-account-authentication,shipping-margin-guardrail,fulfillment-automation,product-variant-management}/spec.md`.

---

## Flags for the parent session (read before implementing)

1. **ProductGallery "no dedicated photo" fallback is a real behavior CHANGE from the just-merged commit `aa48c4a`, not just an add-on.** Current code (`ProductGallery.tsx:42-48`) resets the hero image to index `0` whenever the selected color has no dedicated photo. The new `product-detail` delta spec's scenario "Main image is unchanged when the selected color has no dedicated photo" and `tasks.md` 3.3 ("falling back to **the current image** if none matches") both require **keeping whatever image was already showing**, not resetting to index 0. Section 1 below gives the exact new effect logic (uses a `prevImagesRef` to distinguish "color changed on the same product" from "product changed") and flags which existing tests in `ProductGallery.test.tsx` must be rewritten because they assert the old reset-to-0 behavior combined with thumbnail color-filtering that no longer exists.
2. **`docs/frontend-standards.md`'s "Admin UI must never render supplierCost" line is already stale, not newly violated.** `VariantTable.tsx` already renders `supplierCost` and a cost-based `Margin` in a "Coste de proveedor" column today, and `adminProductService.ts:58-61` already documents this as intentional ("the admin API returns them for margin visibility"). This change's margin-breakdown column extends that existing, already-shipped pattern — it does not introduce a new exposure. No action needed beyond the doc refresh already required by `tasks.md` 16.4.
3. **Checkout address form field set is being widened.** The current `CheckoutPage.tsx` `emptyAddress` has only 6 fields (`fullName`, `streetLine1`, `city`, `province`, `postalCode`, `country`) — no `phone`, no `streetLine2`. The self-service `CustomerAddress` model (per `customer-account-authentication` spec and `docs/api-spec.yml:5042`) has both as optional fields, and the checkout-mvp spec's "profile-only prefill" scenario explicitly requires prefilling `phone` from the buyer's profile. Section 2 below adds `phone` and `streetLine2` as optional fields to both the shipping and billing sections (for guest and authenticated buyers alike, so "usar mismos datos" cloning stays a straight object copy). This is a scope decision, not explicitly spelled out field-by-field in `design.md` — confirm it reads correctly against the store owner's expectations before shipping copy.
4. **No `CheckoutPage` test file exists today.** `tasks.md` 5.6 says "update/add" — there is nothing to update. Section 2 specifies a new `frontend/src/pages/storefront/__tests__/CheckoutPage.test.tsx`.
5. **Margin-breakdown field names are proposed, not confirmed against a backend plan** (none existed in `.claude/doc/checkout-fulfillment-and-variant-ux/` at research time). Section 3 uses `shippingCostEstimate`, `netMargin`, `shippingEstimateMissing`, `belowTargetMargin` — reconcile these exact names with whatever the backend implementer ships for task 6.1/6.3 before wiring `VariantTable.tsx`.
6. **No admin UI exists (or is planned in any frontend task group) for setting `isDefault` on an address via the existing admin `/api/admin/customers/:customerId/addresses/*` screens.** Task 4.5 (backend) adds `isDefault` support to those admin endpoints, but no frontend task asks for an admin-side toggle. This plan does not add one (out of my assigned groups) — flagging so it isn't assumed to exist.
7. **Task 11 (admin alert list) response shape is likewise unconfirmed** (design.md Open Question #3 — table not yet decided). Section 4 proposes a concrete contract and a dedicated new page mirroring `ShipmentsPage.tsx`; reconcile field names with the backend implementation of task 10.2 before wiring `fulfillmentAlertService.ts`.

---

## Group 3 — Stock-Aware Variant Selector + Main-Image-Only Gallery

### 3.1 `frontend/src/types/product.ts`

Add `stockQuantity` to `ProductVariant` (both admin and public variant responses will include it per backend tasks 2.3/2.4, so it's a required, not optional, field):

```typescript
export interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  size: string | null;
  color: string | null;
  publicPrice: number;
  compareAtPrice: number | null;
  stockPolicy: StockPolicy;
  status: ProductVariantStatus;
  stockQuantity: number;              // NEW — synced from CjCatalogItem; 0 when unmapped
  // Supplier sourcing data returned only by /api/admin variant endpoints.
  supplierId?: number | null;
  supplierReference?: string | null;
  supplierCost?: number | null;
  supplierName?: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Place it right after `status`, before the supplier block, to keep the "public-safe fields first" grouping already implied by the comment above the supplier fields.

Do **not** add `stockQuantity` to `CreateVariantInput`/`UpdateVariantInput` — per `product-variant-management` spec it is never client-settable.

### 3.2 `frontend/src/components/storefront/VariantSelector.tsx`

One-line logic change. Current (`VariantSelector.tsx:61-62`):

```typescript
const isCombinationAvailable = (size: string | null, color: string | null): boolean =>
  active.some((v) => v.size === size && v.color === color);
```

New:

```typescript
const isCombinationAvailable = (size: string | null, color: string | null): boolean =>
  active.some((v) => v.size === size && v.color === color && v.stockQuantity > 0);
```

No other change needed. `active` already filters `!v.deletedAt` (`getActiveVariants`, line 10-12) — do **not** additionally filter by `status === 'Active'` here: the public product-detail API (`backend/src/presentation/serializers/publicProduct.ts:79-81`) already filters variants to `status === 'Active'` server-side before they ever reach this component, so a client-side status filter would be redundant. This matches the delta spec's "non-deleted, Active variant" wording — the "Active" half is already guaranteed upstream.

The disabled/`aria-label` rendering (lines 68-114) is untouched — `available` already flows into `disabled={!available}` and the `aria-label` unavailable suffix for both size and color buttons.

### 3.3 `frontend/src/components/storefront/ProductGallery.tsx`

Full replacement of the filtering/effect logic (lines 1-52). Key changes:
- `displayed` is now always the full sorted `images[]` — no color filtering, no empty-filter fallback (that fallback branch is now dead code since there's nothing to fall back from).
- The hero-image effect must distinguish "the product itself changed" (reset like before) from "only the selected color changed on the same product" (preserve the current index when the new color has no dedicated photo), using a ref to track the previous `images` array reference.

```tsx
import React, { useState, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductImage } from '../../types/product';

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
  selectedColor?: string | null;
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"%3E%3Crect width="600" height="800" fill="%23ebebeb"/%3E%3Cpath d="M260 320 h80 v40 h40 l-80 120 -80-120 h40z" fill="%239a9a9a"/%3E%3C/svg%3E';

const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName, selectedColor }) => {
  const { t } = useTranslation('product');
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  // Thumbnail strip ALWAYS shows the full, sorted image set regardless of the
  // selected color — only the hero/main image reacts to color (product-detail
  // spec: "Selecting a color changes only the main gallery image").
  const displayed = sorted;

  const [activeIdx, setActiveIdx] = useState(0);

  // Tracks the previous `images` array reference so the effect below can tell
  // "the product changed" (images reference changed — reset the hero image)
  // apart from "only the color changed on the same product" (images
  // reference unchanged — preserve whatever hero image was already showing
  // when the newly selected color has no dedicated photo).
  const prevImagesRef = useRef(images);

  // useLayoutEffect (not useEffect) so the reset/preserve is applied before
  // the browser paints — avoids a one-frame flash of a stale index.
  useLayoutEffect(() => {
    const imagesChanged = prevImagesRef.current !== images;
    prevImagesRef.current = images;

    const colorIdx = selectedColor != null ? displayed.findIndex((img) => img.color === selectedColor) : -1;

    if (colorIdx >= 0) {
      // The selected color has its own photo — always switch to it.
      setActiveIdx(colorIdx);
    } else if (imagesChanged) {
      // New product and no color match (or no color selected) — start at 0.
      setActiveIdx(0);
    }
    // else: same product, selected color has no dedicated photo — leave the
    // hero image exactly as it was (spec: "the main image remains whatever
    // it was before the selection, and no thumbnail is hidden or removed").
    // `displayed` is intentionally omitted from deps: it's a new array every
    // render (from .sort()), so including it would re-run this on every
    // render instead of only when `images`/`selectedColor` actually change.
  }, [selectedColor, images]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeImage = displayed[activeIdx] ?? null;
  const mainSrc = activeImage?.url ?? PLACEHOLDER_IMG;
  const mainAlt = activeImage?.altText || productName;

  return (
    <div className="storefront-gallery">
      <div className="storefront-gallery__main">
        <img src={mainSrc} alt={mainAlt} />
      </div>
      {displayed.length > 1 && (
        <div className="storefront-gallery__thumbs" role="list" aria-label={t('gallery.imagesLabel')}>
          {displayed.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              role="listitem"
              aria-label={img.altText || t('gallery.imageN', { n: idx + 1 })}
              aria-current={idx === activeIdx ? 'true' : undefined}
              onClick={() => setActiveIdx(idx)}
              className={`storefront-gallery__thumb${idx === activeIdx ? ' storefront-gallery__thumb--active' : ''}`}
            >
              <img src={img.url} alt={img.altText || t('gallery.thumbAlt', { name: productName, n: idx + 1 })} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
```

No i18n keys change (`gallery.imagesLabel`, `gallery.imageN`, `gallery.thumbAlt` already exist and are unaffected).

### 3.4 `frontend/src/components/storefront/VariantSelector.test.tsx`

Extend the `variants` fixture with `stockQuantity` on every `makeVariant(...)` call (required field now — TS will fail to compile without it). Add `stockQuantity` as a parameter:

```typescript
const makeVariant = (
  id: number,
  size: string | null,
  color: string | null,
  deleted = false,
  stockQuantity = 5
): ProductVariant => ({
  id,
  productId: 1,
  sku: `SKU-${id}`,
  size,
  color,
  publicPrice: 49.99,
  compareAtPrice: null,
  stockPolicy: 'SupplierManaged',
  status: 'Active',
  stockQuantity,
  deletedAt: deleted ? '2026-01-01T00:00:00Z' : null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});
```

Add a new `describe('VariantSelector stock availability', ...)` block covering the exact scenario in `product-detail` spec + `tasks.md` 3.4 (S/M/L, 3 colors, one S+color combo at zero stock):

```typescript
describe('VariantSelector stock availability', () => {
  const stockVariants: ProductVariant[] = [
    makeVariant(1, 'S', 'Black', false, 5),
    makeVariant(2, 'S', 'White', false, 0),   // zero stock
    makeVariant(3, 'S', 'Blue', false, 3),
    makeVariant(4, 'M', 'Black', false, 5),
  ];

  it('disables a color with zero stock for the selected size, leaving others selectable', () => {
    renderWithI18n(<VariantSelector variants={stockVariants} onVariantChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/Size S/));
    expect(screen.getByLabelText(/Color White \(unavailable\)/i)).toBeDisabled();
    expect(screen.getByLabelText(/Color Black/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/Color Blue/i)).not.toBeDisabled();
  });

  it('does not call onVariantChange with a zero-stock variant', () => {
    const onChange = vi.fn();
    renderWithI18n(<VariantSelector variants={stockVariants} onVariantChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Size S/));
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'White' }));
  });
});
```

(Uses `renderWithI18n`, already imported in the existing file — no new import needed beyond what's there.)

### 3.5 `frontend/src/components/storefront/ProductGallery.test.tsx`

This file needs the heaviest rewrite in Group 3: the entire `describe('ProductGallery color filtering', ...)` block (current lines 32-106) asserts thumbnail-count filtering and the reset-to-0 fallback, both of which are gone. Replace it with:

```typescript
describe('ProductGallery — thumbnail strip is unaffected by color', () => {
  it('shows the full image list in the thumbnail strip regardless of selected color', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
    // Blue's photo is still present even though Red is selected.
    expect(screen.getByAltText('Blue detail 1')).toBeInTheDocument();
  });

  it('renders the full list unchanged when selectedColor is not provided', () => {
    render(<ProductGallery images={colorImages} productName="Dress" />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders the full list unchanged when selectedColor is explicitly null', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor={null} />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
  });
});

describe('ProductGallery — main image follows the selected color', () => {
  it('shows the selected colors own photo as the main image, not the shared photo', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);
    const main = screen.getAllByRole('img')[0];
    expect(main).toHaveAttribute('alt', 'Red detail 1');
    expect(main).toHaveAttribute('src', 'https://cdn.example.com/red-1.jpg');
  });

  it('defaults to the shared (sortOrder 0) image on first mount when the selected color has no dedicated photo', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Green" />);
    const main = screen.getAllByRole('img')[0];
    expect(main).toHaveAttribute('alt', 'Shared front');
  });

  it('switches the main image when selectedColor changes to a color with its own photo', () => {
    const { rerender } = render(
      <ProductGallery images={colorImages} productName="Dress" selectedColor="Blue" />
    );
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue detail 1');

    rerender(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Red detail 1');
  });

  it('REGRESSION: keeps the current main image when selectedColor changes to a color with no dedicated photo', () => {
    // This is the behavior this change introduces — differs from the
    // previously-merged "reset to index 0" fallback.
    const { rerender } = render(
      <ProductGallery images={colorImages} productName="Dress" selectedColor="Blue" />
    );
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue detail 1');

    // Green has no dedicated photo — main image must stay on Blue's photo,
    // not reset to the shared (sortOrder 0) image.
    rerender(<ProductGallery images={colorImages} productName="Dress" selectedColor="Green" />);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue detail 1');
  });

  it('clicking a thumbnail still overrides the main image directly, regardless of selected color', () => {
    render(<ProductGallery images={colorImages} productName="Dress" selectedColor="Red" />);
    const thumbs = within(screen.getByRole('list')).getAllByRole('listitem');
    fireEvent.click(thumbs[0]!); // shared/front thumbnail
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Shared front');
  });

  it('resets to the new products own hero image when the images prop itself changes (product navigation)', () => {
    const otherProductImages: ProductImage[] = [
      { id: 20, productId: 2, url: 'https://cdn.example.com/other.jpg', altText: 'Other product', sortOrder: 0, color: null, createdAt: '2026-01-01T00:00:00Z' },
    ];
    const { rerender } = render(
      <ProductGallery images={colorImages} productName="Dress" selectedColor="Blue" />
    );
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Blue detail 1');

    // Simulate navigating to a different product: new images array, color
    // that doesn't exist on the new product at all.
    rerender(<ProductGallery images={otherProductImages} productName="Other" selectedColor="Blue" />);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('alt', 'Other product');
  });
});
```

The first two top-level `it()`s (lines 12-22, altText fallback) and the `colorImages` fixture (lines 25-30) are unchanged — keep them.

### 3.6 Lint check

Run `cd frontend && npx eslint src --ext .ts,.tsx` after these edits (mandatory per CI `frontend-quality` and `ai-specs/agents/frontend-developer.md`'s RTL/ESLint standards). Both new test blocks use `render`/`fireEvent`/`screen.getByRole`/`getAllByRole` synchronously (no async state settling needed since `useLayoutEffect` runs before RTL's `render()` returns), so no `findBy*` requirement applies here — `prefer-find-by` only fires when combining `waitFor` + `getBy*`, which these tests don't do.

---

## Group 5 — Checkout Prefill, "Usar Mismos Datos", Save-as-Default

### 5.1 `frontend/src/services/addressService.ts` (NEW FILE)

Mirrors the `reviewService.ts` pattern (object export, `authHeaders()` via `getCustomerAccessToken`, try/catch + `console.error`, `ACCOUNT_BASE` constant). Types are defined inline in this file (not added to the admin-focused `frontend/src/types/customer.ts`, to keep the self-service surface decoupled from the admin `CustomerAddress` type per the existing project convention of separate service files for admin vs. public/self-service resources — see `docs/frontend-standards.md` "CJ connection admin panel patterns" for the precedent of a sibling, not-shared, service+type pair).

```typescript
import axios, { AxiosError } from 'axios';
import { getCustomerAccessToken } from './customerAuthService';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const ACCOUNT_ADDRESSES_BASE = `${API_BASE}/api/public/account/addresses`;

export type SelfServiceAddressType = 'Shipping' | 'Billing';

export interface SelfServiceCustomerAddress {
  id: number;
  type: SelfServiceAddressType;
  isDefault: boolean;
  fullName: string;
  phone: string | null;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSelfServiceAddressInput {
  type: SelfServiceAddressType;
  fullName: string;
  phone?: string;
  streetLine1: string;
  streetLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export type UpdateSelfServiceAddressInput = Partial<CreateSelfServiceAddressInput>;

function authHeaders() {
  const token = getCustomerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function mapAddressError(code: string): string {
  switch (code) {
    case 'ADDRESS_NOT_FOUND':
      return 'Address not found.';
    case 'VALIDATION_ERROR':
      return 'Please check the address fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractAddressErrorCode(error: unknown): string {
  return (error as AxiosError<{ error?: { code?: string } }>).response?.data?.error?.code ?? 'UNKNOWN_ERROR';
}

export const addressService = {
  /** GET /api/public/account/addresses — requires customer auth. */
  list: async (): Promise<SelfServiceCustomerAddress[]> => {
    try {
      const response = await axios.get<{ data: SelfServiceCustomerAddress[] }>(
        ACCOUNT_ADDRESSES_BASE,
        { headers: authHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching saved addresses:', error);
      throw error;
    }
  },

  /** POST /api/public/account/addresses — requires customer auth. */
  create: async (input: CreateSelfServiceAddressInput): Promise<SelfServiceCustomerAddress> => {
    try {
      const response = await axios.post<{ data: SelfServiceCustomerAddress }>(
        ACCOUNT_ADDRESSES_BASE,
        input,
        { headers: authHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error creating saved address:', error);
      throw error;
    }
  },

  /** PATCH /api/public/account/addresses/:id — requires customer auth. */
  update: async (id: number, input: UpdateSelfServiceAddressInput): Promise<SelfServiceCustomerAddress> => {
    try {
      const response = await axios.patch<{ data: SelfServiceCustomerAddress }>(
        `${ACCOUNT_ADDRESSES_BASE}/${id}`,
        input,
        { headers: authHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error updating saved address:', error);
      throw error;
    }
  },

  /** DELETE /api/public/account/addresses/:id — requires customer auth. */
  remove: async (id: number): Promise<void> => {
    try {
      await axios.delete(`${ACCOUNT_ADDRESSES_BASE}/${id}`, { headers: authHeaders() });
    } catch (error) {
      console.error('Error deleting saved address:', error);
      throw error;
    }
  },
};
```

### 5.2–5.4 `frontend/src/pages/storefront/CheckoutPage.tsx`

**State shape changes:**

```typescript
const emptyAddress = {
  fullName: '',
  phone: '',          // NEW — optional; CustomerAddress.phone
  streetLine1: '',
  streetLine2: '',     // NEW — optional; CustomerAddress.streetLine2
  city: '',
  province: '',
  postalCode: '',
  country: 'Spain',
};

const OPTIONAL_ADDRESS_FIELDS = new Set<keyof typeof emptyAddress>(['phone', 'streetLine2']);

function addressToFormState(addr: SelfServiceCustomerAddress) {
  return {
    fullName: addr.fullName,
    phone: addr.phone ?? '',
    streetLine1: addr.streetLine1,
    streetLine2: addr.streetLine2 ?? '',
    city: addr.city,
    province: addr.province,
    postalCode: addr.postalCode,
    country: addr.country,
  };
}
```

New imports: `import { addressService, SelfServiceCustomerAddress } from '../../services/addressService';`

New component state (added alongside existing `shipping`/`billing`):

```typescript
const [sameAsShipping, setSameAsShipping] = useState(false);
const [saveShippingDefault, setSaveShippingDefault] = useState(false);
const [saveBillingDefault, setSaveBillingDefault] = useState(false);
```

**5.2 — Prefill effect** (new `useEffect`, added near the existing Stripe-config effect):

```typescript
useEffect(() => {
  if (!isAuthenticated || !customer) return;

  // Baseline: profile-only prefill (name + phone), address fields stay empty.
  const profileOnly = {
    ...emptyAddress,
    fullName: `${customer.firstName} ${customer.lastName}`.trim(),
    phone: customer.phone ?? '',
  };
  setShipping(profileOnly);
  setBilling(profileOnly);

  let cancelled = false;
  addressService
    .list()
    .then((addresses) => {
      if (cancelled) return;
      const defaultShipping = addresses.find((a) => a.type === 'Shipping' && a.isDefault);
      const defaultBilling = addresses.find((a) => a.type === 'Billing' && a.isDefault);
      if (defaultShipping) setShipping(addressToFormState(defaultShipping));
      if (defaultBilling) setBilling(addressToFormState(defaultBilling));
    })
    .catch(() => {
      // Prefill is a convenience, not a checkout blocker — keep the
      // profile-only baseline already applied above on failure.
    });
  return () => {
    cancelled = true;
  };
}, [isAuthenticated, customer]);
```

Guest buyers never run this effect (`isAuthenticated` false) — their forms stay at `emptyAddress`, per the "Guest buyer sees empty forms" scenario.

**5.3 — "usar mismos datos" clone effect + control:**

```typescript
useEffect(() => {
  if (sameAsShipping) setBilling(shipping);
}, [sameAsShipping, shipping]);
```

Render, inside the billing `<section>`, before the field grid:

```tsx
<label className="storefront-checkout__toggle">
  <input
    type="checkbox"
    checked={sameAsShipping}
    onChange={(e) => setSameAsShipping(e.target.checked)}
    data-testid="checkbox-same-as-shipping"
  />
  <span>{t('useSameData')}</span>
</label>
```

Billing field inputs get `disabled={sameAsShipping}` added (so a user can't silently edit a field that will be overwritten on the next shipping edit — decision, not explicitly mandated by the spec scenarios, but the standard UX for this pattern; flag for confirmation if the store owner wants billing left independently editable while the toggle is on).

**Field render loop change (both shipping and billing sections):** replace the unconditional `required` with:

```tsx
{(Object.keys(emptyAddress) as Array<keyof typeof emptyAddress>).map((key) => (
  <label className="storefront-field" key={key}>
    <span className="storefront-field__label">{t(`field.${key}`)}</span>
    <input
      className="storefront-field__input"
      value={shipping[key]}
      onChange={(e) => setShipping({ ...shipping, [key]: e.target.value })}
      required={!OPTIONAL_ADDRESS_FIELDS.has(key)}
    />
  </label>
))}
```

(same for billing, with `billing`/`setBilling` and the added `disabled={sameAsShipping}`).

**5.4 — "save as default" checkboxes** (only for authenticated buyers), rendered right after each section's field grid:

```tsx
{isAuthenticated && (
  <label className="storefront-checkout__toggle">
    <input
      type="checkbox"
      checked={saveShippingDefault}
      onChange={(e) => setSaveShippingDefault(e.target.checked)}
      data-testid="checkbox-save-shipping-default"
    />
    <span>{t('saveAsDefault')}</span>
  </label>
)}
```

(mirrored for billing with `saveBillingDefault` / `checkbox-save-billing-default`).

**Persisting on successful checkout** — hook into `handlePaymentSuccess` (checkout "succeeds" means payment confirmed, not just the details-step order creation), make it `async`, await the saves before navigating so failures are caught but never block navigation:

```typescript
const handlePaymentSuccess = async () => {
  if (isAuthenticated) {
    const saves: Promise<unknown>[] = [];
    if (saveShippingDefault) {
      saves.push(
        addressService
          .create({
            type: 'Shipping',
            isDefault: true,
            fullName: shipping.fullName,
            phone: shipping.phone || undefined,
            streetLine1: shipping.streetLine1,
            streetLine2: shipping.streetLine2 || undefined,
            city: shipping.city,
            province: shipping.province,
            postalCode: shipping.postalCode,
            country: shipping.country,
          })
          .catch((err) => console.error('Failed to save shipping address as default:', err))
      );
    }
    if (saveBillingDefault) {
      const billingSource = sameAsShipping ? shipping : billing;
      saves.push(
        addressService
          .create({
            type: 'Billing',
            isDefault: true,
            fullName: billingSource.fullName,
            phone: billingSource.phone || undefined,
            streetLine1: billingSource.streetLine1,
            streetLine2: billingSource.streetLine2 || undefined,
            city: billingSource.city,
            province: billingSource.province,
            postalCode: billingSource.postalCode,
            country: billingSource.country,
          })
          .catch((err) => console.error('Failed to save billing address as default:', err))
      );
    }
    await Promise.all(saves);
  }
  clearCart();
  navigate(`/order-confirmation/${pendingOrder!.orderNumber}`, {
    state: { order: pendingOrder, paymentStatus: 'processing' },
  });
};
```

`PaymentForm`'s `onSuccess` prop already accepts this handler by reference (`onSuccess={handlePaymentSuccess}` at line 118) — an async function assigned there is fine since the prop type is presumably `() => void`; confirm `PaymentForm.tsx`'s `onSuccess` prop type isn't declared as strictly synchronous (`() => void` accepts an async function passed positionally with no await on the caller's side, which is fine here since `PaymentForm` doesn't need to await it).

`shippingAddressSnapshot`/`billingAddressSnapshot` sent to `POST /api/public/checkout*` (in `handleDetailsSubmit`) are unaffected — they already spread the full `shipping`/`billing` objects, which now simply include the two new optional keys (harmless extra fields; `CheckoutPayload.shippingAddressSnapshot` is typed `Record<string, string>`).

### 5.5 i18n keys — `frontend/src/i18n/locales/{en,es}/checkout.json`

Add to both files:

```json
{
  "useSameData": "Use the same data for billing",
  "saveAsDefault": "Save as my default address",
  "field": {
    "phone": "Phone",
    "streetLine2": "Apartment, suite, etc. (optional)"
  }
}
```

(`field.phone`/`field.streetLine2` merge into the existing `field` object — do not replace it.) Spanish equivalents for `es/checkout.json`:

```json
{
  "useSameData": "Usar los mismos datos para la facturación",
  "saveAsDefault": "Guardar como mi dirección predeterminada",
  "field": {
    "phone": "Teléfono",
    "streetLine2": "Piso, puerta, etc. (opcional)"
  }
}
```

`tasks.md` 5.5 also lists a `savedAddresses` key — there is no scenario in `checkout-mvp` spec that requires a visible "using saved address" indicator, so treat it as optional polish, not a hard requirement. If added, suggest:

```json
"savedAddresses": {
  "shippingApplied": "Prefilled from your saved shipping address",
  "billingApplied": "Prefilled from your saved billing address"
}
```

rendered as a small muted note under each section title when `addressService.list()` found a matching default (track with a local `boolean` per section, e.g. `shippingPrefilledFromDefault`). This is optional — skip if time-constrained, since no spec scenario depends on it.

### 5.6 `frontend/src/pages/storefront/__tests__/CheckoutPage.test.tsx` (NEW FILE)

Mock pattern follows `AccountOrdersPage.test.tsx` (mock `useCustomerAuth` from `../../../contexts/CustomerAuthContext`) plus mock `addressService`, `checkoutService`, `paymentService`, and `@stripe/react-stripe-js`/`@stripe/stripe-js` (per `docs/frontend-standards.md` "Testing Stripe Components"). Seed the cart via `localStorage.setItem('storefront_cart', JSON.stringify([...]))` before render (per `CartContext.tsx:17-24` `loadCart()`), since `CheckoutPage` redirects to `/cart` when `items.length === 0`.

```typescript
import { vi } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { CartProvider } from '../../../contexts/CartContext';

const mockList = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../../services/addressService', () => ({
  addressService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

vi.mock('../../../services/paymentService', () => ({
  getStripeConfig: vi.fn().mockResolvedValue({ publishableKey: 'pk_test_123' }),
}));

vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn().mockResolvedValue({}) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

let mockIsAuthenticated = false;
let mockCustomer: { firstName: string; lastName: string; email: string; phone?: string | null } | null = null;

vi.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ isAuthenticated: mockIsAuthenticated, customer: mockCustomer }),
}));

// eslint-disable-next-line import/first -- must load after vi.mock() calls above
import CheckoutPage from '../CheckoutPage';

function seedCart() {
  localStorage.setItem('storefront_cart', JSON.stringify([
    { productVariantId: 1, quantity: 1, productName: 'Dress', publicPrice: '29.99' },
  ]));
}

function renderPage() {
  return renderWithI18n(
    <MemoryRouter>
      <CartProvider>
        <CheckoutPage />
      </CartProvider>
    </MemoryRouter>,
    { lng: 'en' }
  );
}

describe('CheckoutPage — prefill', () => {
  beforeEach(() => {
    localStorage.clear();
    seedCart();
    vi.clearAllMocks();
  });

  it('prefills shipping and billing from the buyer default addresses', async () => {
    mockIsAuthenticated = true;
    mockCustomer = { firstName: 'Ana', lastName: 'García', email: 'ana@example.com', phone: '+34600000000' };
    mockList.mockResolvedValue([
      { id: 1, type: 'Shipping', isDefault: true, fullName: 'Ana García', phone: '+34600000000', streetLine1: 'Calle 1', streetLine2: null, city: 'Madrid', province: 'Madrid', postalCode: '28001', country: 'Spain', createdAt: '', updatedAt: '' },
      { id: 2, type: 'Billing', isDefault: true, fullName: 'Ana García SL', phone: null, streetLine1: 'Calle 2', streetLine2: null, city: 'Madrid', province: 'Madrid', postalCode: '28002', country: 'Spain', createdAt: '', updatedAt: '' },
    ]);
    renderPage();
    expect(await screen.findByDisplayValue('Calle 1')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Calle 2')).toBeInTheDocument();
  });

  it('falls back to profile-only prefill when no default address exists', async () => {
    mockIsAuthenticated = true;
    mockCustomer = { firstName: 'Ana', lastName: 'García', email: 'ana@example.com', phone: '+34600000000' };
    mockList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByDisplayValue('Ana García')).toBeInTheDocument();
    // Address fields stay empty:
    expect(screen.getAllByDisplayValue('').length).toBeGreaterThan(0);
  });

  it('leaves guest forms empty with no server-sourced prefill', async () => {
    mockIsAuthenticated = false;
    mockCustomer = null;
    renderPage();
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe('CheckoutPage — usar mismos datos', () => {
  beforeEach(() => {
    localStorage.clear();
    seedCart();
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    mockCustomer = null;
    mockList.mockResolvedValue([]);
  });

  it('mirrors shipping into billing while enabled and keeps mirroring on further edits', async () => {
    renderPage();
    const shippingStreet = (await screen.findAllByLabelText(/street address/i))[0] as HTMLInputElement;
    fireEvent.change(shippingStreet, { target: { value: 'Gran Vía 1' } });

    fireEvent.click(screen.getByTestId('checkbox-same-as-shipping'));
    const billingStreet = screen.getAllByLabelText(/street address/i)[1] as HTMLInputElement;
    expect(billingStreet.value).toBe('Gran Vía 1');

    fireEvent.change(shippingStreet, { target: { value: 'Gran Vía 2' } });
    expect(billingStreet.value).toBe('Gran Vía 2');
  });
});

describe('CheckoutPage — save as default', () => {
  it('does not call addressService.create when save-as-default is left unchecked', async () => {
    // Exercise handleDetailsSubmit + payment success without checking the
    // save-as-default boxes; assert mockCreate is never called. Requires
    // mocking checkoutService.authenticatedCheckout/guestCheckout and
    // PaymentForm's onSuccess trigger — see existing OrderConfirmationPage
    // tests (if any) for the PaymentForm mocking shape, or stub PaymentForm
    // entirely via vi.mock('../../../components/storefront/PaymentForm', ...)
    // exposing a button that calls the onSuccess prop, to drive this
    // assertion without a real Stripe confirmation flow.
  });
});
```

The last `describe` block is left as a scaffold with an explicit implementation note — the exact mechanics of reaching `handlePaymentSuccess` in a test depend on how `PaymentForm` is mocked project-wide (no existing precedent for a full Checkout flow test was found in the repo at research time; mirror the `docs/frontend-standards.md` "Testing Stripe Components" mock shape and drive `onSuccess` directly via `vi.mock('../../../components/storefront/PaymentForm', () => ({ default: (props) => <button onClick={props.onSuccess}>finish</button> }))`).

Run `cd frontend && npx eslint src --ext .ts,.tsx` before considering this task done — all assertions above use `findBy*`/`findAllBy*` for async UI, no `waitFor` + `getBy*` combination.

---

## Group 7 — Admin Margin Breakdown UI

### 7.0 `frontend/src/types/product.ts` — additional `ProductVariant` fields (admin-only)

```typescript
export interface ProductVariant {
  // ...existing fields (including stockQuantity from Group 3)...
  shippingCostEstimate?: number | null;   // NEW — admin-only, from shipping-margin-guardrail
  netMargin?: number;                      // NEW — admin-only, derived: publicPrice - supplierCost - shippingCostEstimate
  shippingEstimateMissing?: boolean;       // NEW — admin-only, true when shippingCostEstimate is null
  belowTargetMargin?: boolean;             // NEW — admin-only, warning flag from backend targetMargin comparison
}
```

**Reconcile these four field names against the actual backend response** for tasks 6.1/6.3 before wiring the table — this plan was written without a backend contract to cross-check against (see Flag #5 above).

### 7.1 `frontend/src/services/adminProductService.ts` — new freight-estimate action

Add alongside the existing `Variants` group:

```typescript
refreshFreightEstimate: async (
  productId: number,
  variantId: number,
  destinationCountry?: string,
): Promise<VariantResponse> => {
  try {
    const response = await axios.post<VariantResponse>(
      `${ADMIN_BASE}/${productId}/variants/${variantId}/freight-estimate`,
      destinationCountry ? { destinationCountry } : {},
    );
    return response.data;
  } catch (error) {
    console.error('Error refreshing freight estimate:', error);
    throw error;
  }
},
```

Add the new error code to `mapProductError` (`adminProductService.ts:28-49`):

```typescript
case 'CJ_ITEM_NOT_MAPPED':
  return 'Esta variante no está vinculada a un artículo del catálogo del proveedor; no se puede estimar el envío.';
```

### 7.2 `frontend/src/components/admin/VariantTable.tsx`

**Extend `Margin` into a full breakdown, add a warning badge component:**

```tsx
const formatMaybePrice = (n: number | null | undefined) =>
  n == null ? '—' : formatPrice(n);

// Net margin over supplier cost + shipping estimate. Missing shipping
// estimate is treated as 0 for the computation per shipping-margin-guardrail
// spec, but flagged visually so admins know it's an approximation.
const NetMargin: React.FC<{ variant: ProductVariant }> = ({ variant }) => {
  const { publicPrice, supplierCost, netMargin, shippingEstimateMissing } = variant;
  if (supplierCost == null) return <>—</>;
  const margin = netMargin ?? (publicPrice - supplierCost - (variant.shippingCostEstimate ?? 0));
  const pct = publicPrice > 0 ? (margin / publicPrice) * 100 : 0;
  return (
    <span className={margin < 0 ? 'text-danger fw-semibold' : undefined}>
      {formatPrice(margin)} ({pct.toFixed(0)}%)
      {shippingEstimateMissing && <span className="text-muted"> *</span>}
    </span>
  );
};

const MarginWarningBadge: React.FC<{ variant: ProductVariant }> = ({ variant }) => {
  if (!variant.belowTargetMargin) return null;
  const isNegative = (variant.netMargin ?? 0) < 0;
  return (
    <Badge bg={isNegative ? 'danger' : 'warning'} data-testid={`variant-margin-warning-${variant.id}`}>
      {isNegative ? 'Vendiendo con pérdida' : 'Margen bajo'}
    </Badge>
  );
};
```

Import `Badge` in the existing `react-bootstrap` import line (`Table, Button, Modal, Form, Alert` → add `Badge`).

**New column** "Envío estimado" between "Coste de proveedor" and "Precio público" (desktop table header + body), plus a "Margen neto" column replacing/extending "Margen", plus a warning cell:

```tsx
<th>Envío estimado</th>
...
<th>Margen neto</th>
<th>Alerta</th>
```

```tsx
<td data-testid={`variant-shipping-estimate-${v.id}`}>{formatMaybePrice(v.shippingCostEstimate)}</td>
...
<td data-testid={`variant-net-margin-${v.id}`}><NetMargin variant={v} /></td>
<td><MarginWarningBadge variant={v} /></td>
```

Mirror the same fields into the mobile `admin-card-row` block (per existing dual-render convention):

```tsx
<div className="admin-card-row__field">
  <span className="admin-card-row__label">Envío estimado</span>
  <span data-testid={`variant-shipping-estimate-${v.id}`}>{formatMaybePrice(v.shippingCostEstimate)}</span>
</div>
<div className="admin-card-row__field">
  <span className="admin-card-row__label">Margen neto</span>
  <span data-testid={`variant-net-margin-${v.id}`}><NetMargin variant={v} /></span>
</div>
<MarginWarningBadge variant={v} />
```

**"Refresh shipping estimate" action** — add a per-row/per-card button next to "Editar"/"Eliminar":

```tsx
const [refreshingId, setRefreshingId] = useState<number | null>(null);
const [refreshError, setRefreshError] = useState('');

const refreshEstimate = async (variant: ProductVariant) => {
  setRefreshingId(variant.id as number);
  setRefreshError('');
  try {
    await adminProductService.refreshFreightEstimate(productId, variant.id as number);
    onVariantsChange();
  } catch (err) {
    setRefreshError(extractErrorMessage(err));
  } finally {
    setRefreshingId(null);
  }
};
```

Button (desktop table row and mobile card, mirroring the existing `btn-edit-variant-*`/`btn-delete-variant-*` pattern):

```tsx
<Button
  size="sm"
  variant="outline-secondary"
  className="me-2"
  disabled={refreshingId === v.id}
  onClick={() => refreshEstimate(v)}
  data-testid={`btn-refresh-shipping-estimate-${v.id}`}
>
  {refreshingId === v.id ? 'Actualizando…' : 'Actualizar envío'}
</Button>
```

Surface `refreshError` via an `<Alert variant="danger">` near the top of the table (same pattern as `deleteError`), so a `422 CJ_ITEM_NOT_MAPPED` is visible.

This reuses the existing `onVariantsChange` → `refetchVariants` callback (`ProductDetailPage.tsx:104-105`) to refresh the whole variant list after a successful estimate refresh, rather than mutating local state — consistent with how edit/delete already work in this component.

### 7.3 `frontend/src/components/admin/__tests__/VariantTable.test.tsx`

Add `stockQuantity: 5` to the existing `variant` fixture (now a required field per Group 3's type change — this file will fail to compile otherwise).

New tests:

```typescript
it('shows the shipping estimate and net margin when the admin API provides them', () => {
  const sourced: ProductVariant = {
    ...variant,
    supplierCost: 10,
    shippingCostEstimate: 4,
    netMargin: 15.9, // 29.9 - 10 - 4
  };
  render(<VariantTable productId={1} variants={[sourced]} onVariantsChange={vi.fn()} />);
  expect(screen.getByTestId('variant-shipping-estimate-5').textContent).toContain('4');
  expect(screen.getByTestId('variant-net-margin-5').textContent).toContain('15');
});

it('shows a warning badge when belowTargetMargin is true, danger styling when netMargin is negative', () => {
  const losing: ProductVariant = {
    ...variant,
    supplierCost: 40,
    shippingCostEstimate: 5,
    netMargin: -15.1,
    belowTargetMargin: true,
  };
  render(<VariantTable productId={1} variants={[losing]} onVariantsChange={vi.fn()} />);
  expect(screen.getByTestId('variant-margin-warning-5')).toBeInTheDocument();
});

it('does not show a warning badge when belowTargetMargin is false', () => {
  const healthy: ProductVariant = { ...variant, supplierCost: 5, shippingCostEstimate: 2, netMargin: 22.9, belowTargetMargin: false };
  render(<VariantTable productId={1} variants={[healthy]} onVariantsChange={vi.fn()} />);
  expect(screen.queryByTestId('variant-margin-warning-5')).not.toBeInTheDocument();
});

it('shows the missing-estimate indicator when shippingCostEstimate is null', () => {
  const missing: ProductVariant = { ...variant, supplierCost: 10, shippingCostEstimate: null, shippingEstimateMissing: true, netMargin: 19.9 };
  render(<VariantTable productId={1} variants={[missing]} onVariantsChange={vi.fn()} />);
  expect(screen.getByTestId('variant-shipping-estimate-5').textContent).toBe('—');
});

it('calls refreshFreightEstimate and refetches on click', async () => {
  mocked.refreshFreightEstimate.mockResolvedValue({ success: true, data: variant, message: '' });
  const onVariantsChange = vi.fn();
  render(<VariantTable productId={1} variants={[variant]} onVariantsChange={onVariantsChange} />);
  fireEvent.click(screen.getByTestId('btn-refresh-shipping-estimate-5'));
  await waitFor(() => expect(mocked.refreshFreightEstimate).toHaveBeenCalledWith(1, 5, undefined));
  expect(onVariantsChange).toHaveBeenCalled();
});

it('shows the error message when refreshFreightEstimate returns CJ_ITEM_NOT_MAPPED', async () => {
  mocked.refreshFreightEstimate.mockRejectedValue({
    response: { data: { error: { code: 'CJ_ITEM_NOT_MAPPED' } } },
  });
  render(<VariantTable productId={1} variants={[variant]} onVariantsChange={vi.fn()} />);
  fireEvent.click(screen.getByTestId('btn-refresh-shipping-estimate-5'));
  expect(await screen.findByText(/no está vinculada a un artículo/i)).toBeInTheDocument();
});
```

Run `cd frontend && npx eslint src --ext .ts,.tsx` after — the last test correctly uses `findByText` (async), not `waitFor` + `getByText`.

---

## Group 11 — Admin Alert/Failure List

Per `tasks.md` 11.1 ("a minimal admin panel view, or a section on the existing Supplier Orders / Shipments admin pages") — recommend a **dedicated new page** (`FulfillmentAlertsPage.tsx`), not a section bolted onto `ShipmentsPage`/`SupplierOrdersPage`. Rationale: an alert can reference a customer order and/or a supplier order together (per `fulfillment-automation` spec: "including the affected customer order and supplier order"), so it doesn't belong to either existing list's domain; a standalone page mirroring `ShipmentsPage.tsx`'s structure is the smallest change consistent with the existing one-page-per-admin-resource convention (`docs/frontend-standards.md` "Recommended frontend routes").

### 11.0 Proposed response contract (reconcile against backend task 10.2 before wiring)

```typescript
// frontend/src/types/fulfillmentAlert.ts (NEW FILE)

export type FulfillmentAlertType =
  | 'SUPPLIER_ORDER_GENERATION_FAILED'
  | 'CJ_PUSH_FAILED'
  | 'STATUS_SYNC_FAILED';

export interface FulfillmentAlert {
  id: number;
  type: FulfillmentAlertType;
  customerOrderId: number | null;
  supplierOrderId: number | null;
  reason: string;
  resolved: boolean;
  createdAt: string;
}

export interface FulfillmentAlertListResult {
  items: FulfillmentAlert[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FulfillmentAlertListResponse {
  success: boolean;
  data: FulfillmentAlertListResult;
  message: string;
}

export interface FulfillmentAlertQueryParams {
  page?: number;
  pageSize?: number;
  resolved?: boolean;
}
```

### 11.1a `frontend/src/services/fulfillmentAlertService.ts` (NEW FILE)

Mirrors `shipmentService.ts`:

```typescript
import axios from 'axios';
import {
  FulfillmentAlertQueryParams,
  FulfillmentAlertListResponse,
} from '../types/fulfillmentAlert';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/fulfillment-automation/alerts`;

export const fulfillmentAlertService = {
  list: async (params?: FulfillmentAlertQueryParams): Promise<FulfillmentAlertListResponse> => {
    const response = await axios.get<FulfillmentAlertListResponse>(ADMIN_BASE, { params });
    return response.data;
  },
};
```

(No mutation endpoints are specified by `tasks.md` 10.2 — read-only list. Add a `resolve`/`dismiss` mutation only if the backend plan ends up exposing one; not assumed here.)

### 11.1b `frontend/src/pages/FulfillmentAlertsPage.tsx` (NEW FILE)

Structure mirrors `ShipmentsPage.tsx` closely (`Container`/`Row`/`Table`+mobile-`Card` dual render, `useCallback` fetch, pagination, status filter). Key pieces:

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Table, Badge, Button, Form, Spinner, Alert, Card } from 'react-bootstrap';
import { FulfillmentAlert } from '../types/fulfillmentAlert';
import { fulfillmentAlertService } from '../services/fulfillmentAlertService';

const ALERT_TYPE_LABELS: Record<string, string> = {
  SUPPLIER_ORDER_GENERATION_FAILED: 'Generación de pedido a proveedor fallida',
  CJ_PUSH_FAILED: 'Envío a CJ Dropshipping fallido',
  STATUS_SYNC_FAILED: 'Sincronización de estado fallida',
};

const FulfillmentAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<FulfillmentAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fulfillmentAlertService.list({
        page,
        pageSize,
        ...(showResolved ? {} : { resolved: false }),
      });
      setAlerts(resp.data.items);
      setTotal(resp.data.total);
    } catch {
      setError('No se pudieron cargar las alertas de automatización.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, showResolved]);

  useEffect(() => { void fetchAlerts(); }, [fetchAlerts]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Container fluid className="py-4">
      <Row className="mb-3 align-items-center">
        <Col><h2 className="mb-0">Alertas de automatización</h2></Col>
        <Col xs="auto">
          <Form.Check
            type="switch"
            label="Mostrar resueltas"
            checked={showResolved}
            onChange={(e) => { setShowResolved(e.target.checked); setPage(1); }}
          />
        </Col>
      </Row>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status"><span className="visually-hidden">Cargando…</span></Spinner>
        </div>
      ) : (
        <>
          <div className="d-none d-md-block">
            <Table striped hover responsive data-testid="alerts-table">
              <thead>
                <tr>
                  <th>ID</th><th>Tipo</th><th>Pedido de cliente</th><th>Pedido a proveedor</th><th>Motivo</th><th>Fecha</th><th></th>
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-muted py-4">No hay alertas.</td></tr>
                ) : (
                  alerts.map((a) => (
                    <tr key={a.id} data-testid={`alert-row-${a.id}`}>
                      <td>{a.id}</td>
                      <td><Badge bg="danger">{ALERT_TYPE_LABELS[a.type] ?? a.type}</Badge></td>
                      <td>
                        {a.customerOrderId ? (
                          <Button variant="link" size="sm" onClick={() => navigate(`/customer-orders/${a.customerOrderId}`)} data-testid={`alert-customer-order-link-${a.id}`}>
                            #{a.customerOrderId}
                          </Button>
                        ) : '—'}
                      </td>
                      <td>
                        {a.supplierOrderId ? (
                          <Button variant="link" size="sm" onClick={() => navigate(`/supplier-orders/${a.supplierOrderId}`)} data-testid={`alert-supplier-order-link-${a.id}`}>
                            #{a.supplierOrderId}
                          </Button>
                        ) : '—'}
                      </td>
                      <td>{a.reason}</td>
                      <td>{new Date(a.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className="d-md-none">
            {alerts.map((a) => (
              <Card key={a.id} className="mb-3" data-testid={`alert-card-${a.id}`}>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>Alerta #{a.id}</strong>
                    <Badge bg="danger">{ALERT_TYPE_LABELS[a.type] ?? a.type}</Badge>
                  </div>
                  <p className="mb-1 text-muted small">{a.reason}</p>
                  {a.customerOrderId && (
                    <Button variant="outline-primary" size="sm" className="me-2" onClick={() => navigate(`/customer-orders/${a.customerOrderId}`)}>
                      Pedido #{a.customerOrderId}
                    </Button>
                  )}
                  {a.supplierOrderId && (
                    <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/supplier-orders/${a.supplierOrderId}`)}>
                      Pedido proveedor #{a.supplierOrderId}
                    </Button>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="d-flex justify-content-center gap-2 mt-3">
              <Button variant="outline-secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span className="align-self-center small">Página {page} de {totalPages}</span>
              <Button variant="outline-secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          )}
        </>
      )}
    </Container>
  );
};

export default FulfillmentAlertsPage;
```

No i18n — admin panel is hardcoded Spanish per `docs/frontend-standards.md` "i18n is enabled only for the public storefront."

### 11.1c `frontend/src/App.tsx` — route registration

Add import near the other admin page imports (after `RefundDetailPage`):

```typescript
import FulfillmentAlertsPage from './pages/FulfillmentAlertsPage';
```

Add route inside the existing admin `<Route path="/" element={<RequireAdminAuth><Layout /></RequireAdminAuth>}>` block (`App.tsx:163-188`), e.g. after `refunds/:id`:

```tsx
<Route path="fulfillment-alerts" element={<FulfillmentAlertsPage />} />
```

### 11.1d `frontend/src/components/Layout.tsx` — nav link

Add alongside the existing `Nav.Link` entries (`Layout.tsx:29-37`), after "Reembolsos" or wherever fits the store owner's priority ordering:

```tsx
<Nav.Link as={NavLink} to="/fulfillment-alerts">Alertas de automatización</Nav.Link>
```

### 11.2 `frontend/src/pages/__tests__/FulfillmentAlertsPage.test.tsx` (NEW FILE)

Mirrors the existing admin list-page test conventions (mock the service module, `MemoryRouter`, `findBy*`):

```typescript
import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FulfillmentAlertsPage from '../FulfillmentAlertsPage';
import { fulfillmentAlertService } from '../../services/fulfillmentAlertService';

vi.mock('../../services/fulfillmentAlertService');
const mocked = fulfillmentAlertService as { list: ReturnType<typeof vi.fn> };

beforeEach(() => vi.clearAllMocks());

function renderPage() {
  return render(<MemoryRouter><FulfillmentAlertsPage /></MemoryRouter>);
}

describe('FulfillmentAlertsPage', () => {
  it('renders unresolved alerts by default', async () => {
    mocked.list = vi.fn().mockResolvedValue({
      data: { items: [{ id: 1, type: 'CJ_PUSH_FAILED', customerOrderId: 10, supplierOrderId: 20, reason: 'CJ_API_UNAVAILABLE', resolved: false, createdAt: '2026-07-13T00:00:00Z' }], total: 1, page: 1, pageSize: 20 },
    });
    renderPage();
    expect(await screen.findByTestId('alert-row-1')).toBeInTheDocument();
    expect(mocked.list).toHaveBeenCalledWith(expect.objectContaining({ resolved: false }));
  });

  it('navigates to the affected customer order on link click', async () => {
    mocked.list = vi.fn().mockResolvedValue({
      data: { items: [{ id: 1, type: 'CJ_PUSH_FAILED', customerOrderId: 10, supplierOrderId: null, reason: 'x', resolved: false, createdAt: '2026-07-13T00:00:00Z' }], total: 1, page: 1, pageSize: 20 },
    });
    renderPage();
    const link = await screen.findByTestId('alert-customer-order-link-1');
    fireEvent.click(link);
    // Assert navigation occurred — e.g. via a MemoryRouter initialEntries +
    // rendering a stub route at /customer-orders/:id, or by mocking
    // useNavigate directly and asserting it was called with the right path
    // (mirrors the pattern in ShipmentsPage's own tests, if any exist —
    // otherwise mock `react-router-dom`'s useNavigate as done in similar
    // admin detail-link tests in this codebase).
  });

  it('shows an empty state with no alerts', async () => {
    mocked.list = vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
    renderPage();
    expect(await screen.findByText(/no hay alertas/i)).toBeInTheDocument();
  });

  it('toggles to include resolved alerts when the switch is checked', async () => {
    mocked.list = vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } });
    renderPage();
    await screen.findByText(/no hay alertas/i);
    fireEvent.click(screen.getByLabelText(/mostrar resueltas/i));
    await waitFor(() => expect(mocked.list).toHaveBeenLastCalledWith(expect.not.objectContaining({ resolved: false })));
  });
});
```

Run `cd frontend && npx eslint src --ext .ts,.tsx` after.

---

## Cross-group checklist before moving to test-run tasks (12–15)

- [ ] `frontend/src/types/product.ts`: `stockQuantity` (required) + 4 admin-only margin fields added to `ProductVariant`.
- [ ] Every existing hand-built `ProductVariant` fixture across the frontend test suite now needs `stockQuantity`, or TS compilation fails project-wide. Confirmed via `grep -rn "stockPolicy: 'SupplierManaged'" frontend/src` at research time, beyond `VariantSelector.test.tsx` and `VariantTable.test.tsx` (both covered above), these also build `ProductVariant` object literals and need `stockQuantity` added: `frontend/src/pages/__tests__/ProductDetailPage.test.tsx`, `frontend/src/pages/storefront/__tests__/ProductPage.test.tsx`, `frontend/src/components/storefront/ProductCard.test.tsx`. Re-run the grep after implementation to catch any missed elsewhere.
- [ ] `VariantSelector.tsx`, `ProductGallery.tsx` diffs are logic-only — no CSS changes needed. `CheckoutPage.tsx` introduces a new `.storefront-checkout__toggle` class (checkbox + label rows for "usar mismos datos" / "save as default") that does **not** exist in `frontend/src/styles/storefront.css` today (confirmed via grep at research time — zero matches). Add a minimal rule there, e.g.:
  ```css
  .storefront-checkout__toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-block: var(--spacing-2);
  }
  ```
- [ ] `npx eslint src --ext .ts,.tsx` run and clean after all four groups.
- [ ] `npm test` (Vitest) run and clean after all four groups — new/updated files: `VariantSelector.test.tsx`, `ProductGallery.test.tsx`, `CheckoutPage.test.tsx` (new), `VariantTable.test.tsx`, `FulfillmentAlertsPage.test.tsx` (new).
