# Revisión PR #179 — T-304

- **PR:** #179
- **Rama:** `feat/T-304-request-states`
- **SHA funcional revisado R2:** `08426ca79bd81e97208a209eff9e81843e7fee66`
- **develop al revisar:** `169b60bb3771fb794184b5a2da5714107391ecd0`
- **merge-base:** `640bc4cd6f86a85f8a7fb235f123a182ac6c2163`
- **Ronda:** 2
- **Resultado:** **CON BLOQUEANTES (6)**
- **CI general del SHA:** GREEN; no cuenta como E2E de T-304.
- **Vercel Preview del SHA:** desplegado.
- **E2E Preview de T-304:** no ejecutado.
- **Decisiones P1 vigentes:** D01 = 1-A; D02 = 2-A.

Ronda 2 confirma una mejora importante: el spec ya usa usuarios autenticados, RPCs reales y lectura de persistencia. Sin embargo todavía no es ejecutable/validado end-to-end: el seed viola una FK, una expectativa contradice la RPC vigente, el spec no está incluido en los gates de Preview/Staging, la evidencia RED sigue viniendo de unitarios y la rama quedó 26 commits detrás de develop.
