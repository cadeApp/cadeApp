# PR #299 — T-339 · Precio opcional y toma directa

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/299 |
| Autor | @asako669 |
| Rama | `feat/T-339-precio-fijo` → `develop` |
| Base | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| HEAD de código de R3 | `4836122bbbea3266e3832a2f8d670b52b411dc70` |
| Decisión previa de alcance | Opción A: `src/ui/ui-system.test.tsx` permitido |
| Estado | **R3: 4 bloqueantes — NO MERGEAR** |

## Rondas

| Ronda | SHA inspeccionado | Estado | Informe |
|---|---|---|---|
| 1 | `6fbde29f48cc502ff497d18c4488fcd442246bf6` | 9 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `5250d51922bf67a2f2555fe824c791ffe94ab1a3` | 5 bloqueantes | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `4836122bbbea3266e3832a2f8d670b52b411dc70` | 4 bloqueantes: H05, H14, H15, H16 | [ronda-3.md](revisiones/ronda-3.md) |

## Estado de hallazgos

| ID | Sev. | Estado más reciente |
|---|---|---|
| H01 | critico | cerrado R2 |
| H02 | alto | código corregido; E2E pendiente |
| H03 | alto | código corregido; pgTAP pendiente |
| H04 | alto | 45 aserciones; 42 ejecutadas, CI rojo |
| H05 | alto | ABIERTO: E2E no ejecutado |
| H06 | alto | CERRADO: CI unit 90.04% branches |
| H07 | medio | test corregido; unit verde |
| H08 | alto | E2E de formulario no ejecutado |
| H09 | medio | cerrado R2 |
| H10 | bajo | mejora no bloqueante |
| H11 | alto | CERRADO: rpc_requests PASS |
| H12 | alto | CERRADO: rpc_requests PASS |
| H13 | alto | fixture zona válido; suite incompleta |
| H14 | alto | ABIERTO: oráculo en RLS |
| H15 | alto | ABIERTO: INSERT oferta artificial |
| H16 | alto | ABIERTO: E2E falso consentimiento |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## CI relevante

Run `37759343648` sobre `4836122bbbea3266e3832a2f8d670b52b411dc70`: unit ✅ 2004 tests y 90.04% branches; typecheck/lint/build/audit/bundle-budget ✅; db-tests ❌ (RLS en `t339_fixed_price.sql:449`, #23 NULL, 42/45); Vercel ✅; e2e-preview **sin ejecución** (`BLOCKED / REQUIRES DEVELOP MIGRATION`, por inclusión de migración).

## Decisión de Lautaro073 pendiente

A (recomendada): mantener protección y coordinar validación real tras aplicar migración a develop, con aceptación explícita si supone una excepción al E2E premerge. B: separar migración de la PR funcional para correr E2E con esquema ya actualizado. **No se eligió ninguna opción**, ver ronda-3.md.
