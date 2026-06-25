# Implementation Plan — legal-pages-frontend (Frontend)

> Agent: frontend-developer
> Branch: `feature/legal-pages-frontend`
> Scope: frontend-only — no backend, API, or database changes.

---

## Important Pre-Check: ContentPage.tsx Is Already Updated

Reading `frontend/src/pages/storefront/ContentPage.tsx` shows that `VALID_SLUGS` already
contains `'privacy'` and `'legal'` at lines 14–15:

```typescript
const VALID_SLUGS = [
  'shipping',
  'returns',
  'size-guide',
  'contact',
  'our-story',
  'materials',
  'sustainability',
  'press',
  'privacy',   // ← already present
  'legal',     // ← already present
] as const;
```

Tasks 1.1–1.3 are effectively pre-done. No change is required to `ContentPage.tsx`.
Verify TypeScript still compiles (`npx tsc --noEmit` in `frontend/`) before moving on
and confirm the guard at line 29 works correctly for both new slugs.

---

## 1. ContentPage.tsx — VALID_SLUGS

**File:** `frontend/src/pages/storefront/ContentPage.tsx`

**Action:** No code change needed — `'privacy'` and `'legal'` are already in `VALID_SLUGS`.

**Verification only:**
- Run `npx tsc --noEmit` from `frontend/` — must exit 0.
- Confirm the `Navigate` guard at line 29 redirects `/pages/unknown-slug` to `/catalog`.

---

## 2. es/pages.json — Full JSON blocks to add

**File:** `frontend/src/i18n/locales/es/pages.json`

**Action:** Add two sibling keys — `"privacy"` and `"legal"` — at the top level, **after the
existing `"press"` key** and **before the closing `}`** of the root object.

Insert the following content (replace the trailing `}` of the file with this block plus `}`):

```json
  ,
  "privacy": {
    "eyebrow": "Legal",
    "title": "Política de privacidad",
    "intro": "En cumplimiento del Reglamento (UE) 2016/679 (RGPD), [RAZÓN SOCIAL] te informa sobre el tratamiento de tus datos personales.",
    "sections": [
      {
        "heading": "Responsable del tratamiento",
        "body": "Identidad: [RAZÓN SOCIAL] · NIF: [NIF] · Domicilio social: [DOMICILIO] · Correo electrónico: [EMAIL DE CONTACTO]."
      },
      {
        "heading": "Datos personales que tratamos",
        "body": "Nombre, apellidos, dirección de entrega y facturación, dirección de correo electrónico, teléfono y datos de pago (tokenizados por el procesador de pagos). No tratamos categorías especiales de datos."
      },
      {
        "heading": "Finalidad y base jurídica",
        "body": "Gestión del pedido y envío (ejecución del contrato, art. 6.1.b RGPD). Comunicaciones comerciales propias (interés legítimo o consentimiento, art. 6.1.f/a RGPD). Cumplimiento de obligaciones fiscales y contables (obligación legal, art. 6.1.c RGPD)."
      },
      {
        "heading": "Conservación de datos",
        "body": "Los datos del pedido se conservan durante [PERÍODO] años para cumplir las obligaciones fiscales. Los datos de marketing se conservan hasta que retiras el consentimiento o ejerces el derecho de oposición."
      },
      {
        "heading": "Destinatarios",
        "body": "Compartimos tus datos con transportistas (para la entrega), con el procesador de pagos (para el cobro) y con las autoridades competentes cuando exista obligación legal. No cedemos datos a terceros con fines comerciales propios."
      },
      {
        "heading": "Tus derechos",
        "body": "Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [EMAIL DE CONTACTO]. Tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es)."
      },
      {
        "heading": "Delegado de Protección de Datos",
        "body": "Si tienes preguntas sobre el tratamiento de tus datos, puedes contactar con nuestro DPD en: [EMAIL DE CONTACTO]."
      }
    ]
  },
  "legal": {
    "eyebrow": "Legal",
    "title": "Aviso legal",
    "intro": "En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se facilita la siguiente información:",
    "sections": [
      {
        "heading": "Datos identificativos",
        "body": "Denominación social: [RAZÓN SOCIAL] · NIF: [NIF] · Domicilio social: [DOMICILIO] · Correo electrónico: [EMAIL DE CONTACTO] · Inscrita en el Registro Mercantil de [REGISTRO]."
      },
      {
        "heading": "Objeto",
        "body": "El presente Aviso Legal regula el acceso y uso del sitio web mavile.com, titularidad de [RAZÓN SOCIAL], con el fin de poner a disposición de los usuarios información sobre los productos y servicios ofrecidos."
      },
      {
        "heading": "Propiedad intelectual e industrial",
        "body": "Los contenidos del sitio web (textos, imágenes, diseños, logotipos, código fuente) son propiedad de [RAZÓN SOCIAL] o de sus licenciantes y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción total o parcial sin autorización expresa."
      },
      {
        "heading": "Responsabilidad",
        "body": "[RAZÓN SOCIAL] no garantiza la ausencia de errores en los contenidos del sitio ni su actualización permanente. No se asume responsabilidad por daños derivados del uso del sitio web o de la imposibilidad de acceso al mismo."
      },
      {
        "heading": "Legislación aplicable y jurisdicción",
        "body": "Las presentes condiciones se rigen por la legislación española. Para la resolución de cualquier controversia, las partes se someten a los Juzgados y Tribunales de [CIUDAD], salvo que la normativa aplicable establezca otro fuero imperativo."
      }
    ]
  }
```

**Exact edit location:** The file ends at line 155 with `}`. Insert the block above right
before that closing brace, after the `"press"` object's closing `}` on line 153. The
result must be valid JSON (run `npx --yes jsonlint es/pages.json` to verify if needed).

---

## 3. en/pages.json — Full JSON blocks to add

**File:** `frontend/src/i18n/locales/en/pages.json`

**Action:** Same position — after the closing `}` of `"press"` (line 153) and before the
root closing `}` (line 155).

```json
  ,
  "privacy": {
    "eyebrow": "Legal",
    "title": "Privacy Policy",
    "intro": "In compliance with Regulation (EU) 2016/679 (GDPR), [COMPANY NAME] informs you of how we process your personal data.",
    "sections": [
      {
        "heading": "Data Controller",
        "body": "Identity: [COMPANY NAME] · VAT/NIF: [NIF] · Registered address: [ADDRESS] · Email: [CONTACT EMAIL]."
      },
      {
        "heading": "Personal Data We Process",
        "body": "Name, surname, delivery and billing address, email address, phone number, and payment data (tokenised by our payment processor). We do not process special category data."
      },
      {
        "heading": "Purpose and Legal Basis",
        "body": "Order fulfilment and delivery (performance of contract, Art. 6(1)(b) GDPR). Own marketing communications (legitimate interest or consent, Art. 6(1)(f)/(a) GDPR). Compliance with tax and accounting obligations (legal obligation, Art. 6(1)(c) GDPR)."
      },
      {
        "heading": "Data Retention",
        "body": "Order data is retained for [PERIOD] years to fulfil tax obligations. Marketing data is retained until you withdraw consent or exercise your right to object."
      },
      {
        "heading": "Recipients",
        "body": "We share your data with carriers (for delivery), our payment processor (for payment), and competent authorities where legally required. We do not sell data to third parties for their own commercial purposes."
      },
      {
        "heading": "Your Rights",
        "body": "You may exercise your rights of access, rectification, erasure, objection, restriction, and portability by writing to [CONTACT EMAIL]. You also have the right to lodge a complaint with your local supervisory authority."
      },
      {
        "heading": "Data Protection Officer",
        "body": "If you have questions about how we process your data, you can contact our DPO at: [CONTACT EMAIL]."
      }
    ]
  },
  "legal": {
    "eyebrow": "Legal",
    "title": "Legal Notice",
    "intro": "In compliance with Spanish Law 34/2002 on Information Society Services and Electronic Commerce (LSSI-CE), the following information is provided:",
    "sections": [
      {
        "heading": "Company Information",
        "body": "Company name: [COMPANY NAME] · VAT/NIF: [NIF] · Registered address: [ADDRESS] · Email: [CONTACT EMAIL] · Registered in the Commercial Registry of [REGISTRY]."
      },
      {
        "heading": "Scope",
        "body": "This Legal Notice governs access to and use of the website mavile.com, owned by [COMPANY NAME], for the purpose of providing users with information about the products and services offered."
      },
      {
        "heading": "Intellectual Property",
        "body": "The contents of the website (texts, images, designs, logos, source code) are the property of [COMPANY NAME] or its licensors and are protected by intellectual and industrial property law. Reproduction in whole or in part without express authorisation is prohibited."
      },
      {
        "heading": "Liability",
        "body": "[COMPANY NAME] does not warrant that website content is error-free or permanently up to date. No liability is accepted for damages arising from use of the website or inability to access it."
      },
      {
        "heading": "Applicable Law and Jurisdiction",
        "body": "These terms are governed by Spanish law. For the resolution of any dispute, the parties submit to the Courts and Tribunals of [CITY], unless applicable mandatory consumer law provides otherwise."
      }
    ]
  }
```

**Structural symmetry check:** Both `es/pages.json` and `en/pages.json` must expose
identical top-level keys and identical nested key structure for `privacy` and `legal`
after this change. Verify by diffing the key sets of both files.

---

## 4. es/common.json and en/common.json — Footer link keys to add

### 4.1 es/common.json

**File:** `frontend/src/i18n/locales/es/common.json`

**Action:** Inside the `footer.link` object (lines 28–41), add two new keys **after the
existing `"press": "Prensa"` entry** (currently line 40), before the closing `}` of
`footer.link`.

Exact old string (lines 40–41):
```json
      "press": "Prensa"
    }
```

Replace with:
```json
      "press": "Prensa",
      "privacy": "Política de privacidad",
      "legal": "Aviso legal"
    }
```

### 4.2 en/common.json

**File:** `frontend/src/i18n/locales/en/common.json`

**Action:** Inside the `footer.link` object (lines 28–41), add two new keys **after the
existing `"press": "Press"` entry** (line 40), before the closing `}` of `footer.link`.

Exact old string (lines 40–41):
```json
      "press": "Press"
    }
```

Replace with:
```json
      "press": "Press",
      "privacy": "Privacy Policy",
      "legal": "Legal Notice"
    }
```

---

## 5. StorefrontFooter.tsx — Exact JSX change

**File:** `frontend/src/components/storefront/StorefrontFooter.tsx`

**Action:** Add two `<Link>` elements inside `storefront-footer__bottom-inner`, after the
existing `<span>{t('footer.cities')}</span>`.

`Link` is already imported at line 2 — no new import needed.

Exact old string (lines 74–77):
```jsx
        <div className="storefront-footer__bottom-inner">
          <span>&copy; {new Date().getFullYear()} Mavile</span>
          <span>{t('footer.cities')}</span>
        </div>
```

Replace with:
```jsx
        <div className="storefront-footer__bottom-inner">
          <span>&copy; {new Date().getFullYear()} Mavile</span>
          <span>{t('footer.cities')}</span>
          <Link to="/pages/privacy">{t('footer.link.privacy')}</Link>
          <Link to="/pages/legal">{t('footer.link.legal')}</Link>
        </div>
```

No CSS changes are needed. The links go inline next to the copyright notice, which is
the established convention for legal links in ecommerce footers (per design.md decision).

---

## 6. Tests

### 6.1 renderWithI18n.tsx — prerequisite update

**File:** `frontend/src/test-utils/renderWithI18n.tsx`

**Action:** The `pages` namespace is NOT currently loaded in `renderWithI18n`. Without it,
`ContentPage` tests will see key paths (e.g. `"privacy.title"`) instead of real strings.
Add imports for `esPages` and `enPages` and register them in the `resources` object.

Add these two imports after the existing locale imports (after line 17):
```typescript
import esPages from '../i18n/locales/es/pages.json';
import enPages from '../i18n/locales/en/pages.json';
```

In the `resources` object (inside `createTestI18n`), add `pages` to both locales:
```typescript
es: { common: esCommon, auth: esAuth, catalog: esCatalog, cart: esCart, account: esAccount, admin: esAdmin, pages: esPages },
en: { common: enCommon, auth: enAuth, catalog: enCatalog, cart: enCart, account: enAccount, admin: enAdmin, pages: enPages },
```

This is a non-breaking additive change — existing tests are unaffected.

### 6.2 ContentPage.test.tsx — new file

**File:** `frontend/src/pages/storefront/__tests__/ContentPage.test.tsx`

**Mocks required:**
- `react-router-dom` — mock `useParams` to inject the slug under test; mock `Navigate`
  to detect redirects; mock `Link` to render a plain anchor.

**Full test structure:**

```typescript
import React from 'react';
import { screen } from '@testing-library/react';
import ContentPage from '../ContentPage';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  Navigate: ({ to }: { to: string }) => {
    mockNavigate(to);
    return null;
  },
}));

const { useParams } = require('react-router-dom') as { useParams: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ContentPage — privacy slug (ES)', () => {
  it('renders Spanish privacy title and at least one section heading', async () => {
    useParams.mockReturnValue({ slug: 'privacy' });
    renderWithI18n(<ContentPage />, { lng: 'es' });

    expect(await screen.findByText('Política de privacidad')).toBeInTheDocument();
    expect(await screen.findByText('Responsable del tratamiento')).toBeInTheDocument();
  });
});

describe('ContentPage — privacy slug (EN)', () => {
  it('renders English privacy title and at least one section heading', async () => {
    useParams.mockReturnValue({ slug: 'privacy' });
    renderWithI18n(<ContentPage />, { lng: 'en' });

    expect(await screen.findByText('Privacy Policy')).toBeInTheDocument();
    expect(await screen.findByText('Data Controller')).toBeInTheDocument();
  });
});

describe('ContentPage — legal slug (ES)', () => {
  it('renders Spanish legal title and at least one section heading', async () => {
    useParams.mockReturnValue({ slug: 'legal' });
    renderWithI18n(<ContentPage />, { lng: 'es' });

    expect(await screen.findByText('Aviso legal')).toBeInTheDocument();
    expect(await screen.findByText('Datos identificativos')).toBeInTheDocument();
  });
});

describe('ContentPage — legal slug (EN)', () => {
  it('renders English legal title and at least one section heading', async () => {
    useParams.mockReturnValue({ slug: 'legal' });
    renderWithI18n(<ContentPage />, { lng: 'en' });

    expect(await screen.findByText('Legal Notice')).toBeInTheDocument();
    expect(await screen.findByText('Company Information')).toBeInTheDocument();
  });
});

describe('ContentPage — unknown slug redirect', () => {
  it('redirects to /catalog when slug is not in VALID_SLUGS', () => {
    useParams.mockReturnValue({ slug: 'unknown-slug' });
    renderWithI18n(<ContentPage />, { lng: 'es' });

    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
  });
});
```

**ESLint notes:**
- All async assertions use `findBy*` (no `waitFor + getBy*` combinations).
- Run `npx eslint src --ext .ts,.tsx` before marking this task complete.

### 6.3 StorefrontFooter.test.tsx — new file

**File:** `frontend/src/components/storefront/__tests__/StorefrontFooter.test.tsx`

**Mocks required:**
- `react-router-dom` — mock `Link` to render a plain anchor.
- `../../hooks/useStorefrontCategories` — mock `getHref` to return `'#'`.
- `react-i18next` is provided by `renderWithI18n`.

**Full test structure:**

```typescript
import React from 'react';
import { screen } from '@testing-library/react';
import StorefrontFooter from '../StorefrontFooter';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../../hooks/useStorefrontCategories', () => ({
  useStorefrontCategories: () => ({
    getHref: (_key: string) => '#',
    links: [],
    isLoading: false,
  }),
}));

describe('StorefrontFooter — legal links (ES)', () => {
  it('renders privacy link pointing to /pages/privacy', async () => {
    renderWithI18n(<StorefrontFooter />, { lng: 'es' });

    const privacyLink = await screen.findByRole('link', { name: 'Política de privacidad' });
    expect(privacyLink).toHaveAttribute('href', '/pages/privacy');
  });

  it('renders legal link pointing to /pages/legal', async () => {
    renderWithI18n(<StorefrontFooter />, { lng: 'es' });

    const legalLink = await screen.findByRole('link', { name: 'Aviso legal' });
    expect(legalLink).toHaveAttribute('href', '/pages/legal');
  });
});

describe('StorefrontFooter — legal links (EN)', () => {
  it('renders Privacy Policy link in English', async () => {
    renderWithI18n(<StorefrontFooter />, { lng: 'en' });

    const privacyLink = await screen.findByRole('link', { name: 'Privacy Policy' });
    expect(privacyLink).toHaveAttribute('href', '/pages/privacy');
  });

  it('renders Legal Notice link in English', async () => {
    renderWithI18n(<StorefrontFooter />, { lng: 'en' });

    const legalLink = await screen.findByRole('link', { name: 'Legal Notice' });
    expect(legalLink).toHaveAttribute('href', '/pages/legal');
  });
});
```

**ESLint notes:**
- All assertions use `findByRole` (returns a Promise — satisfies `prefer-find-by`).
- Run `npx eslint src --ext .ts,.tsx` before marking this task complete.

---

## 7. docs/frontend-standards.md — Section to update

**File:** `docs/frontend-standards.md`

**Section:** `### Static Content Pages (\`/pages/:slug\`)` near line 938–954.

**Current text (line 940):**
```
`ContentPage` (`frontend/src/pages/storefront/ContentPage.tsx`) renders static informational pages routed at `/pages/:slug`. The `slug` parameter maps to a key in the `pages` i18n namespace. Supported slugs: `shipping`, `returns`, `size-guide`, `contact`, `our-story`, `materials`, `sustainability`, `press`.
```

**Replace with:**
```
`ContentPage` (`frontend/src/pages/storefront/ContentPage.tsx`) renders static informational pages routed at `/pages/:slug`. The `slug` parameter maps to a key in the `pages` i18n namespace. Supported slugs: `shipping`, `returns`, `size-guide`, `contact`, `our-story`, `materials`, `sustainability`, `press`, `privacy`, `legal`.

> **Legal page placeholders:** The `privacy` and `legal` page content in `es/pages.json` and `en/pages.json` use explicit uppercase bracket placeholders (`[COMPANY NAME]`, `[NIF]`, `[ADDRESS]`, `[CONTACT EMAIL]`, `[RAZÓN SOCIAL]`, `[DOMICILIO]`, etc.) for business-specific data that is unknown during development. These MUST be replaced with real company data (reviewed by a lawyer) before the site goes live.
```

**Also update** the inline example schema below that paragraph (lines 943–951) — add
`eyebrow` to the example to match the actual shape used by all slugs including the new ones:

Current:
```json
{
  "shipping": {
    "title": "...",
    "sections": [
      { "heading": "...", "body": "..." }
    ]
  }
}
```

Replace with:
```json
{
  "shipping": {
    "eyebrow": "...",
    "title": "...",
    "intro": "...",
    "sections": [
      { "heading": "...", "body": "..." }
    ]
  }
}
```

This aligns the documented shape with the actual structure in `pages.json` (every slug
has `eyebrow`, `title`, `intro`, and `sections`).

---

## Summary of Files to Change

| File | Action |
|------|--------|
| `frontend/src/pages/storefront/ContentPage.tsx` | No change — `'privacy'` and `'legal'` already in `VALID_SLUGS` |
| `frontend/src/i18n/locales/es/pages.json` | Add `privacy` and `legal` top-level keys (GDPR/LSSI-CE, ES, with Spanish placeholders) |
| `frontend/src/i18n/locales/en/pages.json` | Add `privacy` and `legal` top-level keys (GDPR/LSSI-CE, EN, with English placeholders) |
| `frontend/src/i18n/locales/es/common.json` | Add `"privacy"` and `"legal"` inside `footer.link` |
| `frontend/src/i18n/locales/en/common.json` | Add `"privacy"` and `"legal"` inside `footer.link` |
| `frontend/src/components/storefront/StorefrontFooter.tsx` | Add two `<Link>` elements in `storefront-footer__bottom-inner` |
| `frontend/src/test-utils/renderWithI18n.tsx` | Add `pages` namespace (es/en) to `resources` — prerequisite for ContentPage tests |
| `frontend/src/pages/storefront/__tests__/ContentPage.test.tsx` | NEW — 5 test cases (privacy ES, privacy EN, legal ES, legal EN, unknown redirect) |
| `frontend/src/components/storefront/__tests__/StorefrontFooter.test.tsx` | NEW — 4 test cases (privacy/legal links in ES and EN) |
| `docs/frontend-standards.md` | Add `privacy`, `legal` to slug list; add placeholder note; fix example schema |

## Execution Order

1. Update `renderWithI18n.tsx` (pages namespace) — tests depend on this.
2. Add content to `es/pages.json` and `en/pages.json`.
3. Add keys to `es/common.json` and `en/common.json`.
4. Update `StorefrontFooter.tsx`.
5. Create `ContentPage.test.tsx`.
6. Create `StorefrontFooter.test.tsx`.
7. Run `npx tsc --noEmit` from `frontend/`.
8. Run `npx eslint src --ext .ts,.tsx` from `frontend/`.
9. Run tests: `npx react-scripts test --watchAll=false --ci --testPathPattern="ContentPage|StorefrontFooter"`.
10. Run full suite: `npx react-scripts test --watchAll=false --ci`.
11. Update `docs/frontend-standards.md`.
