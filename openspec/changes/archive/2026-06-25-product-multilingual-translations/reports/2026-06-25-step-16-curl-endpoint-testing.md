# Step 16 — curl endpoint testing

**Date:** 2026-06-25  
**Status:** PASS  
**Product ID used:** 46

| Step | Result | Detail |
|------|--------|--------|
| 16.1 | PASS | Backend reachable, admin login 200 |
| 16.8-prep | PASS | PUT translations/es → 200 |
| 16.2 | PASS | GET public list ES → 200, Vary=Accept-Language, name=Gafas de Sol de Acetato |
| 16.3 | PASS | GET public list EN → name=Acetate Sunglasses |
| 16.4 | PASS | GET public detail ES → name=Gafas de Sol de Acetato |
| 16.5 | PASS | GET public detail fr fallback → name=Acetate Sunglasses |
| 16.6 | PASS | GET admin product translations array=true |
| 16.7 | PASS | GET translations → count=2 |
| 16.8 | PASS | PUT translations/es → 200 |
| 16.9 | PASS | PUT fr → 422 code=TRANSLATION_LOCALE_INVALID |
| 16.10 | PASS | DELETE es → 204 |
| 16.11 | PASS | DELETE xx → 404 code=TRANSLATION_NOT_FOUND |
| 16.12 | PASS | POST with translations → 201 id=47 |
| 16.13 | PASS | Public response has no supplier fields |

All checks executed against `http://localhost:3000` with Docker stack running.
