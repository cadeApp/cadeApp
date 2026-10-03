# Revisión PR #179 — T-304

- **PR:** #179
- **Rama:** `feat/T-304-request-states`
- **SHA funcional revisado R3:** `df768471704ced79f863eb6040764fd081f3dbc7`
- **develop al revisar:** `2e43d71eadd13acf5e92fee5a0142d678fd79059`
- **Ronda:** 3
- **Resultado:** **CON BLOQUEANTES (7)**
- **CI general exact-head:** GREEN
- **Vercel Preview exact-head:** GREEN
- **e2e-preview exact-head:** **RED** — run `37081233672`
- **Resultado Playwright:** 16 passed · 3 failed T-304 · 1 flaky T-303
- **Decisiones P1 vigentes:** D01 = 1-A; D02 = 2-A.

R3 verifica que la reescritura ya es un E2E real: Filas 1–7 pasaron contra Supabase Develop. El cierre queda bloqueado por dos fallos reales del arnés (cleanup de incidents y bootstrap admin), un oráculo TTL fail-open, una afirmación incorrecta sobre push, la ausencia del postcondition de no-incidente fuera de 24 h, la evidencia RED de negocio todavía pendiente y la sincronización final con develop.
