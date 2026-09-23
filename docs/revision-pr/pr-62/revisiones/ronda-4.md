# PR #62 · T-101 — Ronda 4 (verificación de cierre)

- **PR:** [#62](https://github.com/cadeApp/cadeApp/pull/62) · `feat/T-101-rpc-offers-rate-limits` → `develop`
- **SHA revisado:** `3c9d94f` · sobre `c5eae06`
- **Fecha:** 2026-09-23
- **Resultado: los tres hallazgos bajos cerrados. 22/22, ninguno abierto. Sin hallazgos nuevos.**

> **Cambio de método a partir de esta ronda**, por indicación de Lautaro073: CI se mira **recién cuando la
> ronda ya está para aprobar**. Las rondas 1 a 3 fueron íntegramente estáticas; esta verificó primero el código
> y después leyó los logs.

---

## 1. `H14` · Las guardas duplicadas, eliminadas

Se sacaron las 11 líneas de las dos guardas del handler de `submit_offer`. Verifiqué cuatro cosas, no una:

| | |
|---|---|
| El handler no quedó necesitando `courier` | ✅ leí el handler completo: no lo referencia en ningún punto. La lectura no servía para nada más que revalidar |
| El pre-paso sigue intacto | ✅ `executeRpc:377-390`, antes del `inputSchema.safeParse` |
| Sin import huérfano | ✅ `canCourierSubmitOffer` importado en `:28`, usado una vez en `:382` |
| Sin regresión de precedencia | ✅ `piso → rate → solicitud` sigue OK y coincidiendo en las dos implementaciones |

El barrido de precedencia, que en la ronda 3 daba `courier faltante: SI (inalcanzable) / elegibilidad: SI
(inalcanzable)`, ahora da **`no` / `no`**.

**La confirmación más limpia de que eran inalcanzables la dio CI sin proponérselo:** el total quedó en
`161 passed`, **idéntico** al de `c5eae06`. Si alguna prueba hubiera estado ejercitando esas guardas, el número
habría cambiado. Y la cobertura de ramas del archivo subió de `91.24 %` a `91.86 %` contra el umbral de 90 %
`perFile` — que era exactamente el argumento del hallazgo.

## 2. `H15` · Los dos comentarios nuevos, y que además digan la verdad

Un comentario de precedencia equivocado es peor que ninguno, así que no verifiqué que existieran: extraje el
orden de rechazo de las dos implementaciones para cada RPC y lo comparé contra lo que el comentario afirma.

| | lo que dice el comentario | SQL | fake |
|---|---|---|---|
| `withdraw_offer` | actor → parámetros → oferta/titularidad → `OFFER_NOT_PENDING` → rate limit | ✅ | ✅ |
| `set_availability` | actor → parámetros → repartidor y estado | ✅ | ✅ |

En `withdraw_offer` el SQL levanta `UNAUTHENTICATED` → `UNAUTHORIZED_ACTOR` → `VALIDATION_ERROR` → `NOT_FOUND`
→ `UNAUTHORIZED_ACTOR` (titularidad) → `OFFER_NOT_PENDING` → `RATE_LIMITED`; el fake hace actor y rol en
`executeRpc`, `safeParse`, y en el handler `offers.get` → `courierId` → `transitionOffer` → ventana. Coinciden.

**Y el comentario hace lo que el hallazgo pedía de verdad:** deja explícito que ahí el tope por ventana va
*después* del estado de la oferta, al revés que en `submit_offer`. Esa línea es el registro que faltaba.

## 3. `H16` · `note` → `message`, y de paso algo que no pedí

La bitácora dice `message`. Además se enumeraron los campos en el paso 3 del comentario de precedencia de
`rpc-contracts.ts`, que no había pedido: verifiqué que `requestId`, `amountArs`, `etaMinutes`, `message` son
**exactamente** los cuatro de `submitOfferInputSchema`, sin faltantes ni de más — porque una enumeración
incompleta habría convertido un arreglo en un `P03` nuevo.

El barrido de `note` sobre `src/domain`, `src/server`, `supabase` y los tres documentos de la tarea solo
devuelve las dos líneas de la bitácora que describen el arreglo.

---

## 4. Dos cosas menores, ninguna es hallazgo

- **La inversión simétrica no quedó escrita.** El comentario de `withdraw_offer` señala su inversión respecto de
  `submit_offer`; el de `set_availability` no señala la suya, que existe: ahí los parámetros van **antes** del
  repartidor, mientras que en `submit_offer` el repartidor va antes de los parámetros. Las dos implementaciones
  coinciden, así que no hay defecto — falta media línea, del mismo estilo que la que sí se escribió.
- **`CC-001` · `Aprobaciones`** enumera `D02`, `D03`, `D05`, `D06`, y el registro ahora cubre también `H14` y
  `H15`. La autorización existe por otra vía (la ficha habilita `src/domain/rpc-contracts.ts` y
  `docs/contracts/**` citando el contract-change), así que es trazabilidad, no permiso faltante.

## 5. Tres fallas de mi propio instrumental en esta ronda

Las anoto porque una de las tres casi produce un bloqueante inventado.

1. **`barrido62.mjs` reportó `!! NO figura en rpc-contracts.ts` para las tres RPC.** Si lo hubiera creído, el
   informe decía que la PR rompió el contrato de las tres funciones. La causa: el regex pide `\{\n\s*inputSchema`
   y el checkout de un `git worktree` en Windows entrega CRLF por `core.autocrlf=true`, así que `\n` no matchea
   después de `{`. **Los blobs del repositorio son LF**; es artefacto del checkout, no del código. Corrido contra
   los bytes de `git cat-file`, el barrido da bien: los tres con `security definer` + `search_path`, y en los dos
   sentidos solo sobra `INTERNAL_ERROR`, el falso positivo conocido.
2. **Mi chequeo de CRLF también estaba roto.** `git cat-file -p $blob | grep -c $'\r'` devolvía 565, 567, 578,
   578 y 594 en los cinco commits: exactamente el total de líneas de cada uno. El patrón se estaba evaluando
   vacío y matcheaba todo. Lo delató que el número coincidiera con el total en los cinco.
3. **El chequeo de alcance dio un falso negativo** con `docs/contracts/CC-001.md`: comparé por cadena literal
   contra la ficha, que lo habilita como glob `docs/contracts/**`. Alcance real: **4/4 dentro**.

→ `AG-60`.

## 6. Checks

Primera ronda en la que miro CI. **8/8 en verde sobre `3c9d94f`**, y leídos por dentro:

| | |
|---|---|
| `unit` | `Test Files 18 passed (18)` · `Tests 161 passed (161)` |
| cobertura `rpc-fake.ts` | ramas `91.86 %` · statements `96.07 %` · funciones `100 %` — umbral `90 %` `perFile` |
| `db-tests` | `Files=4, Tests=141` · `All tests successful.` · `Result: PASS` |
| pgTAP, cruce independiente | `plan(2) + plan(55) + plan(43) + plan(41) = 141` = lo que reporta CI |
| Alcance | ✅ 4 archivos, 0 fuera |
| Construcciones prohibidas en el diff | ✅ ninguna |
| Barrido de contrato por RPC, en los dos sentidos | ✅ sin regresión |

## 7. Veredicto

**Los tres cerrados. 22 de 22 hallazgos, ninguno abierto, todos con SHA de verificación.**

Los tres arreglos son del tamaño del problema: 11 líneas menos, dos comentarios y una palabra. Ninguno tocó
comportamiento, y los números de CI lo confirman desde el otro lado — mismo total de pruebas, mismo
`Files=4, Tests=141`, cobertura arriba.

**No apruebo ni mergeo.**
