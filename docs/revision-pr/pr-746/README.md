# PR #746 — T-437 / CC-052 · Follow-up: selector de aprobación en E2E

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/746 |
| Tarea | T-437 / CC-052 (issue #670; implementación mergeada en #744) |
| Autor | @Lautaro073 |
| Rama | `feat/T-437-e2e-reason-locator` → `develop` |
| Base revisada | `1a231dfa00ad35fd1e51c0079925767d9dc15f5e` |
| SHA revisado | `3da9a12ebd9780d2a0a3cf64fdf76d4af854d152` |
| Diff previo al commit de revisión | 2 archivos, +33/-2 líneas |
| Fecha local | 2026-11-13 (Argentina) |
| Resultado R1 | **SIN BLOQUEANTES DE CÓDIGO**; validación E2E de aprobación pendiente post-merge |

## Rondas

| Ronda | SHA revisado | Hallazgos nuevos | Informe |
|---|---|---|---|
| 1 | `3da9a12ebd9780d2a0a3cf64fdf76d4af854d152` | 0 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Alcance comprobado

- `e2e/specs/courier-onboarding.spec.ts`: el motivo y el botón de aprobación se consultan dentro del `toolbar` con nombre accesible `ADMIN_COPY.detail.actionsBarLabel`; la aserción `toBeDisabled()` y las comprobaciones RPC/estado/auditoría permanecen.
- `docs/tasks/log/T-437.md`: registra ejecución de `migrate`, dos mutaciones confirmadas, un control no verde y el seguimiento.
- Sin modificación de `docs/tasks/T-437.md`, producto, manifest, patches ni `expectedFailure`.

## Evidencias y límites

- [43532734795](https://github.com/cadeApp/cadeApp/actions/runs/43532734795): en `1a231dfa00ad35fd1e51c0079925767d9dc15f5e`, control **CONTROL_NOT_GREEN** por strict mode, dos motivos de texto iguales. Mutante rojo no clasificable como confirmación porque el control estaba rojo.
- [43532735200](https://github.com/cadeApp/cadeApp/actions/runs/43532735200): `t437-ui-reactivate-guard`, control 1 passed, mutante rojo en `toBeDisabled()`, **RED_CONFIRMED**.
- [43532737982](https://github.com/cadeApp/cadeApp/actions/runs/43532737982): `t437-ui-reconsider-guard`, segundo intento, control 1 passed, mutante rojo en `toBeDisabled()`, **RED_CONFIRMED**.
- [43534547830](https://github.com/cadeApp/cadeApp/actions/runs/43534547830): CI de `3da9a12ebd9780d2a0a3cf64fdf76d4af854d152`; al inspeccionar, `lint`, `typecheck`, `unit`, `build`, `audit` y `bundle-budget` completados con éxito; `db-tests` todavía en curso.
- Esta revisión ejecutó inspección y perturbaciones estructurales de tres condiciones, **no** Playwright, pgTAP ni Docker locales. El origen exacto del segundo nodo no está demostrado; el marcador de streaming huérfano es correlación, no causalidad.

## Pendiente operativo (POST-MERGE)

1. P1 mergea solo cuando lo decida; esta revisión no aprueba ni mergea.
2. Con la corrección ya en la punta de `develop`, despachar **una sola vez** el evento `e2e.mutation.requested` con `client_payload` `{ "target": "develop", "mutation": "t437-ui-approve-guard" }`. No hacerlo antes del merge: el workflow toma `develop` y no la rama del PR.
3. Exigir control GREEN (1 caso) y mutante RED en la aserción `toBeDisabled`, con clasificación `RED_CONFIRMED`. Registrar ID de run, SHA y salida en `docs/tasks/log/T-437.md`; si sale `CONTROL_NOT_GREEN`, no cerrar el issue.
4. La subsanación E2E queda sin confirmación de ejecución en Develop; no presentarla como cubierta por esta PR.

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) (vacío: 0 hallazgos) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).
