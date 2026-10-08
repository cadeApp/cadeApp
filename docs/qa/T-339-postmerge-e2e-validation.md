# T-339 — Verificación E2E posmigración (temporal)

Esta rama y PR existen **únicamente** para disparar una ejecución real del Preview Playwright de cadeApp después del merge de T-339.

- Esquema: migración de Supabase Develop aplicada en run 37860495764, con resultado success.
- Código de base: develop en commit 24aad21f800f0d13fdeb082f9807b8eaf1f10fba.
- El diff de esta PR solo agrega este archivo; no cambia producto, tests, migraciones, workflows, RLS ni configuraciones.
- El job e2e-preview debe ejecutar el proyecto chromium sobre un Preview Vercel apuntando a Supabase Develop y cubrir e2e/specs/fixed-price.spec.ts.
- **No mergear esta PR de validación**. Se cerrará una vez registrada la evidencia o el bloqueo real del gate. El propio estado success del workflow sin job Playwright ejecutado NO cuenta.
- Si falla algún E2E, T-339 no debe darse por validada hasta corregir o registrar la incidencia y retestar.
