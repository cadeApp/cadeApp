# PR #180 — [T-307] E2E de notificaciones y resiliencia

- **Tarea:** T-307
- **Issue:** #39
- **Rama:** `feat/T-307-notificaciones-resiliencia`
- **Autor:** asako669 (P2)
- **Revisión independiente — ronda 1:** SHA funcional `a62abb26d5fbde522f7cf41a2363e0b2e0b30126` — CON BLOQUEANTES (3)
- **Revisión independiente — ronda 2:** SHA funcional `0a70b6819e67a8c83c6b8ddb8a5f160ff5096240` — CON BLOQUEANTES (2 + dependencia T-327)
- **Revisión independiente — ronda 3:** SHA funcional `ae0758b7c8f8fc88dd2a4201f738835faf200f48` — CÓDIGO CORREGIDO / VERIFICACIÓN E2E T-307 PENDIENTE
- **Proceso:** la autorrevisión previa del agy se preservó como `revisiones/autorrevision-agy-r1.md`; no cuenta como verificación independiente.
- **Decisión P1 D01:** 1-A aplicada — T-206 figura como dependencia de T-307.
- **Infra E2E:** Vercel Preview + Supabase Develop funcionan; el gate trusted actual todavía no ejecuta `notifications.spec.ts`. Follow-up activo en issue #205 / T-327.
