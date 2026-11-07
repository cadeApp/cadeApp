# PR #542 — T-414 · Novedades y promociones por push y banner

**PR:** https://github.com/cadeApp/cadeApp/pull/542 · **Autor:** @Lautaro073 · **Rama:** `feat/T-414-announcements` → `develop`.

**Estado final de revisión:** **SIN BLOQUEANTES — ACEPTADA en ronda 2** sobre HEAD de código `36cc8dcf519b540b0043ea757047421ce15f8c66`. No es aprobación ni merge de GitHub. La PR continúa abierta/draft hasta que Lautaro073 decida.

## Rondas

| Ronda | SHA de código | Resultado | Informe |
|---|---|---|---|
| 1 | `204402e2aa8075d5fc405e62ce121af0c89030be` | CON BLOQUEANTES (H05, H06), H07 mejora | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `36cc8dcf519b540b0043ea757047421ce15f8c66` | **SIN BLOQUEANTES**; H05–H07 resueltos | [ronda-2.md](revisiones/ronda-2.md) |

## Estado final de los hallazgos

| ID | Estado |
|---|---|
| H01–H04 | corregidos desde ronda 1 por inspección + CI GREEN; mutaciones del autor no reproducidas independientemente |
| H05 | **corregido**; matriz por RPC, RED CI #544 (tests 18–20), GREEN CI #542 (63 pgTAP) |
| H06 | **corregido**; sin timers, GREEN unit CI; mutación local RED informada por autor |
| H07 | **corregido**; texto de ficha reconciliado con RLS restrictiva D01=A |

## Evidencia clave

- `db-tests`: `Files=39, Tests=3216, Result: PASS` del HEAD funcional `238b5a0b19395465eefcc8ffef2c5c31af4745f5` (sin cambios de código desde ese SHA), tipos generados iguales.
- `unit` de `36cc8dcf519b540b0043ea757047421ce15f8c66`: 177/177 archivos y 3361/3361 tests PASS, typecheck/lint/build/audit/bundle-budget PASS.
- PR #544 `REVIEW ONLY / NEVER MERGE` **cerrada sin mergear**, RED preciso.
- Preview de Vercel desplegada; E2E no ejecutado (workflow skipped, check externo e2e-preview=error).
- `develop` no está por delante de la rama al cierre; GitHub `mergeable=true`.

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md).

**Pendiente fuera de revisión de código:** tras el merge/migración a develop, E2E en develop/preview según la ficha; después promoción a staging/main según decisión de Lautaro073. El revisor no mergeó ni aprobó.
