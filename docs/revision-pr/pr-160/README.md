# PR #160 — T-303 — E2E del flujo principal

- **PR:** #160
- **Tarea:** T-303
- **Rama:** `feat/T-303-main-flow`
- **Base:** `develop`
- **Ronda actual:** 2
- **SHA revisado:** `e268f5c2f4e72fdcb2592996b50b027062e2464a`
- **develop al revisar:** `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`
- **Resultado:** CON BLOQUEANTES (8)
- **Fecha:** 2026-10-01
- **Revisor:** revisión independiente solicitada por Lautaro073

## Resumen Ronda 2

La reescritura elimina los mocks HTML/RPC de la Ronda 1 y ahora usa UI/backend reales, pero todavía no es cerrable:

- la rama quedó 25 commits detrás de `develop`;
- la concurrencia no afirma el estado final exacto y acepta cualquier `role=alert` como si fuera `ALREADY_MATCHED`;
- el test del piso inicia con una oferta pending ya seeded para el mismo courier, por lo que su request propio no muestra “Ofertar”;
- las solicitudes creadas por UI no se incorporan al tracking de cleanup y bloquean el teardown por FK;
- la bitácora declara RED/GREEN imposibles de reconciliar con el mismo registro que dice que Playwright fue bloqueado por fail-closed;
- el body marca DoD/checks completos sin salida de `pnpm test`, `pnpm test:db` ni corrida real de T-303 en staging;
- se introdujeron `any` y non-null assertions nuevos en archivos tocados.

## Decisión P1 vigente

Lautaro073 eligió **1-A** en Ronda 1: T-303 puede ampliar mínimamente el arnés E2E para crear/autenticar/limpiar usuarios de rol reales y ejercitar el flujo en staging.

Archivos adicionales autorizados:
- `e2e/fixtures/**`
- Page Objects estrictamente necesarios dentro de `e2e/pages/**`
- `src/server/e2e/staging-seed.ts`
- `src/server/e2e/staging-seed.test.ts`

No se reabre ninguna decisión de producto en Ronda 2.

## Archivos de esta revisión

- `revisiones/ronda-1.md`
- `revisiones/ronda-2.md`
- `hallazgos.jsonl`
- `evidencia/comandos.md`
- `lecciones.md`
