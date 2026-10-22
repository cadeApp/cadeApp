# PR #63 · T-103 — Ronda 3

- **PR:** [#63](https://github.com/cadeApp/cadeApp/pull/63) · `feat/T-103-request-lifecycle` → `develop`
- **SHA revisado:** `93cc3c5` · base `origin/develop` = `b6b5f39` (sigue al día)
- **Fecha:** 2026-09-24
- **Resultado: CON BLOQUEANTES (1), solo de texto.** El código y las pruebas están completos: **las 21 mutaciones
  de la batería se ponen rojas** y el control sin mutar da verde. Lo que queda es que la bitácora afirma un rojo
  que no se pudo haber visto, y que el cuerpo y la bitácora citan líneas que no existen. No hace falta tocar
  código ni pruebas.

> **Método:** con Docker. Receta de `db-tests` completa (1.385/1.385), batería de 23 mutaciones de
> `request_cycle` contra las 1.208 aserciones y `typecheck`, `lint` y `test` en un worktree limpio. La función
> `request_cycle` no cambió desde `37014bd` (el único cambio de la migración es la policy), así que el 27/27 de
> `D01`, las sondas de la ronda 1 y la batería estática de la ronda 2 siguen valiendo sin volver a correrlas. CI
> **no consultado**: la ronda tiene un bloqueante. Evidencia en
> [`evidencia/comandos.md`](../evidencia/comandos.md#ronda-3-sobre-93cc3c5).

---

## Lo que se cerró, verificado

| ID | Cómo lo verifiqué en `93cc3c5` |
|---|---|
| `H10` | M06 ahora pone rojas 3 aserciones (`M06a`, `M06b` y `P2b`); antes, 0. TTL 17 e igualdad exacta, como se pidió |
| `H11` | M21 (policy abierta) pone rojas `P1a`, `P1b` y `P1c`; antes, 0. Las consultas corren con el rol real |
| `H12` | M20 pone roja `H12 / M20`; antes, 0. `P2b` fija el `expires_at` renovado |
| `H09` | M13 pone roja `M13 / H09`; antes, 0. Quedan cubiertos `before` y `after` |
| `H13` | la policy es `for select`; `P1f` confirma que el admin no inserta directo |
| `H06` | con M06 roja, las 9 filas de la ronda 1 quedan cubiertas |
| `H05` | lo pedido en la ronda 1 está hecho; lo que queda está en `R01` |

**La batería completa, sobre las 1.208 aserciones:** M00 (control) verde; M01 a M21, **21 de 21 rojas**. Es la
primera ronda sin ninguna mutación ciega de las que la revisión propuso.

Y una cosa que salió mejor de lo pedido: **la semántica de la bitácora y del cuerpo ya es correcta.** No quedan
precedencias inventadas, códigos inexistentes ni un estado efectivo distinto del del código, y la precedencia se
enlaza a `rpc-contracts.ts` en vez de copiarla, que era la parte importante de `R01`.

---

## Bloqueante

### `R01` · parcial: la bitácora afirma un rojo que no ocurrió, y las citas no apuntan al código · **BLOQUEANTE (solo texto)**

**El rojo de M21.** La bitácora (`docs/tasks/log/T-103.md:89`) dice: *«Con `M21` activa fallan `P1a`, `P1b`,
`P1c`, `P1e` y `P1f` (RED: `5` fallos)»*. Corrí la misma M21 que cita (`comandos.md`): **fallan 3**, `P1a`, `P1b`
y `P1c`. `P1e` y `P1f` **no pueden** fallar con esa mutación: son `insert`, y los bloquea la falta de `grant`, no la
policy. O sea que ese rojo se escribió desde lo que se esperaba ver, no desde lo que se vio. Es lo que la regla de
evidencia existe para impedir, y es exactamente la forma de `AG-68`. Los otros tres rojos que declara la bitácora
(M06, M13, M20) sí se reproducen.

**Las citas de línea.** El arreglo de `R01` reemplazó las afirmaciones falsas por números de línea, y la mayoría
no apunta a lo que dice:

| Cita | Dónde | Lo que hay en `93cc3c5` |
|---|---|---|
| precedencia en `rpc-contracts.ts:62-97` | cuerpo y bitácora | `:62` y `:97` son `requestId: uuidSchema`; el bloque empieza en `:299` |
| `AAL2_REQUIRED` en `rpc-contracts.ts:110` | cuerpo | `:344` |
| tabla de motivos en la migración `:10-27` | cuerpo | `:2-19` |
| piso de 500 m en `:227-232` | cuerpo y bitácora | `:178` |
| participación de `H01` en `:92-94` | cuerpo y bitácora | `:91-93` (se corrió una línea al cambiar la policy) |
| estado efectivo en `:107-108` | cuerpo y bitácora | `:106-107` |
| chequeo de `aal2` en `:112-113` | cuerpo y bitácora | `:121-123` |
| participación «en el paso 3», elegibilidad «en el paso 8» | cuerpo y bitácora | en `rpc-contracts.ts` las dos son el **paso 4**; el 8 es el tope por minuto |
| «cazan las 22/22 mutaciones» | cuerpo | M00 es el control y tiene que quedar verde: son 21 de 21 más el control |

- **Qué hacer:** corregir el rojo de M21 a los tres que fallan, y explicar por qué `P1e`/`P1f` no dependen de la
  policy. Para las citas, lo más robusto es **nombrar el símbolo en vez de la línea** (`request_cancellation_reasons_admin`,
  `v_eff_status`, «bloque *Precedencia canónica del ciclo* en `RPC_CONTRACTS`»): las líneas se corren con
  cualquier cambio, como ya pasó con tres de estas en el mismo commit que las escribió.
- `P03-comentario-contradice-codigo` · origen `agente`

## Mejora

- **`H14` · «P4b» no fija lo que su nombre dice.** La prueba (`rpc_requests.sql:598-602`, dentro de `check_d01`) se
  llama «admin sobre published vencida recibe `REQUEST_EXPIRED` antes del chequeo de rol/AAL2», y su comentario
  dice «admin con aal1», pero `invoke(5)` le da `aal2`. Con `aal2` el orden entre `REQUEST_EXPIRED` y
  `AAL2_REQUIRED` no se ejerce. **M22**, que adelanta el chequeo de `aal2` antes del de vencimiento, deja las
  1.208 en verde. El fake tampoco tiene ese caso en `domain.test.ts`. Hoy la RPC y el fake coinciden (`T02` de la
  ronda 2); lo que falta es que alguien lo fije. Arreglo: correrla con los claims de `aal1`, como `D03`.
  `P04-test-tautologico` · `bajo`.

---

## Checks

| | Alcance | Resultado |
|---|---|---|
| `pnpm supabase test db` | local, `93cc3c5` | `Files=7, Tests=1385, Result: PASS` · `rpc_requests.sql` 1.208/1.208 |
| `pnpm db:types --local` + diff | local | sin diff (verificado que el generador escribió) |
| `pnpm typecheck` · `lint` · `test` | worktree limpio de `93cc3c5` | exit 0 · sin avisos · 296/296, workflows 19/19, ADR 6/6 |
| Mutación de `request_cycle` | 23 contra 1.208 | M00 verde · M01–M21 **21/21 rojas** · M22 (nueva) ciega → `H14` |
| `D01`, sondas de la ronda 1, control estático | — | sin volver a correr: `request_cycle`, el fake y `requests.test.ts` no cambiaron desde `37014bd` |
| CI | — | **no consultado**, por método. GitHub marca la PR `unstable`; no miré qué check lo provoca |

## Qué hay que hacer

1. `R01`: corregir en la bitácora el rojo de M21 (3, no 5) y cambiar las citas de línea por nombres de símbolo,
   en la bitácora y en el cuerpo.
2. `H14` si entra: `P4b` con claims `aal1`, demostrada con M22.

La ronda 4 es corta: verificar el texto y, si no queda nada, **mirar CI por dentro**, como pide el método para la
ronda que queda para aprobar.
