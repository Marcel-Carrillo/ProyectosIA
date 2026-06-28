# Cookie Consent Banner — Frontend Implementation Plan

> Produced by the `frontend-developer` agent. Read this before touching any file.
>
> **Scope:** Frontend-only. No backend, no Prisma, no API changes.
> **Branch:** `feature/cookie-consent-banner` off `develop`.

---

## Directory Naming Caveat (MUST READ)

The session context and tasks reference `frontend/src/context/` (singular). The **project already uses `frontend/src/contexts/` (plural)** — see `CartContext.tsx`, `AdminAuthContext.tsx`, `CustomerAuthContext.tsx`. Use **`frontend/src/contexts/`** to stay consistent. All paths in this plan use the plural form.

---

## File Index

| # | File | Action |
|---|------|--------|
| 1 | `frontend/src/constants/cookieConsent.ts` | CREATE |
| 2 | `frontend/src/contexts/CookieConsentContext.tsx` | CREATE |
| 3 | `frontend/src/i18n/locales/es/cookies.json` | CREATE |
| 4 | `frontend/src/i18n/locales/en/cookies.json` | CREATE |
| 5 | `frontend/src/components/storefront/CookieConsentBanner.tsx` | CREATE |
| 6 | `frontend/src/components/storefront/CookiePreferencesModal.tsx` | CREATE |
| 7 | `frontend/src/contexts/__tests__/CookieConsentContext.test.tsx` | CREATE |
| 8 | `frontend/src/components/storefront/__tests__/CookieConsentBanner.test.tsx` | CREATE |
| 9 | `frontend/src/components/storefront/__tests__/CookiePreferencesModal.test.tsx` | CREATE |
| 10 | `frontend/src/i18n/index.ts` | MODIFY |
| 11 | `frontend/src/test-utils/renderWithI18n.tsx` | MODIFY |
| 12 | `frontend/src/App.tsx` | MODIFY |
| 13 | `frontend/src/components/storefront/StorefrontLayout.tsx` | MODIFY |
| 14 | `frontend/src/components/storefront/StorefrontFooter.tsx` | MODIFY |
| 15 | `frontend/src/styles/storefront.css` | MODIFY |
| 16 | `frontend/src/index.tsx` | MODIFY |

---

## File 1 — `frontend/src/constants/cookieConsent.ts`

**Action:** CREATE

### What to create

All shared constants and TypeScript types live here. Components and the context import from this single source of truth.

```typescript
// ─── Constants ───────────────────────────────────────────────────────────────
export const CONSENT_VERSION = '1';
// Increment CONSENT_VERSION to invalidate all stored decisions and re-prompt all users.

export const CONSENT_STORAGE_KEY = 'mavile.cookieConsent';

export const CONSENT_EXPIRY_DAYS = 365;

// Custom event name dispatched when analytics consent is granted at runtime
// (consumed by index.tsx to trigger reportWebVitals without React context).
export const ANALYTICS_CONSENT_EVENT = 'mavile:analyticsConsentGranted';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ConsentCategories {
  necessary: boolean;   // Always true when a decision exists; read-only in the UI
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentRecord {
  version: string;       // Must equal CONSENT_VERSION for the record to be valid
  timestamp: string;     // ISO 8601 — used for expiry check
  categories: ConsentCategories;
}

// Shape returned by useCookieConsent()
export interface CookieConsentContextValue {
  /** Current consent categories. Defaults to { necessary: true, analytics: false, marketing: false }
   *  when no decision has been recorded yet. */
  consent: ConsentCategories;

  /** True when a valid (correct version + not expired) consent record exists in localStorage. */
  hasDecision: boolean;

  /** True when the preferences modal is open. */
  isPreferencesOpen: boolean;

  /**
   * Persist a consent decision to localStorage and update context state.
   * `necessary` is always forced to `true` regardless of the argument.
   */
  saveConsent: (categories: Pick<ConsentCategories, 'analytics' | 'marketing'>) => void;

  /** Open the preferences modal. Captures document.activeElement for focus restoration. */
  openPreferences: () => void;

  /** Close the preferences modal without saving, and restore focus to the trigger element. */
  closePreferences: () => void;
}
```

### Key imports needed
None — this file has no imports.

### Edge cases / caveats
- `necessary` is always `true` in `ConsentCategories` when a real decision exists, but is typed as `boolean` so that the default state object `{ necessary: true, analytics: false, marketing: false }` passes type-checking without an `as const` cast.
- Keep `CONSENT_VERSION` as a `string`, not a `number` — the localStorage schema uses string values.

---

## File 2 — `frontend/src/contexts/CookieConsentContext.tsx`

**Action:** CREATE

### What to create

Provider + hook. Follows the exact pattern of `CartContext.tsx` (lazy-init state from localStorage, `useCallback` for actions, `createContext<T | undefined>(undefined)` sentinel pattern).

### Key imports

```typescript
import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState
} from 'react';
import {
  ANALYTICS_CONSENT_EVENT,
  CONSENT_EXPIRY_DAYS,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  ConsentCategories,
  ConsentRecord,
  CookieConsentContextValue,
} from '../constants/cookieConsent';
```

### Exported symbols

- `CookieConsentContext` (default export `undefined` sentinel — private, not exported)
- `CookieConsentProvider` (named export)
- `useCookieConsent` (named export)
- `isConsentValid` (named export — also needed by `CookieConsentBanner` to decide render)

### Function signatures

```typescript
/** Returns true if record exists, version matches, and timestamp is within CONSENT_EXPIRY_DAYS. */
export function isConsentValid(record: ConsentRecord | null): boolean

/** Read and parse localStorage. Returns null on any error or if key is absent. */
function readFromStorage(): ConsentRecord | null

/** Write record to localStorage. Silently no-ops on failure (e.g., private browsing). */
function writeToStorage(record: ConsentRecord): void

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }>

export function useCookieConsent(): CookieConsentContextValue
```

### Implementation logic

#### `isConsentValid`
```typescript
export function isConsentValid(record: ConsentRecord | null): boolean {
  if (!record) return false;
  if (record.version !== CONSENT_VERSION) return false;
  const age = (Date.now() - new Date(record.timestamp).getTime()) / (1000 * 60 * 60 * 24);
  return age < CONSENT_EXPIRY_DAYS;
}
```

#### `readFromStorage`
```typescript
function readFromStorage(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConsentRecord) : null;
  } catch {
    return null;
  }
}
```

#### `writeToStorage`
```typescript
function writeToStorage(record: ConsentRecord): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Silently fail (private browsing / storage quota)
  }
}
```

#### `CookieConsentProvider` state and logic

```typescript
const DEFAULT_CONSENT: ConsentCategories = { necessary: true, analytics: false, marketing: false };

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lazy initialiser — runs once on mount, reads localStorage synchronously
  const [storedRecord, setStoredRecord] = useState<ConsentRecord | null>(() => readFromStorage());
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  // Ref to restore focus on modal close
  const previousFocusRef = useRef<Element | null>(null);

  const hasDecision = isConsentValid(storedRecord);
  const consent: ConsentCategories = hasDecision
    ? storedRecord!.categories
    : DEFAULT_CONSENT;

  const saveConsent = useCallback((categories: Pick<ConsentCategories, 'analytics' | 'marketing'>) => {
    const record: ConsentRecord = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      categories: { necessary: true, ...categories },
    };
    writeToStorage(record);
    setStoredRecord(record);
    setIsPreferencesOpen(false);

    // Gate reportWebVitals — dispatch event so index.tsx can react without React context
    if (categories.analytics) {
      window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT));
    }
  }, []);

  const openPreferences = useCallback(() => {
    previousFocusRef.current = document.activeElement;
    setIsPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setIsPreferencesOpen(false);
    // Restore focus after the modal unmounts (next tick)
    setTimeout(() => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    }, 0);
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{ consent, hasDecision, isPreferencesOpen, saveConsent, openPreferences, closePreferences }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
};
```

#### `useCookieConsent` hook

```typescript
export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used inside CookieConsentProvider');
  return ctx;
}
```

### Edge cases / caveats

- `saveConsent` calls `setIsPreferencesOpen(false)` — this closes both the modal after "Save" and after "Accept/Reject all" from either the banner or the modal.
- The `CustomEvent(ANALYTICS_CONSENT_EVENT)` is dispatched **every** time analytics is saved as `true` (including repeat saves). `index.tsx` uses `{ once: true }` so it only fires `reportWebVitals` once. This is correct because `reportWebVitals` should only be called once.
- Do NOT put the focus-restore inside a `useEffect` depending on `isPreferencesOpen` — React may batch state updates and fire the effect before the DOM updates. Using `setTimeout(..., 0)` is the safe pattern here.

---

## File 3 — `frontend/src/i18n/locales/es/cookies.json`

**Action:** CREATE

```json
{
  "banner": {
    "ariaLabel": "Aviso de cookies",
    "message": "Utilizamos cookies propias y de terceros para mejorar tu experiencia y mostrarte contenido relevante. Puedes aceptar todas, rechazar las no esenciales o personalizar tus preferencias.",
    "acceptAll": "Aceptar todo",
    "rejectAll": "Rechazar todo",
    "customize": "Personalizar"
  },
  "modal": {
    "title": "Preferencias de cookies",
    "close": "Cerrar",
    "categories": {
      "necessary": {
        "name": "Necesarias",
        "description": "Imprescindibles para el funcionamiento del sitio web. No se pueden desactivar."
      },
      "analytics": {
        "name": "Analíticas",
        "description": "Nos ayudan a entender cómo interactúan los visitantes con el sitio para mejorar el rendimiento."
      },
      "marketing": {
        "name": "Marketing",
        "description": "Permiten mostrarte publicidad personalizada basada en tus intereses dentro y fuera de este sitio."
      }
    },
    "savePreferences": "Guardar preferencias",
    "acceptAll": "Aceptar todo",
    "rejectAll": "Rechazar todo"
  },
  "footer": {
    "cookieSettings": "Ajustes de cookies"
  }
}
```

---

## File 4 — `frontend/src/i18n/locales/en/cookies.json`

**Action:** CREATE

```json
{
  "banner": {
    "ariaLabel": "Cookie notice",
    "message": "We use cookies to improve your experience and show you relevant content. You can accept all, reject non-essential ones, or customise your preferences.",
    "acceptAll": "Accept all",
    "rejectAll": "Reject all",
    "customize": "Customise"
  },
  "modal": {
    "title": "Cookie preferences",
    "close": "Close",
    "categories": {
      "necessary": {
        "name": "Necessary",
        "description": "Essential for the website to function. Cannot be disabled."
      },
      "analytics": {
        "name": "Analytics",
        "description": "Help us understand how visitors interact with the site to improve performance."
      },
      "marketing": {
        "name": "Marketing",
        "description": "Used to deliver personalised advertising based on your interests on and off this site."
      }
    },
    "savePreferences": "Save preferences",
    "acceptAll": "Accept all",
    "rejectAll": "Reject all"
  },
  "footer": {
    "cookieSettings": "Cookie settings"
  }
}
```

---

## File 5 — `frontend/src/components/storefront/CookieConsentBanner.tsx`

**Action:** CREATE

### What to create

A fixed-position bottom bar. Renders `null` when `hasDecision` is true. Uses `useCookieConsent` for actions. No props — reads context directly.

### Key imports

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCookieConsent } from '../../contexts/CookieConsentContext';
```

### Function signature

```typescript
const CookieConsentBanner: React.FC = ()
```

### JSX structure

```tsx
const CookieConsentBanner: React.FC = () => {
  const { t } = useTranslation('cookies');
  const { hasDecision, saveConsent, openPreferences } = useCookieConsent();

  if (hasDecision) return null;

  const handleAcceptAll = () => saveConsent({ analytics: true, marketing: true });
  const handleRejectAll = () => saveConsent({ analytics: false, marketing: false });

  return (
    <div
      role="region"
      aria-label={t('banner.ariaLabel')}
      aria-live="polite"
      className="storefront-cookie__banner"
      data-testid="cookie-consent-banner"
    >
      <div className="storefront-cookie__banner-inner">
        <p className="storefront-cookie__banner-message">{t('banner.message')}</p>
        <div className="storefront-cookie__banner-actions">
          <button
            type="button"
            onClick={handleRejectAll}
            className="storefront-btn storefront-btn--ghost"
            data-testid="cookie-banner-reject"
          >
            {t('banner.rejectAll')}
          </button>
          <button
            type="button"
            onClick={openPreferences}
            className="storefront-btn storefront-btn--ghost"
            data-testid="cookie-banner-customize"
          >
            {t('banner.customize')}
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="storefront-btn storefront-btn--primary"
            data-testid="cookie-banner-accept"
          >
            {t('banner.acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
```

### Edge cases / caveats

- `role="region"` + `aria-label` satisfies the screen reader announcement requirement. Combined with `aria-live="polite"`, screen readers will announce the banner when it mounts.
- The component only returns `null` — no animation on dismiss is needed because the banner unmounts immediately after `saveConsent`. CSS entry animation handles the initial appearance.
- Button class names `storefront-btn` and `storefront-btn--primary`/`storefront-btn--ghost`: check what button utility classes are available in `storefront.css`. If they do not exist, use inline styling matching the existing pattern or define them in the cookie CSS block (see File 15).

---

## File 6 — `frontend/src/components/storefront/CookiePreferencesModal.tsx`

**Action:** CREATE

### What to create

Portal-rendered modal with focus trap. Internal state manages toggle values while open; the context is only updated on "Save" or "Accept/Reject all".

### Key imports

```typescript
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useCookieConsent } from '../../contexts/CookieConsentContext';
import { ConsentCategories } from '../../constants/cookieConsent';
```

### Function signature

```typescript
const CookiePreferencesModal: React.FC = ()
```

### State

```typescript
// Local draft — only committed to context on a save action
const [localConsent, setLocalConsent] = useState<Pick<ConsentCategories, 'analytics' | 'marketing'>>({
  analytics: false,
  marketing: false,
});
```

### Sync consent into local state on open

```typescript
// When modal opens, sync current stored values into localConsent
useEffect(() => {
  if (isPreferencesOpen) {
    setLocalConsent({ analytics: consent.analytics, marketing: consent.marketing });
  }
}, [isPreferencesOpen, consent.analytics, consent.marketing]);
```

### Focus trap implementation

```typescript
const modalRef = useRef<HTMLDivElement>(null);

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

useEffect(() => {
  if (!isPreferencesOpen || !modalRef.current) return;

  // Move focus to first focusable element on open
  const focusables = Array.from(
    modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  );
  focusables[0]?.focus();

  // Keydown handler for Tab cycling and Escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePreferences();
      return;
    }
    if (e.key === 'Tab') {
      const current = Array.from(
        modalRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );
      const first = current[0];
      const last = current[current.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [isPreferencesOpen, closePreferences]);
```

### Portal pattern

```typescript
if (!isPreferencesOpen) return null;

const modalContent = (
  <div className="storefront-cookie__overlay" data-testid="cookie-modal-overlay">
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-modal-title"
      className="storefront-cookie__modal"
      data-testid="cookie-preferences-modal"
    >
      {/* header, categories, actions */}
    </div>
  </div>
);

return ReactDOM.createPortal(modalContent, document.body);
```

### Category rows

Three rows: `necessary` (toggle disabled + checked), `analytics` (controlled toggle), `marketing` (controlled toggle).

```tsx
// Necessary row — locked
<div className="storefront-cookie__category">
  <div className="storefront-cookie__category-info">
    <p className="storefront-cookie__category-name">{t('modal.categories.necessary.name')}</p>
    <p className="storefront-cookie__category-desc">{t('modal.categories.necessary.description')}</p>
  </div>
  <label className="storefront-cookie__toggle">
    <input
      type="checkbox"
      checked={true}
      disabled={true}
      readOnly
      aria-label={t('modal.categories.necessary.name')}
      data-testid="toggle-necessary"
    />
    <span className="storefront-cookie__toggle-track" />
  </label>
</div>

// Analytics row
<div className="storefront-cookie__category">
  <div className="storefront-cookie__category-info">
    <p className="storefront-cookie__category-name">{t('modal.categories.analytics.name')}</p>
    <p className="storefront-cookie__category-desc">{t('modal.categories.analytics.description')}</p>
  </div>
  <label className="storefront-cookie__toggle">
    <input
      type="checkbox"
      checked={localConsent.analytics}
      onChange={(e) => setLocalConsent(prev => ({ ...prev, analytics: e.target.checked }))}
      aria-label={t('modal.categories.analytics.name')}
      data-testid="toggle-analytics"
    />
    <span className="storefront-cookie__toggle-track" />
  </label>
</div>
```

(Same pattern for `marketing`.)

### Action buttons

```tsx
<div className="storefront-cookie__modal-actions">
  <button type="button" onClick={() => saveConsent({ analytics: false, marketing: false })}
          data-testid="modal-reject-all">
    {t('modal.rejectAll')}
  </button>
  <button type="button" onClick={() => saveConsent(localConsent)}
          data-testid="modal-save-preferences">
    {t('modal.savePreferences')}
  </button>
  <button type="button" onClick={() => saveConsent({ analytics: true, marketing: true })}
          data-testid="modal-accept-all">
    {t('modal.acceptAll')}
  </button>
</div>
```

### Edge cases / caveats

- `ReactDOM.createPortal` needs `document.body` to exist. In CRA (browser environment) this is always true. In tests (jsdom), `document.body` also exists and portals render normally, so `screen.findBy*` queries still work without any extra setup.
- The `FOCUSABLE_SELECTORS` query re-runs on every Tab keydown from inside the handler — this is correct because the modal DOM doesn't change while open, so it is not a performance concern.
- `closePreferences` is from context (`useCallback`-wrapped), so it is safe as a `useEffect` dependency.
- The close button (X) in the modal header should also call `closePreferences()` (not `saveConsent`). Include `data-testid="modal-close-btn"`.
- When the visitor opens the modal from the **footer** (has an existing valid decision), `consent.analytics` / `consent.marketing` will be their actual stored values, and the `useEffect` syncing them into `localConsent` ensures the toggles are pre-populated correctly.

---

## File 7 — `frontend/src/contexts/__tests__/CookieConsentContext.test.tsx`

**Action:** CREATE

### Key imports

```typescript
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { CookieConsentProvider, useCookieConsent, isConsentValid } from '../CookieConsentContext';
import { CONSENT_VERSION, CONSENT_STORAGE_KEY, ConsentRecord } from '../../constants/cookieConsent';
```

### Wrapper factory

```typescript
const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <CookieConsentProvider>{children}</CookieConsentProvider>
);
```

### Test cases

```typescript
// isConsentValid
describe('isConsentValid', () => {
  it('returns false for null', ...)
  it('returns false when version mismatches', ...)
  it('returns false when timestamp is older than 365 days', ...)
  it('returns true for a fresh record with correct version', ...)
});

// saveConsent
describe('saveConsent', () => {
  beforeEach(() => localStorage.clear());

  it('writes correct shape to localStorage', () => {
    const { result } = renderHook(() => useCookieConsent(), { wrapper });
    act(() => { result.current.saveConsent({ analytics: true, marketing: false }); });
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)!;
    const record = JSON.parse(raw) as ConsentRecord;
    expect(record.version).toBe(CONSENT_VERSION);
    expect(record.categories).toEqual({ necessary: true, analytics: true, marketing: false });
    expect(record.timestamp).toBeTruthy();
  });

  it('forces necessary to true', () => { ... });
});

// Hook state
describe('useCookieConsent', () => {
  it('returns hasDecision false when localStorage is empty', ...)
  it('returns hasDecision true when valid record exists', ...)
  it('consent updates synchronously after saveConsent', ...)
  it('isPreferencesOpen toggles on openPreferences / closePreferences', ...)
});
```

### ESLint note

No async UI assertions here (hook-only tests with `act`), so `findBy*` rule is not triggered. Use `act()` around all state-mutation calls.

---

## File 8 — `frontend/src/components/storefront/__tests__/CookieConsentBanner.test.tsx`

**Action:** CREATE

### Key imports

```typescript
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { CookieConsentProvider } from '../../../contexts/CookieConsentContext';
import CookieConsentBanner from '../CookieConsentBanner';
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from '../../../constants/cookieConsent';
```

### Wrapper

Wrap with `CookieConsentProvider` because `CookieConsentBanner` calls `useCookieConsent()`.

```typescript
const renderBanner = (lng: 'es' | 'en' = 'en') =>
  renderWithI18n(
    <CookieConsentProvider>
      <CookieConsentBanner />
    </CookieConsentProvider>,
    { lng }
  );
```

### Test cases

```typescript
describe('CookieConsentBanner', () => {
  beforeEach(() => localStorage.clear());

  it('renders when no consent decision exists', async () => {
    renderBanner();
    expect(await screen.findByTestId('cookie-consent-banner')).toBeInTheDocument();
  });

  it('does not render when valid consent exists', async () => {
    // Pre-seed localStorage with a valid record
    const record = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      categories: { necessary: true, analytics: false, marketing: false },
    };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    renderBanner();
    // findByTestId would throw if element appears — use queryBy after a tick
    await expect(screen.findByTestId('cookie-consent-banner', {}, { timeout: 200 }))
      .rejects.toThrow();
  });

  it('"Accept all" saves all categories as true', async () => {
    renderBanner();
    fireEvent.click(await screen.findByTestId('cookie-banner-accept'));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.categories).toEqual({ necessary: true, analytics: true, marketing: true });
  });

  it('"Reject all" saves analytics and marketing as false', async () => {
    renderBanner();
    fireEvent.click(await screen.findByTestId('cookie-banner-reject'));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.categories).toEqual({ necessary: true, analytics: false, marketing: false });
  });

  it('"Customize" calls openPreferences (modal overlay appears)', async () => {
    renderBanner();
    fireEvent.click(await screen.findByTestId('cookie-banner-customize'));
    expect(await screen.findByTestId('cookie-modal-overlay')).toBeInTheDocument();
  });
});
```

### ESLint note

Use `findByTestId` (async) for all first-render assertions per `testing-library/prefer-find-by`. Run `npx eslint src --ext .ts,.tsx` before marking done.

---

## File 9 — `frontend/src/components/storefront/__tests__/CookiePreferencesModal.test.tsx`

**Action:** CREATE

### Key imports

```typescript
import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { CookieConsentProvider } from '../../../contexts/CookieConsentContext';
import CookiePreferencesModal from '../CookiePreferencesModal';
import CookieConsentBanner from '../CookieConsentBanner';
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from '../../../constants/cookieConsent';
```

### Wrapper

```typescript
// Render both banner and modal so openPreferences wiring is available
const renderModal = (lng: 'es' | 'en' = 'en') =>
  renderWithI18n(
    <CookieConsentProvider>
      <CookieConsentBanner />
      <CookiePreferencesModal />
    </CookieConsentProvider>,
    { lng }
  );

// Helper: open the modal via "Customize" in the banner
const openModal = async () => {
  localStorage.clear();
  renderModal();
  fireEvent.click(await screen.findByTestId('cookie-banner-customize'));
  return screen.findByTestId('cookie-preferences-modal');
};
```

### Test cases

```typescript
describe('CookiePreferencesModal', () => {
  it('renders modal when Customize is clicked', async () => {
    await openModal();
    expect(screen.getByTestId('cookie-preferences-modal')).toBeInTheDocument();
  });

  it('Necessary toggle is checked and disabled', async () => {
    await openModal();
    const toggle = screen.getByTestId('toggle-necessary') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    expect(toggle.disabled).toBe(true);
  });

  it('Analytics and Marketing are unchecked by default on first open', async () => {
    await openModal();
    expect((screen.getByTestId('toggle-analytics') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId('toggle-marketing') as HTMLInputElement).checked).toBe(false);
  });

  it('"Save preferences" saves custom selection', async () => {
    await openModal();
    fireEvent.click(screen.getByTestId('toggle-analytics'));
    fireEvent.click(screen.getByTestId('modal-save-preferences'));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.categories).toEqual({ necessary: true, analytics: true, marketing: false });
  });

  it('"Accept all" inside modal saves all true', async () => {
    await openModal();
    fireEvent.click(screen.getByTestId('modal-accept-all'));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.categories.analytics).toBe(true);
    expect(stored.categories.marketing).toBe(true);
  });

  it('"Reject all" inside modal saves analytics/marketing false', async () => {
    await openModal();
    fireEvent.click(screen.getByTestId('modal-reject-all'));
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!);
    expect(stored.categories.analytics).toBe(false);
    expect(stored.categories.marketing).toBe(false);
  });

  it('Escape key closes modal without saving', async () => {
    await openModal();
    await userEvent.keyboard('{Escape}');
    // Modal should no longer be in the DOM
    expect(screen.queryByTestId('cookie-preferences-modal')).not.toBeInTheDocument();
    // Nothing written (localStorage still empty after Escape)
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('pre-populates toggles from stored consent when opened from footer', async () => {
    // Seed an existing decision with analytics: true
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      categories: { necessary: true, analytics: true, marketing: false },
    }));
    renderModal();
    // No banner (hasDecision = true) — open via footer (simulated via openPreferences directly)
    // Since there's no footer in this test, test the context hook-level behaviour instead:
    // Re-render with a button that calls openPreferences
    // (see caveat below on testing footer integration separately)
  });
});
```

### Caveats

- The portal renders into `document.body`, which is also where RTL's container sits. `screen.findByTestId(...)` works correctly because RTL queries the entire `document` by default.
- The "pre-populated from footer" scenario is best tested in an integration test that also renders `StorefrontFooter`. For unit testing, directly assert that the `useEffect` syncs `consent.analytics` into `localConsent` by opening with a seeded context.
- Focus assertion tests (`focus moves to first element on open`) are tricky in jsdom because `focus()` is a no-op unless `document.activeElement` tracking is enabled. jsdom does track `activeElement` — but only for elements that exist in the DOM. This should work with the portal approach.

---

## File 10 — `frontend/src/i18n/index.ts`

**Action:** MODIFY

### Changes

Add two imports at the top (after the existing `esAdmin`/`enAdmin` imports):

```typescript
import esCookies from './locales/es/cookies.json';
import enCookies from './locales/en/cookies.json';
```

Add `cookies` namespace to each locale in the `resources` object:

```typescript
resources: {
  es: {
    // ... existing namespaces ...
    admin: esAdmin,
    cookies: esCookies,   // ADD THIS LINE
  },
  en: {
    // ... existing namespaces ...
    admin: enAdmin,
    cookies: enCookies,   // ADD THIS LINE
  },
},
```

No other changes. The `defaultNS` remains `'common'`. Components that need the cookies namespace must pass `useTranslation('cookies')` or `{ ns: 'cookies' }` explicitly.

---

## File 11 — `frontend/src/test-utils/renderWithI18n.tsx`

**Action:** MODIFY

### Changes

Add two imports (after the existing `esPages`/`enPages` imports):

```typescript
import esCookies from '../i18n/locales/es/cookies.json';
import enCookies from '../i18n/locales/en/cookies.json';
```

Add `cookies` to the resources inside `createTestI18n`:

```typescript
resources: {
  es: { common: esCommon, auth: esAuth, catalog: esCatalog, cart: esCart, account: esAccount, admin: esAdmin, pages: esPages, cookies: esCookies },
  en: { common: enCommon, auth: enAuth, catalog: enCatalog, cart: enCart, account: enAccount, admin: enAdmin, pages: enPages, cookies: enCookies },
},
```

No other changes.

---

## File 12 — `frontend/src/App.tsx`

**Action:** MODIFY

### Changes

1. Add import at the top:

```typescript
import { CookieConsentProvider } from './contexts/CookieConsentContext';
```

2. Wrap the storefront `<Route element={...}>` to scope the provider to storefront only:

**Before:**
```tsx
<Route element={<StorefrontLayout />}>
  {/* storefront routes */}
</Route>
```

**After:**
```tsx
<Route element={<CookieConsentProvider><StorefrontLayout /></CookieConsentProvider>}>
  {/* storefront routes — UNCHANGED */}
</Route>
```

This is a one-line change to the `element` prop. **Do not restructure the `<Routes>` tree.** The admin routes remain completely unaffected.

### Why here, not in `StorefrontLayout`

The provider wraps `StorefrontLayout`, meaning `StorefrontFooter` (rendered inside `StorefrontLayout`) can call `useCookieConsent()` without prop drilling. If the provider were inside `StorefrontLayout`, `StorefrontLayout` itself could not consume the hook and neither could the footer without drilling.

---

## File 13 — `frontend/src/components/storefront/StorefrontLayout.tsx`

**Action:** MODIFY

### Changes

1. Add imports:

```typescript
import CookieConsentBanner from './CookieConsentBanner';
import CookiePreferencesModal from './CookiePreferencesModal';
```

2. Add both components to the JSX, after `<StorefrontFooter />`:

```tsx
return (
  <div className="storefront-root">
    <StorefrontHeader />
    <main style={{ flex: 1, minWidth: 0, width: '100%' }}>
      <Outlet />
    </main>
    <StorefrontFooter />
    <CookieConsentBanner />
    <CookiePreferencesModal />
  </div>
);
```

### Why after `<StorefrontFooter />`

- `CookieConsentBanner` uses `position: fixed` so its DOM position does not affect layout.
- `CookiePreferencesModal` uses a portal (`ReactDOM.createPortal` → `document.body`), so its DOM position here is irrelevant — it renders outside `storefront-root` anyway.
- Placing them last keeps `storefront-root` semantics clean.

---

## File 14 — `frontend/src/components/storefront/StorefrontFooter.tsx`

**Action:** MODIFY

### Changes

1. Add import at the top (after existing imports):

```typescript
import { useCookieConsent } from '../../contexts/CookieConsentContext';
```

2. Inside the component, destructure `openPreferences`:

```typescript
const { openPreferences } = useCookieConsent();
```

3. Add the "Cookie settings" button to the bottom bar, between the existing `<Link to="/pages/legal">` and the closing `</div>`:

```tsx
<div className="storefront-footer__bottom">
  <div className="storefront-footer__bottom-inner">
    <span>&copy; {new Date().getFullYear()} Mavile</span>
    <span>{t('footer.cities')}</span>
    <Link to="/pages/privacy">{t('footer.link.privacy')}</Link>
    <Link to="/pages/legal">{t('footer.link.legal')}</Link>
    {/* ADD THIS: */}
    <button
      type="button"
      onClick={openPreferences}
      className="storefront-footer__cookie-settings"
      data-testid="footer-cookie-settings"
    >
      {t('footer.cookieSettings', { ns: 'cookies' })}
    </button>
  </div>
</div>
```

### Edge cases / caveats

- The existing `useTranslation('common')` call is unchanged. The new key uses `{ ns: 'cookies' }` to look up in the cookies namespace without adding a second `useTranslation` call.
- `useCookieConsent()` will throw if `StorefrontFooter` is rendered outside `CookieConsentProvider`. Since `StorefrontFooter` is only ever rendered inside `StorefrontLayout`, which is always wrapped by `CookieConsentProvider` (via `App.tsx`), this is safe. Tests that render `StorefrontFooter` in isolation must wrap it with `CookieConsentProvider`.

---

## File 15 — `frontend/src/styles/storefront.css`

**Action:** MODIFY

### Changes

Append the following block to the end of the file. Follow BEM naming already used in the file (`storefront-cookie__*`). Use only tokens from `tokens.css`.

```css
/* ============================================================
   Cookie Consent Banner & Preferences Modal
   ============================================================ */

/* --- Banner --- */
.storefront-cookie__banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 150;
  background-color: var(--color-white);
  border-top: 1px solid var(--color-light);
  box-shadow: 0 -4px 24px rgba(26, 26, 24, 0.08);
  padding: var(--spacing-6);
  transform: translateY(0);
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.storefront-cookie__banner-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: var(--spacing-6);
  flex-wrap: wrap;
}

.storefront-cookie__banner-message {
  flex: 1;
  min-width: 240px;
  font-size: var(--font-size-sm);
  color: var(--color-near-black);
  line-height: 1.5;
  margin: 0;
}

.storefront-cookie__banner-actions {
  display: flex;
  gap: var(--spacing-3);
  flex-wrap: wrap;
  flex-shrink: 0;
}

/* --- Modal overlay (portal renders at document.body) --- */
.storefront-cookie__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(26, 26, 24, 0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
}

/* --- Modal card --- */
.storefront-cookie__modal {
  background-color: var(--color-white);
  border-radius: var(--radius-md);
  max-width: 560px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--spacing-8);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.storefront-cookie__modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-4);
}

.storefront-cookie__modal-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-near-black);
  margin: 0;
}

/* --- Category list --- */
.storefront-cookie__categories {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.storefront-cookie__category {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-4);
  padding: var(--spacing-4) 0;
  border-bottom: 1px solid var(--color-light);
}

.storefront-cookie__category:last-child {
  border-bottom: none;
}

.storefront-cookie__category-info {
  flex: 1;
}

.storefront-cookie__category-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-near-black);
  margin: 0 0 var(--spacing-1);
}

.storefront-cookie__category-desc {
  font-size: var(--font-size-xs);
  color: var(--color-mid);
  line-height: 1.5;
  margin: 0;
}

/* --- Toggle (pill switch) --- */
.storefront-cookie__toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  margin-top: 2px;
  cursor: pointer;
}

.storefront-cookie__toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.storefront-cookie__toggle-track {
  position: absolute;
  inset: 0;
  background-color: var(--color-light);
  border-radius: 12px;
  transition: background-color 0.2s ease;
}

.storefront-cookie__toggle input:checked + .storefront-cookie__toggle-track {
  background-color: var(--color-near-black);
}

.storefront-cookie__toggle input:disabled + .storefront-cookie__toggle-track {
  opacity: 0.45;
  cursor: not-allowed;
}

.storefront-cookie__toggle-track::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 3px;
  width: 18px;
  height: 18px;
  background-color: var(--color-white);
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.storefront-cookie__toggle input:checked + .storefront-cookie__toggle-track::after {
  transform: translateX(20px);
}

.storefront-cookie__toggle input:focus-visible + .storefront-cookie__toggle-track {
  outline: 2px solid var(--color-near-black);
  outline-offset: 2px;
}

/* --- Modal action row --- */
.storefront-cookie__modal-actions {
  display: flex;
  gap: var(--spacing-3);
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* --- Footer cookie settings button --- */
.storefront-footer__cookie-settings {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
  text-decoration: underline;
  line-height: inherit;
}

.storefront-footer__cookie-settings:hover {
  color: var(--color-near-black);
}

.storefront-footer__cookie-settings:focus-visible {
  outline: 2px solid var(--color-near-black);
  outline-offset: 2px;
}

/* --- Reduced motion overrides --- */
@media (prefers-reduced-motion: reduce) {
  .storefront-cookie__banner,
  .storefront-cookie__toggle-track,
  .storefront-cookie__toggle-track::after {
    transition: none;
  }
}
```

### Notes on button styling

The banner action buttons (`storefront-btn--primary`, `storefront-btn--ghost`) are referenced in File 5. If those utility classes do not exist in `storefront.css`, define minimal versions here:

```css
.storefront-btn { ... }
.storefront-btn--primary { background-color: var(--color-near-black); color: var(--color-white); ... }
.storefront-btn--ghost { background: none; border: 1px solid var(--color-near-black); ... }
```

Check `storefront.css` for existing button utilities before adding.

---

## File 16 — `frontend/src/index.tsx`

**Action:** MODIFY

### Changes

The goal is to gate `reportWebVitals` behind analytics consent without React context (this file runs before React mounts).

**Before:**
```typescript
reportWebVitals();
```

**After:**
```typescript
import {
  ANALYTICS_CONSENT_EVENT,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  CONSENT_EXPIRY_DAYS,
} from './constants/cookieConsent';

/** Reads consent from localStorage synchronously before React mounts. */
function hasAnalyticsConsentOnBoot(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const record = JSON.parse(raw) as { version?: string; timestamp?: string; categories?: { analytics?: boolean } };
    if (record.version !== CONSENT_VERSION) return false;
    const ageMs = Date.now() - new Date(record.timestamp ?? '').getTime();
    if (ageMs > CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000) return false;
    return record.categories?.analytics === true;
  } catch {
    return false;
  }
}

// Bootstrap check
if (hasAnalyticsConsentOnBoot()) {
  reportWebVitals();
}

// Runtime check — fires when user grants analytics consent during this session
window.addEventListener(
  ANALYTICS_CONSENT_EVENT,
  () => { reportWebVitals(); },
  { once: true }
);
```

### Edge cases / caveats

- `{ once: true }` on the event listener ensures `reportWebVitals` is called at most once even if the user somehow triggers `saveConsent` multiple times with `analytics: true`.
- The `CONSENT_EXPIRY_DAYS` check here duplicates `isConsentValid` from the context. This is intentional: `index.tsx` cannot import from the context (it would create a circular module dependency or force the entire React tree to load before the guard runs). The logic is small enough to be acceptable duplication.
- Do NOT move the `reportWebVitals()` import below the `root.render()` call — imports are hoisted regardless, but keeping the logic together makes intent clear.
- The existing comment `// If you want to start measuring performance...` can be removed or updated to explain the gating.

---

## Cross-Cutting Notes

### i18n namespace usage pattern

All cookie-related strings MUST use `useTranslation('cookies')` or the `{ ns: 'cookies' }` option. Never use `t('cookies:...')` with a namespace prefix in the key — react-i18next resolves namespaces via the `ns` argument, not via key prefixes (though both work, the explicit `ns` argument is the project convention from `frontend-standards.md`).

### localStorage key collision

The app already uses `mavile.lang` (language preference). Using `mavile.cookieConsent` follows the same namespacing prefix and avoids collision with Cart (`storefront_cart`) or scroll positions (`scroll:<key>`).

### Test isolation

Every test file that touches `localStorage` MUST call `localStorage.clear()` in `beforeEach`. jsdom shares `localStorage` across tests in the same file unless explicitly cleared.

### Tests must not use `waitFor + getBy*` for the same assertion

Per `frontend-standards.md` ESLint rule `testing-library/prefer-find-by`:
- Use `await screen.findByTestId('...')` — not `await waitFor(() => screen.getByTestId('...'))`.
- Run `cd frontend && npx eslint src --ext .ts,.tsx` before marking any test step complete.

### Storefront-only scope

`CookieConsentProvider` is scoped to the storefront subtree only. Admin components (`/products`, `/orders`, etc.) must never import or call `useCookieConsent`. The admin panel has no consent requirement (internal tool, no user tracking).
