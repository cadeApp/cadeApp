# PR #75 · T-105 · Ronda 3

**SHA revisado:** `c9585ba` («fix(admin): resolve Ronda 2 review findings H04, H05, H08, H11, H16, H17»), sobre `a33c5f7` (carpeta de la ronda 2). La base sigue siendo `b6b5f39`.
**Fecha:** 2026-09-24 · **Revisión independiente.**
**Alcance:** estática + corridas locales. Base recreada desde cero, `pnpm supabase test db`, la batería `evidencia/ronda-2/mut.py` contra la suite real más una mutación nueva, `pnpm db:types --local`, `typecheck`, `lint` y `test`. **CI de GitHub no mirado**: sigue habiendo bloqueantes.

## Chequeos de arranque

1. **Rama:** `origin/feat/T-105-admin-rpc` = `c9585ba`, un solo commit nuevo, que toca tres archivos: `admin.ts`, la migración y `rpc_admin.sql`.
2. **Comentarios:** solo los míos de las rondas 1 y 2.
3. **Bitácora:** **sin entrada para esta sesión**. Termina en la de `b257f1b`, con «Último commit: por generar». Ver `H18`.

## Alcance

Los tres archivos están permitidos. Sin cambios en la ficha, en `src/domain` ni en las dependencias.

## Resultado: CON BLOQUEANTES (3)

**La suite de base corre por primera vez, y controla lo que dice.**

```
supabase/tests/rpc_admin.sql .............. ok
Files=7, Tests=234 · Result: PASS          (177 de los otros seis + 57)
```

Y la batería de mutaciones de la ronda 2, corrida ahora contra la suite real:

| Mutación | Ronda 2 (copia) | Ronda 3 (`c9585ba`) |
|---|---|---|
| base | — | 57/57 ✅ |
| 3 controles positivos | rojo | rojo |
| M1 D03 vuelve a «solo `suspended`» | verde | **rojo** (8, 25, 26) |
| M2 D04 sin `purged_at` | verde | **rojo** (33) |
| M3–M6 sin audit en suspend / verify / set_subscription / update_setting | verde | **rojo** (25-26 / 37 / 47 / 57) |
| M7–M8 sin aal2 en suspend / set_subscription | verde | **rojo** (18 / 41) |
| M9 el motivo no se guarda en decide | verde | **rojo** (14) |
| M10 (nueva) devolver `execute` a `anon` | — | **rojo** (1, 15, 27, 38, 48) |

Confirmé aparte que el `42501` que afirman las pruebas de `anon` es `permission denied for function admin_decide_courier`, y no un permiso de `pg_temp` que por casualidad tenga el mismo código.

**Lo que se hizo bien, con precisión:** cada prueba nueva lleva un comentario que nombra la mutación que ataja («mutación catch aal1 en suspend», «D04 mutación catch»). Es `AG-63` aplicado sin que nadie lo pidiera: dejar escrito qué rotura cuida cada aserción. Y `UNAUTHENTICATED` se prueba ahora como corresponde después de `H07`, con `authenticated` sin `sub` y en las cinco RPC.

### Cerrados y verificados en `c9585ba`

`H04`, `H05`, `H16` (por inspección, con `admin.test.ts` 7/7) y `H17` (por inspección; la concurrencia no se puede ejercer en pgTAP, `AG-62`).

### BLOQUEANTES

- **`H08` / `D05` (sin cambios)** El fake no tiene ni una línea de diff contra la base, y no hay rama de contract-change nueva. Las cinco divergencias de la ronda 2 siguen, y **D05 dice que el CC entra antes del merge**. El mensaje del commit dice que resuelve H08.
- **`H11` (sin cambios) · [`src/types/database.types.ts`]** El commit no toca el archivo. `pnpm db:types --local` da el **mismo +4/−12** que en la ronda 2. El commit dice que resuelve H11, y el cuerpo del PR dice «Tipos TypeScript sincronizados mediante CLI». → `pnpm db:types --local` y commitear lo que salga.
- **`H18` (nuevo) · [`docs/tasks/log/T-105.md`]** La sesión de `c9585ba` no está en la bitácora, y el cuerpo del PR afirma cosas que el diff contradice:
  - que H08 y H11 están resueltos;
  - «test:db ✅ (57 assertions)», sin la línea `Result:`. Esta vez el número es cierto, pero sigue sin estar pegado;
  - informe del agy «SIN BLOQUEANTES»;
  - la casilla «Pruebas del DoD escritas primero y mostradas fallando (`a08f435`)», que la ronda 1 mostró falsa y sigue tildada.

  → Entrada de bitácora de esta sesión con la salida real; sacar del cuerpo lo que no es cierto; destildar la casilla de TDD o reemplazarla por lo que pasó.

### MEJORAS (sin cambios)

`H12`, `H14`, `H15`.

## Checks locales en `c9585ba`

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ exit 0 |
| `pnpm lint` | ✅ `No ESLint warnings or errors` |
| `pnpm test` | ✅ `Test Files 32 passed (32)` · `Tests 267 passed (267)` · 19/0 y 6/0 |
| `pnpm supabase test db` | ✅ `Files=7, Tests=234, Result: PASS` |
| `pnpm db:types --local` + `git diff --exit-code` | ❌ +4/−12 |

## Qué falta para aprobar

1. `H11`: regenerar los tipos. Es un comando.
2. `D05`: el contract-change del fake, con su test RPC↔fake de las cinco combinaciones.
3. `H18`: bitácora y cuerpo del PR alineados con el diff.
4. Ronda 4: con eso resuelto, miro el CI (`db-tests`, `unit`, `approval-policy`) entrando al log y cruzando los números contra este informe.
