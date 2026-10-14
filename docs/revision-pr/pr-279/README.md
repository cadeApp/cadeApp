# PR #279 — T-344 · Vitest 4 y source-map-js parcheado

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/279 |
| **Tarea** | T-344 (Fase 3 — Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-344-audit-vitest4` → `develop` |
| **Base** | `f3d00ed435bbbcaec448f7afc6ac356fb8494960` |
| **Estado** | **SIN BLOQUEANTES — ronda 1** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `320938f01b3a71c278f7c51a995e74e1e2e94e37` | **SIN BLOQUEANTES** | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Resumen de verificación

- `develop` sigue exactamente en la base de la PR: la rama está 2 commits adelante y 0 detrás.
- Los 7 archivos modificados están dentro del alcance original o de las decisiones 1-A / 2-A autorizadas por Lautaro073.
- La ampliación de `docs/tasks/T-344.md` solo registra esas decisiones y el fallo preexistente de `next/font`; no amplía el objetivo funcional.
- RED de audit reproducido en CI de `develop`: 7 vulnerabilidades, con 2 critical y 2 high (1 ignored).
- RED de Vitest 4 reproducido en el primer commit de la PR: `offers.test.ts` falla 1/1921 exactamente por 4 llamadas acumuladas a `createAdminClient`.
- GREEN final del mismo código revisado: CI `unit` 121/121 archivos y 1921/1921 tests, cobertura 83.2/78.51/78.48/83.73; `audit` queda en 1 moderate + 1 high ya ignorado; `db-tests` 18 archivos / 1811 tests PASS.
- Build, bundle-budget, Vercel y `e2e-preview` están verdes.
- `approval-policy` estaba rojo antes de esta revisión porque faltaba el informe independiente.

No quedan hallazgos técnicos ni decisiones pendientes.
