# Step 11 — E2E Testing Report

**Date:** 2026-06-28
**Change:** cookie-consent-banner
**Branch:** feature/cookie-consent-banner
**Environment:** Docker (frontend :3001, backend :3000)

## Results Summary

| # | Test | Result |
|---|------|--------|
| 11.2 | Banner aparece en primera visita (localStorage vacío) | PASS |
| 11.3 | "Aceptar todo" guarda `analytics: true, marketing: true` y cierra banner | PASS |
| 11.4 | Recarga sin banner (decisión válida en localStorage) | PASS |
| 11.5 | "Ajustes de cookies" en footer abre modal con toggles pre-populados | PASS |
| 11.6 | "Personalizar" → analytics OFF → "Guardar" → `analytics: false`, modal cierra | PASS |
| 11.7 | "Rechazar todo" guarda `analytics: false, marketing: false` | PASS |
| 11.8 | Tecla Escape cierra modal sin guardar | PASS |
| 11.9 | Estado localStorage restaurado a limpio | PASS |

## Screenshots

- **Banner en primera visita:** visible en viewport inferior, no bloquea el scroll
- **Modal desde footer:** abre con "Preferencias de cookies", tres categorías (Necesarias, Analíticas, Marketing), botones Rechazar todo / Guardar preferencias / Aceptar todo
- **Toggles pre-populados:** Analíticas y Marketing activos cuando la decisión previa fue "Aceptar todo"

## Notes

- El banner aparece con la decisión pre-establecida en "Rechazar todo" como valor por defecto
- El modal usa `ReactDOM.createPortal` → aparece sobre todo el contenido incluyendo el footer
- El teclado Escape funciona correctamente (focus trap con `document.addEventListener('keydown')`)
- El botón "Ajustes de cookies" en el footer es funcional y abre el modal con el estado actual persistido
- La versión `CONSENT_VERSION='1'` está en localStorage con el formato correcto `{ version, timestamp, categories }`
