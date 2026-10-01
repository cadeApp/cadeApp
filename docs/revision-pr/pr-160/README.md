# PR #160 — T-303 — E2E del flujo principal

- **PR:** #160
- **Tarea:** T-303
- **Rama:** `feat/T-303-main-flow`
- **Base:** `develop`
- **Ronda actual:** 1
- **SHA revisado:** `803632187079aab355b3cadb8d20477a50ef274d`
- **Resultado:** CON BLOQUEANTES (5)
- **Fecha:** 2026-10-01
- **Revisor:** revisión independiente solicitada por Lautaro073

## Resumen

El spec agregado no prueba el flujo real de cadeApp: intercepta las navegaciones con `page.route(...).fulfill()` y construye el HTML que luego afirma. La aceptación concurrente también simula el endpoint y decide dentro del propio test que la primera llamada sea exitosa y la segunda devuelva `ALREADY_MATCHED`. Además, los flujos de publicar, ofertar, retirar, ordenar y avanzar viaje no ejecutan las acciones que sus nombres declaran.

## Decisión P1

Lautaro073 eligió **1-A** en Ronda 1: T-303 puede ampliar mínimamente el arnés E2E para crear/autenticar/limpiar usuarios de rol reales y ejercitar el flujo en staging.

Archivos adicionales autorizados para el arreglo:
- `e2e/fixtures/**`
- Page Objects estrictamente necesarios dentro de `e2e/pages/**`
- `src/server/e2e/staging-seed.ts`
- `src/server/e2e/staging-seed.test.ts`

La decisión debe quedar documentada en `docs/tasks/T-303.md`. No habilita cambios funcionales de producto ni contratos.

## Archivos de esta revisión

- `revisiones/ronda-1.md`
- `hallazgos.jsonl`
- `evidencia/comandos.md`
- `lecciones.md`
