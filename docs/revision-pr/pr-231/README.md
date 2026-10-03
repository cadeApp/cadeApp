# PR #231 — CC-020 · Referencia local como punto aproximado de zona

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/231 |
| **Contrato** | CC-020 · Issue #230 |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-020-zone-local-reference` → `develop` |
| **Base** | `973d7fae30c1db610eedf3f07aa52fbff3163a29` |
| **SHA revisado** | `a6b5fbd033e6145165ece256c6cd212040711137` |
| **Tamaño funcional** | 1 archivo · +114 líneas |
| **Estado** | Draft · SIN BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---:|---|
| 1 | `a6b5fbd033e6145165ece256c6cd212040711137` | 0 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Resultado

**SIN BLOQUEANTES.**

CC-020 formaliza la Opción A aprobada por Lautaro073 en #230 sin cambiar esquema, RPC, RLS, permisos, tipos ni `src/domain`.

Verificado:

- `referencia_local` queda definida como tercera clase documental de punto aproximado junto a `derivado` y `NULL`;
- las condiciones de trazabilidad/aprobación están explícitas;
- los 7 puntos autorizados coinciden exactamente con la evidencia de T-326;
- todos están dentro de CC-019 y ninguno copia `AGUILARES_CENTER` ni el punto general de `Aguilares`;
- los consumidores descritos coinciden con el comportamiento real: onboarding usa el centroide de zona como fallback y `request_cycle` usa coordenadas explícitas antes que el centroide;
- puntos nuevos o cambios de coordenadas no quedan preautorizados;
- la rama está 0 behind respecto de `develop`.

## Checks

CI exact-head `37102729591`:

- typecheck ✅
- lint ✅
- unit ✅ — 114 archivos / 1731 tests
- build ✅
- db-tests ✅ — 16 archivos / 1787 tests
- bundle-budget ✅
- tipos DB sin diff ✅
- audit ❌ — advisory externo conocido de `braces`

Preview:

- `cd186465` — mismo árbol de aplicación que el SHA revisado — Vercel READY y E2E Preview **23/23 GREEN**;
- `a6b5fbd033e6145165ece256c6cd212040711137` solo cambia una línea documental de aprobaciones respecto de `cd186465`; Vercel no redeployó por **build-rate-limit** del plan, no por error del PR.

## Ajuste administrativo de la revisión

La revisión cambió una sola línea en `docs/contracts/CC-020.md` para no dejar P2 como aprobación pendiente. Quedó explícito que no requiere aprobación separada porque CC-020 no modifica `src/domain` ni `src/ui`, y la decisión visible final corresponde a Lautaro073.

No hubo cambios de producto ni código.

## Qué queda por hacer

Nada dentro de CC-020. Lautaro073 puede decidir cuándo sacar #231 de Draft y mergearla.

Después del merge, T-326 / #218 puede retomar la resolución de PR218-H06 sobre `develop`.
