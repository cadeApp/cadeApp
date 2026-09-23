# PR #58 · Ronda 3 — `d100c3a`

| | |
|---|---|
| **SHA revisado** | `d100c3a` |
| **Arreglo principal** | `057a8b1` |
| **Ronda anterior** | `ad630b9` → [`ronda-2.md`](ronda-2.md) |
| **Tarea** | T-006 · Contratos de dominio v1 |
| **Tamaño total** | 21 archivos · +5251 / −455 |
| **Fecha** | 2026-09-23 |

## Veredicto

**SIN BLOQUEANTES. Lista para aceptar.** Los cuatro residuales de la ronda 2 —`H05`, `H07`, `H08` y `H14`— están cerrados, y cada uno lo comprobé re-ejecutando el contracaso que en la ronda anterior *pasaba* demostrando el defecto. Ahora los ocho demuestran el comportamiento correcto.

Lo que más pesa es `H14`, porque era el crítico y porque la remediación es real y no cosmética:

> De **25 vulnerabilidades con 8 altas y 2 críticas silenciadas** por `ignoreGhsas`, a **2 moderate, cero altas, cero críticas y ninguna excepción**. `next` y `eslint-config-next` pasaron a 15.5.26 y las excepciones se reemplazaron por cuatro `overrides` acotados.

Y hay algo que conviene decir explícitamente porque cambia el tablero del proyecto: **esta PR es la que vuelve bloqueante el job `audit`.** El `if` del workflow pide `src/domain/rpc-contracts.ts`, que este PR crea. Hasta ahora el job corría la rama `advisory` con `|| echo` y no podía fallar; desde el merge corre la rama estricta. Lo verifiqué en el log del run: no aparece el aviso de la rama advisory, y el `pnpm audit --audit-level=high` termina en 0 por mérito propio.

La actualización de Next 14 → 15 en una PR de contratos de dominio era el riesgo de esta ronda, y la revisé aparte. Está bien resuelta: `createClient()` pasó a `async` con `await cookies()`, que es exactamente lo que Next 15 exige, `build` sale en 0 y el First Load JS queda en 103 kB contra un presupuesto de 180 kB.

| | |
|---|---|
| Cerrados en esta ronda | **4 bloqueantes** (`H05`, `H07`, `H08`, `H14`) + la mejora de la ronda 2 (`H15`) |
| Nuevos | 1 bajo (`H16`), que corresponde a T-009 |
| Abiertos al cierre | 1, no bloqueante |
| **Bloqueantes** | **0** |
| Alcance | 21 archivos, **0 fuera** de la ficha ampliada |
| CI en `d100c3a` | **8 de 8** · `db-tests` `Files=3, Tests=98, Result: PASS` |

## Checks en `d100c3a`

Corridos en un worktree detached con instalación congelada, para no tocar el árbol que comparte el agy.

| Control | Resultado | **Qué alcanza** |
|---|---|---|
| `pnpm install --frozen-lockfile` | exit 0 · 27,5 s | El lockfile nuevo instala limpio |
| `pnpm typecheck` | exit 0 | strict; con cero `!` en el fake, las guardas son reales |
| `pnpm lint` | exit 0 | `src`, `middleware.ts` y los `.mjs` de workflows |
| `pnpm test` | **98 Vitest** (11 archivos) · 19 workflows · 6 ADR | |
| `pnpm test:coverage` | exit 0 | Umbral real 90/90/90/90. `domain` 100 %, `states` 93,91 % ramas, `rpc-fake` 91,1 % ramas |
| `pnpm build` | exit 0 | Next 15.5.26. First Load JS 103 kB / 180 kB |
| **`pnpm audit --audit-level=high`** | **exit 0 legítimo** | `2 vulnerabilities found · Severity: 2 moderate`. **Sin `ignoreGhsas`** |
| `prettier --check` sobre lo tocado | «All matched files use Prettier code style!» | Los 6 archivos de la ronda 2 se resolvieron |
| `pnpm test:db` local | n. a. | Este entorno no tiene Docker |
| `db-tests` en CI | **pass** · `Files=3, Tests=98`, `Result: PASS` | Leído en el log, no por el color |
| CI completo | **8 de 8** | |
| Alcance | 21 archivos, **0 fuera** | |

## Probe de ronda 3

Reconstruí los siete contracasos de la ronda 2 y les sumé uno. En la ronda 2 los siete **pasaban**, demostrando el defecto; ahora los ocho demuestran lo contrario:

```text
✓ setForcedError rechaza un código que no pertenece a publish_request
✓ accept_offer rechaza una oferta cuyo courier no existe
✓ admin_verify_document devuelve NOT_FOUND y no un TypeError si falta el courier
✓ report_no_show sobre matched sin acceptedOfferId no devuelve un output inválido
✓ report_incident rechaza una solicitud draft
✓ report_incident produce INCIDENT_WINDOW_EXPIRED pasadas las 24 h de delivered   (nuevo)
✓ una oferta sembrada con el primer ID de la secuencia sobrevive a submit_offer
✓ package.json no ignora avisos de seguridad
```

Más tres del caso de settings, que era la mejora no bloqueante de la ronda 2 y también se resolvió. El probe se retiró; el worktree se borró; **ningún archivo del repositorio quedó modificado por la revisión**.

### Tres correcciones de mi propio probe, que conviene registrar

La primera versión del probe dio 2 fallos y **los dos eran míos**, no del fake:

1. Afirmé `r.error` cuando `ActionFailure` expone `code` (`errors.ts:55-58`).
2. Llamé `admin_verify_document({ documentId, status })` cuando el campo es `decision`; el input fallaba la validación y nunca llegaba al handler, que **sí** tiene su `if (!courier) return err('NOT_FOUND')` en `rpc-fake.ts:979`.
3. Pasé `reason` a `report_no_show`, cuyo input es `{ requestId, republish? }`. Ese test pasaba por el motivo equivocado.

Las tres las encontró `tsc --noEmit` sobre el propio probe, que corrí recién después de la segunda. **Un probe de revisión es código y va tipado antes de creerle**: si me hubiera quedado en la primera corrida, habría reportado dos bloqueantes inexistentes sobre un fake correcto. Va a `lecciones.md` como `AG-47`.

---

## Lo que cerró, uno por uno

### `H05` · El error forzado quedó ligado a su RPC

`setForcedError` es ahora `<K extends RpcName>(rpcName: K, code: RpcErrorCode<K> | null)` (`rpc-fake.ts:155`), con **doble barrera**: el tipo lo rechaza en compilación —el probe necesita `@ts-expect-error` para compilar— y el cuerpo valida en runtime contra `RPC_CONTRACTS[rpcName].errorCodes`. Pedí una de las dos; entregó las dos, y la de runtime es la que protege a quien use el fake desde JavaScript.

### `H07` · Las cuatro relaciones imposibles, cerradas — y una de regalo

| Contracaso de la ronda 2 | Ahora |
|---|---|
| `accept_offer` aceptaba una oferta de un courier inexistente | `ok: false` |
| `admin_verify_document` tiraba `TypeError` | `NOT_FOUND`, por guarda explícita |
| `report_no_show` devolvía éxito con `cancelledOfferId: undefined` | `ok: false` **y el estado no muta** |
| `report_incident` aceptaba una solicitud `draft` | rechazada |

El cuarto punto de la ronda 2 era que `INCIDENT_WINDOW_EXPIRED` no se podía producir naturalmente porque el fake no conservaba `deliveredAt`. Ahora sí: sembrando `deliveredAt` dos días antes, `report_incident` devuelve ese código. El catálogo dejó de prometer un error inalcanzable.

Verifiqué además lo que había pedido explícitamente: que la validación de output **no reemplazara** la validación de relaciones. No la reemplazó — el handler corta antes con `err('NOT_FOUND')`, y comprobé leyendo `getRequest` antes y después que una operación fallida no deja el estado mutado.

**Los ocho `!` desaparecieron.** `grep` de non-null en `rpc-fake.ts` devuelve 0, con `typecheck` en strict pasando. Eso es lo que convierte el arreglo en estructural: las guardas son reales, no casts, y el compilador lo sostiene. Cumple además la prohibición de `AGENTS.md` §4, que hasta la ronda 2 no se estaba cumpliendo.

### `H08` · La secuencia busca hueco

`nextUniqueOfferId()` (`rpc-fake.ts:253`) incrementa hasta encontrar un id libre en el `Map`. Sembré una oferta con el primer id de la secuencia y `amountArs: 5000`; después de `submit_offer`, el fixture sigue en 5000 y la oferta nueva tomó otro id. En la ronda 2 ese mismo probe devolvía el fixture pisado.

### `H14` · Remediación, no silenciamiento

```text
Ronda 2:  25 vulnerabilities found
          Severity: 2 low | 13 moderate | 8 high (8 ignored) | 2 critical (2 ignored)

Ronda 3:  2 vulnerabilities found
          Severity: 2 moderate                                        exit 0
```

`pnpm.auditConfig.ignoreGhsas` ya no existe. En su lugar hay cuatro `overrides` acotados (`glob`, `handlebars`, `postcss`, `vite`) y `next` en 15.5.26, por encima del mínimo que fijó Lautaro073. Las dos `moderate` que quedan están por debajo del umbral `--audit-level=high` y nadie pidió remediarlas.

### `H15` · La mejora no bloqueante también se tomó

`admin_update_setting` inspecciona la clave cruda antes del schema (`rpc-fake.ts:344-354`) y emite `INVALID_SETTING_KEY` o `INVALID_SETTING_VALUE` según corresponda. Probe 3/3, incluido el camino feliz para comprobar que no se rompió: `min_offer_ars: 2500` sigue funcionando y `getSettings().minOfferArs` queda en 2500.

---

## 🔵 H16 · El `createClient` async no está ejercitado por ninguna prueba

**`src/server/supabase/server.ts:12` · bajo · no bloqueante**

Next 15 convirtió `cookies()` en asíncrona, así que `createClient()` pasó a `async` y hace `await cookies()`. **El cambio es el correcto.** Lo que no hay es nada que lo ejecute: `clients.test.ts:12-16` solo afirma que el archivo existe y que `typeof createServerClient === 'function'`, y no hay ningún consumidor en el repo todavía.

Si el `await` faltara, o si el shape que devuelve `cookies()` cambiara, ningún control del proyecto lo notaría hasta que T-009 lo use. `typecheck` valida la firma, no el comportamiento.

No bloquea T-006 —la función no tiene consumidores y el cambio entró como efecto colateral autorizado de `H14`—, pero conviene que **T-009 lo liste como caso del DoD**, porque es la tarea que va a apoyarse en él.

---

## Lo que está bien y no se dijo antes

- **El arreglo fue estructural en el punto correcto.** Se podía cerrar `H07` poniendo validación de output y listo; el output validation ayuda a que una implementación incompleta falle cerca de la causa, pero yo había advertido que no sustituye validar relaciones antes de mutar. Se hicieron las dos cosas, y las guardas van primero.
- **Quitar los ocho `!` no era obligatorio para cerrar los contracasos** y es lo que más valor deja: con `tsc` en strict y cero non-null, la clase entera de «acceso a entidad ausente» queda cerrada por el compilador y no por inspección. Eso es lo que hace que no reaparezca en T-101.
- **El `timeout` del test de fronteras se migró bien.** En la ronda 2 anoté que el tercer argumento objeto quedaría inválido en Vitest 4; pasó a la firma posicional `}, 120_000)` conservando los 120 s, y de paso `buildError!` pasó a `buildError?`. Era una mejora que ni siquiera había pedido cerrar en esta PR.
- **La cobertura resiste.** `rpc-fake.ts` creció 144 líneas y sigue en 91,1 % de ramas contra un umbral real de 90 %, que ya verifiqué por mutación en la ronda 2.

## No revisado / límites

- **No corrí `pnpm test:db` local**: este entorno no tiene Docker. Verifiqué el job en CI leyendo el log (`Files=3, Tests=98, Result: PASS`), no el color.
- **No hay migraciones ni policies RLS en el diff**, así que no corresponde cobertura RLS en esta ronda. `H22` de la PR #57 —mover `notes` a `delivery_request_contacts`— está asignado a T-006 pero **no entra en este PR**, que es de contratos de dominio y no toca `supabase/`. Conviene confirmar en qué PR de T-006 aterriza.
- **Las dos `moderate` que quedan** no las investigué: están por debajo del umbral que el proyecto decidió auditar.
- **No aprobé ni mergeé.**
