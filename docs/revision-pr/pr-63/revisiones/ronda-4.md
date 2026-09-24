# PR #63 · T-103 — Ronda 4

- **PR:** [#63](https://github.com/cadeApp/cadeApp/pull/63) · `feat/T-103-request-lifecycle` → `develop`
- **SHA revisado:** `0327282` · **`origin/develop` avanzó a `53bd0ef`** (la rama sale de `b6b5f39`)
- **Fecha:** 2026-09-24
- **Resultado: CON BLOQUEANTES (1), de coordinación, no de la PR.** R01 y H14 quedan cerrados y el código, las
  pruebas y el texto están bien. Pero mientras corría la ronda 3 entró a develop otro `CC-005` (PR #79, el fake
  de las RPC de admin para T-105). La PR hoy tiene conflicto (`mergeable_state: dirty`), y su `CC-005` tiene que
  pasar a `CC-006`.

> **Método:** a pedido de Lautaro073, esta ronda **no levantó Supabase local**, para gastar menos en la nube. La
> base se verificó **leyendo por dentro los logs de CI** de `0327282`. Como la ronda estaba para aprobar, es lo
> que pide el método. Localmente, solo lo que no necesita Docker: Vitest, la mutación del lado del fake, y una
> simulación del merge con develop en un worktree descartable. Evidencia en
> [`evidencia/comandos.md`](../evidencia/comandos.md#ronda-4-sobre-0327282).

---

## Lo que se cerró, verificado

| ID | Cómo lo verifiqué en `0327282` |
|---|---|
| `R01` | el rojo de M21 dice ahora 3 (`P1a`–`P1c`) y explica por qué `P1e`/`P1f` no dependen de la policy; **no queda ninguna cita por número de línea** en la bitácora (barrido de `` `…:NN` `` vacío); `H01` ubicado en el paso 4 y el 8 como `RATE_LIMITED`, como dice `rpc-contracts.ts` |
| `H14` | **fake:** la misma M22 aplicada a `rpc-fake.ts` pone roja exactamente la aserción nueva (`domain.test.ts:1719`, esperado `REQUEST_EXPIRED`, recibido `AAL2_REQUIRED`). **SQL:** `P4b` corre ahora como `authenticated` con `aal = 'aal1'`; sin base local no pude mutarla, así que queda **por inspección** y con CI verde |

## CI, leído por dentro (`0327282`, run `35959903059`)

| Job | Lo que dice el log |
|---|---|
| `db-tests` | aplica `20260924010124_rpc_requests_v1.sql`; `rpc_requests.sql .. ok`; `All tests successful. Files=7, Tests=1385, Result: PASS`; genera tipos con `--local` y el `git diff --exit-code` del mismo paso (`ci.yml:118-119`) termina en verde → sin diff |
| `unit` | tabla de cobertura completa; workflows `# pass 19 # fail 0`; ADR `# pass 6 # fail 0` |
| `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `approval-policy` ×2 | `success` |

El total de `db-tests` (1.385) es el mismo de la ronda 3, y cuadra: `P4b` pasó de `is` a `throws_ok`, una
aserción por otra. La corrida arrancó a las 05:29Z, después del commit (05:25Z). La línea de resumen de Vitest
quedó fuera de la cola del log; la reproduje localmente: `Test Files 32 passed (32)` · `Tests 296 passed (296)`.

---

## Bloqueante

### `H15` · `CC-005` ya existe en develop con otro contenido: conflicto y número duplicado · **BLOQUEANTE**

`53bd0ef` (PR #79, 02:37 ART) agregó `docs/contracts/CC-005.md` —*«Alineación del fake de RPCs administrativas»*,
para T-105— y tocó `rpc-fake.ts` y `domain.test.ts`. Esta PR agrega **otro** `CC-005.md`:

- `git merge-tree` da **`CONFLICT (add/add)` en `docs/contracts/CC-005.md`**; `rpc-fake.ts` y `domain.test.ts` se
  fusionan solos. GitHub marca la PR `dirty`.
- **Simulé el merge** en un worktree descartable, dejando el `CC-005` de develop y el de esta PR como `CC-006`:
  **Vitest 296/296 y typecheck en verde**. La fusión automática del fake no rompe nada, así que el trabajo es de
  nombre, no de código.

**Qué hacer** (mergeando develop, sin reescribir historia):

1. `git merge origin/develop`; en el conflicto, **quedarse con el `CC-005.md` de develop** y mover el de esta
   PR a `docs/contracts/CC-006.md`, con el título en `# CC-006 — …`.
2. Renombrar las referencias de **esta** PR, y solo esas: `src/domain/rpc-contracts.ts:299` (bloque *Precedencia
   canónica del ciclo*), `src/domain/domain.test.ts:1623` (nombre del `it`), las cuatro entradas de
   «Archivos permitidos» de `docs/tasks/T-103.md`, la bitácora y el cuerpo de la PR. Las menciones a `CC-005`
   que trae #79 son del otro CC y **no se tocan**.
3. Aprovechar para una imprecisión chica del cuerpo: dice que las 27 combinaciones (`S01`–`S15`, `T01`–`T08`,
   `C01`–`C04`) están verificadas «en `domain.test.ts` y `rpc_requests.sql`». Las `T01`–`T08` fueron sondas de la
   revisión, y en las pruebas solo quedó `T02` (como `P4b`). Alcanza con decir «19 en las pruebas, 27 en la
   evidencia de la revisión».
4. CI verde sobre el commit de merge.

- `P14-referencia-muerta-tras-mover` · origen `ambos`: un CC que no llega a develop **no reserva su número**.
  Es el costo de `A01`, que en la ronda 2 verifiqué contra todas las ramas y estaba libre. Lo que no preví es que
  se podía tomar después.

---

## Checks

| | Alcance | Resultado |
|---|---|---|
| `db-tests` | **CI**, `0327282`, leído por dentro | `Files=7, Tests=1385, Result: PASS` · tipos `--local` sin diff |
| `unit` | CI | workflows 19/19 · ADR 6/6 · cobertura completa |
| Vitest | local, `0327282` | 32/32 archivos, 296/296 |
| M22 del lado del fake | local, restaurado en memoria | roja en `domain.test.ts:1719` |
| M22 del lado SQL | — | **no corrida** (sin base local, a pedido): inspección + CI verde |
| Merge simulado con `53bd0ef` | worktree descartable | 1 conflicto (`CC-005.md`); Vitest 296/296 y typecheck en verde tras resolverlo |
| Resto de CI | `0327282` | `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `approval-policy` ×2 en `success` |

## Qué hay que hacer

Solo `H15`: merge de develop, `CC-005` de esta PR → `CC-006` con sus referencias, la frase de las 27
combinaciones, y CI verde. La ronda 5 verifica eso sobre el commit de merge, leyendo CI; **no hace falta volver a
correr la base** si el merge no toca SQL, y no lo toca.
