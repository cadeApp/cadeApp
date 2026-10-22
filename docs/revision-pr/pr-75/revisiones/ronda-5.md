# PR #75 · T-105 · Ronda 5

**SHA revisado:** `02dca77` («fix(admin): resolve Ronda 4 review findings A01, H11, H18, H19, H21»), sobre `0025b94` (carpeta de la ronda 4). La base sigue siendo `b6b5f39`. **Y la dependencia:** `cc/CC-005-admin-fake-alignment` = `e6f43f7` (PR #79, issue #78).
**Fecha:** 2026-09-24 · **Revisión independiente.**
**Alcance:** estática + corridas locales sobre T-105 sola **y** sobre una rama descartable T-105 + CC-005 mergeados, que es lo que va a existir después del rebase. Base recreada desde cero, `test:db`, `mut.py`, `db:types`, probes y mutaciones del fake (en memoria, restaurado), `typecheck`, `lint` y `test`. **CI de GitHub no mirado**: el head va a cambiar con el rebase y ahí es donde corresponde mirarlo.

## Chequeos de arranque

1. **Rama:** `origin/feat/T-105-admin-rpc` = `02dca77`, un commit. Ramas nuevas: `origin/cc/CC-005-admin-fake-alignment`, basada en develop. Develop sigue en `b6b5f39`: el CC no entró.
2. **Comentarios:** solo los míos.
3. **Bitácora:** tiene la sesión (05:15) y dice, **correctamente**, que `admin.test.ts` no va a pasar hasta mergear #79 y rebasar. Dice «test:db en CI (Docker no corre en local)»: no declara lo que no corrió.
4. **Cuerpo del PR:** de vuelta en la plantilla.

## Alcance

`git diff origin/develop 02dca77 -- src/domain` → **vacío**. Los archivos del PR contra develop son los permitidos por la ficha ampliada (D01) más `docs/revision-pr/**`. **`A01` cerrado.**

## Resultado: CON BLOQUEANTES (1), que es de dependencia

**En el código de T-105 no queda nada por arreglar.** El único bloqueante es de orden: `D06` pide que el CC-005 entre antes, y sobre `02dca77` solo, el caso 8 de `admin.test.ts` falla por diseño, porque afirma el fake nuevo. Así lo dice la bitácora.

### Verificado en `02dca77`

| ID | Cómo |
|---|---|
| `A01` | `src/domain` sin diff contra develop |
| `H11` | `pnpm db:types --local` sobre base recreada → `git diff --exit-code` **vacío**. Contra develop: +25/−0, solo las cinco `admin_*`. Tercera vez que se pedía, y ahora sí |
| `H19` | el caso 3 afirma `INVALID_STATE_TRANSITION`; con el fake del CC, el probe da lo mismo, y si se saca el chequeo del fake (MF1) caen 2 pruebas |
| `H08` | **integración** `02dca77` + `e6f43f7`: merge sin conflictos; las cinco divergencias de la ronda 2, y una sexta que agregué (el orden en `verify`), dan lo mismo que la RPC. Mutaciones MF1 y MF2 sobre el fake → rojo en `admin.test.ts` **y** en `domain.test.ts` |
| `H20` | el CC no agrega ninguno de los siete bloques inalcanzables (inspección) |
| `H21` | las nueve secciones de la plantilla, incluida `### Informe de revisión de agy` |

Siguen en verde, sin cambios: `test:db` (`Files=7, Tests=234, Result: PASS`) y las 12 mutaciones de `mut.py` (base 57/57, todas rojas).

### BLOQUEANTE

- **`D06` / `D05` (dependencia):** falta que @KiraK72 valide la #79, que se mergee y que T-105 se rebase sobre develop. **Integrados, los números son:** `Test Files 32 passed (32)`, `Tests 268 passed (268)`, typecheck y lint limpios.

### MEJORAS / residuales

- **`H18` (parcial, menor):** el cuerpo dice «pnpm test: 32 passed (268 passed)» y tilda el DoD de test. Sobre `02dca77` solo da **267 + 1 rojo** (el caso 8). Va a ser cierto después del rebase; hasta entonces, conviene decir «268 con CC-005 integrado; 1 rojo esperado sin él».
- `H12`, `H14`, `H15` sin cambios (mejoras de la ronda 1 y 2; ninguna bloquea).

### Para quien revise la #79 (no es de esta PR)

- **`H22`:** `CC-005.md` («Propuesto», punto 3) dice que el fake exige `purgedAt == null`, pero el fake del CC no tiene ese chequeo, ni el concepto de documento purgado. Hoy no es alcanzable (`FakeSeedDocument` no tiene `purgedAt`), así que no hay divergencia observable, pero el documento que P2 va a validar afirma algo que el código no hace.
- El cuerpo de la #79 tiene **caracteres de control**: cada `` `admin_… `` llegó como `\` + BEL (`\u0007`), un escape que interpretó la shell al publicarlo. Y su informe dice «Informe contract-change — CC-005», que no matchea el `/Informe revisar-pr\s*—\s*T-\d{3}/` de `approval-policy.mjs:31`: ese check va a fallar en la #79.
- En `CC-005.md`, la casilla de Lautaro073 figura sin tildar, aunque D06 ya está decidido. Conviene tildarla al validar.

## Checks locales

| Check | `02dca77` sola | `02dca77` + CC-005 |
|---|---|---|
| `pnpm typecheck` | ✅ | ✅ |
| `pnpm lint` | ✅ | ✅ |
| `pnpm test` | ❌ esperado: 1 rojo (caso 8) · 267 ✅ | ✅ `32/32` · `268/268` |
| `pnpm supabase test db` | ✅ `Files=7, Tests=234, Result: PASS` | (sin cambios de SQL en el CC) |
| `pnpm db:types --local` + `git diff --exit-code` | ✅ vacío | — |

Nota de instrumento: en la primera corrida de T-105 sola, `clients.test.ts` («db-types.mjs no debe truncar…», T-002) dio **timeout** (6,7 s contra 5 s). Corrido solo dos veces: 10/10 las dos. Fue carga de la máquina; el archivo no está en el diff.

## Qué falta para aprobar

1. Validación de @KiraK72 y merge de la #79.
2. Rebase de T-105 sobre develop, con el cuerpo actualizado a los números reales.
3. **Ronda 6:** sobre el SHA rebasado, repetir `pnpm test` y `test:db`, y **mirar CI** entrando a los logs (`unit`, `db-tests` con su paso de `db:types`, `approval-policy`), cruzando los números contra este informe. Si todo coincide, la revisión queda para aprobar.
