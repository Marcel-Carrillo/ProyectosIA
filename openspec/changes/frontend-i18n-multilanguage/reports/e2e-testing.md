# E2E Test Report — frontend-i18n-multilanguage

**Date:** 2026-06-21  
**Tool:** Playwright MCP  
**Base URL:** http://localhost:3002 (local CRA dev server)

## Test Results

| # | Workflow | Outcome |
|---|----------|---------|
| 1 | Navigate to `/catalog` — verify default Spanish | ✅ |
| 2 | Click 🇬🇧 English flag — verify language switches | ✅ |
| 3 | Verify hero title in English: "A discreet selection of pieces made to last." | ✅ |
| 4 | Verify nav label: "ALL" (was "TODO") | ✅ |
| 5 | Verify product count: "40 PIECES" (was "40 PIEZAS") | ✅ |
| 6 | Verify search placeholder: "Search" (was "Buscar") | ✅ |
| 7 | Verify sort label: "NEWEST" (was "MÁS RECIENTE") | ✅ |
| 8 | Verify footer English: "Timeless pieces made in Europe…" / "Madrid · Lisbon · Paris" | ✅ |
| 9 | Verify `document.documentElement.lang = 'en'` | ✅ |
| 10 | Verify `localStorage['mavile.lang'] = 'en'` | ✅ |
| 11 | Reload page — verify English persists (preference stored in localStorage) | ✅ |
| 12 | Navigate to admin route `/products` → redirected to `/admin/login` | ✅ |
| 13 | Verify `.storefront-lang-switcher` is ABSENT on admin page | ✅ |

## Key Assertions

- **Default language:** Spanish (fallbackLng: 'es') before any preference is stored
- **Language switch:** Instant reactive update — no page reload required
- **Persistence:** `localStorage['mavile.lang']` persists preference across navigation and reload
- **html[lang]:** Synced via `useEffect` in `StorefrontLayout` on every language change
- **Admin isolation:** Language switcher component is not rendered outside `StorefrontLayout`
