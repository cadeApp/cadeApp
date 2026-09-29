# PR #57 · Ronda 3 — `29b82fc`

| | |
|---|---|
| **SHA revisado** | `29b82fc` |
| **Ronda anterior** | `3152068` → [`ronda-2.md`](ronda-2.md) |
| **Tamaño del arreglo** | 5 archivos, +51 / −29 (`6a46563` y `29b82fc`) |
| **Fecha** | 2026-09-22 |

## Veredicto

**Lista para aceptar. Y lo más importante de esta ronda es que el agy encontró un error mío y lo probó.**

`H01` cerró bien: el ADR ahora describe el estado **destino** decidido —`notes` protegida hasta `matched`, visible solo para el comercio dueño, el repartidor de la oferta aceptada y el admin—, distingue `notes` de `offers.message` citando la línea del esquema, dice dónde está hoy y por qué se expone, y asigna el traslado a `T-006` (`H22`). Es exactamente la decisión, escrita sin ambigüedad.

Pero el dato de la ronda es otro:

> **`H18` estaba mal en su mitad, y la mitad mal era mía.** Reporté que el guard estaba muerto por dos motivos independientes: el formato del payload y una ruta que no resolvía. El formato era cierto. **La ruta no.** `agy` lanza los hooks con `cwd = <repo>/.agents/`, así que `node scripts/agent-guard.mjs` resolvía perfectamente, y el que la rompió fui yo al «arreglarla».

Y no lo dedujo: lo probó. Puso mi versión, el runner falló, y el mensaje de error lo dice solo:

```
Error: Cannot find module 'c:\…\cadeApp\.agents\.agents\scripts\agent-guard.mjs'
```

Ese `.agents\.agents` duplicado es la prueba del cwd, y no admite discusión. Lo revirtió en `6a46563` y adaptó el test para resolver y ejecutar desde `.agents/`, que es la forma correcta: ahora la prueba mide contra el cwd real en vez de contra mi supuesto.

| | |
|---|---|
| Cerrados en esta ronda | `H01`, `H18` (corregido), `R01` |
| **Regresiones** | 1, **de la revisión** (`R01`) |
| Nuevos | 1 bajo (`H23`) |
| Abiertos al cierre | 3 (`H17`, `H22`, `H23`), **ninguno de T-007** |
| Aceptados por decisión | 3 (`H02`, `H09`, `H21`) |
| **Bloqueantes** | **0** |
| CI en `29b82fc` | **8 de 8** · `db-tests` `Files=3, Tests=98, Result: PASS` |

## Checks en `29b82fc`

| Comando / job | Resultado | Alcance |
|---|---|---|
| `pnpm typecheck` · `pnpm lint` | exit 0 | |
| `pnpm test` | **80/80 Vitest** · 19/19 workflows · 6/6 ADR | incluye las 8 del guard |
| Barrido de identificadores | 40 citados, **4 inexistentes y las 4 legítimas** | `accept_offer`, `publish_request`, `submit_offer`, `pg_dump` |
| Guard, desde `.agents/` | `deny` · `deny` · `deny` · `ask` | los tres peligrosos y el inocuo |
| CI | 8 de 8 | `db-tests` verificado en el log, no por el color |

---

## ✅ R01 · La regresión es mía, y la corrección también

**`.agents/hooks.json:10` · medio · introducida en `594e04c`, revertida en `6a46563`**

En la ronda 2 escribí que `node scripts/agent-guard.mjs` moría con `MODULE_NOT_FOUND`. Lo medí **desde la raíz del repo** y di por sentado que ese era el cwd del hook, sin comprobarlo. No lo era.

Es, casi palabra por palabra, el error que yo le reporté al agy en `H03`: **afirmar algo sobre el entorno sin cruzarlo con el entorno.** La diferencia es que en `H03` el cruce estaba a un `grep` de distancia, y acá hacía falta ejecutar el hook de verdad — que es justo lo que hizo el agy y yo no.

Peor: **la prueba que escribí codificaba mi propio supuesto.** `expect(existsSync(path.resolve(script)))` afirmaba la ruta desde la raíz, así que validaba la hipótesis equivocada y pasaba en verde. Un test que codifica la hipótesis errónea no protege de nada; es `P04-test-tautologico` visto desde otro ángulo, y esta vez el que lo escribió fui yo.

Lo único que sale bien de esto: **falló ruidosamente.** Entre `594e04c` y `6a46563` el hook no cargaba, pero tiraba `Cannot find module` en cada llamada en vez de devolver `ask` en silencio. No hubo ventana de falso verde — hubo una ventana de error visible, que es la forma correcta de estar roto.

**Cuarta regresión registrada del proyecto, y la primera de la revisión.** El dato de quién introduce regresiones solo sirve si me incluye.

---

## ✅ H18 · Corregido: era una causa, no dos

Lo que queda en pie del hallazgo, y sigue siendo lo importante: **el guard no bloqueaba nada.** El script leía `payload.toolCall.args.CommandLine`; el runtime manda `tool_name` / `tool_input.command`. Con ese formato, `args` quedaba en `{}`, `command` vacío, ninguna de las catorce reglas matcheaba y todo salía por el `respond('ask')` final.

Verificado sobre `29b82fc`, desde el cwd real:

| Llamada | Hoy |
|---|---|
| `supabase db push --linked` | `deny` — «Regla 00: comandos de Supabase contra ambientes remotos solo corren en CI.» |
| leer `.env.local` | `deny` — «Regla 00: no se leen ni tocan archivos .env.» |
| `git push origin develop` | `deny` — «Regla 50: no se pushea a develop, staging ni main.» |
| `pnpm typecheck` | `ask` ✓ |

La normalización del payload sigue en `agent-guard.mjs:22-25`, y el guard quedó ejercitado por dos vías independientes: las 8 aserciones del test y las propias llamadas del agy durante su sesión.

---

## ✅ H01 · El ADR describe el destino, no el estado actual

`ADR-0001` §1.2, §3.2 y el Riesgo 3 quedaron así:

- `notes` es **dato sensible protegido hasta `matched`**, visible solo para `merchant_id`, el repartidor de `accepted_offer_id` y `app_private.is_admin()`.
- Se distingue explícitamente de `offers.message` —la nota que el repartidor adjunta al ofertar— citando `schema_v1.sql:136`.
- Se dice **dónde está hoy** (`delivery_requests:90`) y **por qué se expone**: la policy de fila sin `GRANT SELECT (…)` por columna, con el enlace a `PR56-H13`.
- El traslado a `delivery_request_contacts` y la aserción de columna en `rls_matrix.sql` quedan asignados a **`T-006` (`H22`)**.

El Test 2 de la suite exige `H22`, `T-006` y `offers.message`, así que el vínculo con la tarea no se puede borrar sin que el check lo note.

---

## 🔵 H23 · El arreglo de `H01` se llevó las dos aserciones que impedían su propia regresión

**`docs/adr/verify-adr.test.mjs:100` · bajo**

El Test 2 tenía dos `assert.doesNotMatch` que impedían volver a listar `notes` entre las columnas de `delivery_request_contacts`. Al reescribirse la sección, esas cadenas dejaron de existir y se reemplazaron por aserciones de **presencia**: que aparezcan `H22`, `T-006` y `offers.message`.

El problema es que las tres aparecen en varias secciones. Hoy se podría escribir «`delivery_request_contacts` almacena … y `notes`» —sin el «a partir de `T-006`»— y el test seguiría en verde, porque las tres cadenas siguen estando en otro lado. También se quitó el `match` de `PR56-H13`, que el ADR igual sigue citando.

Es `AG-44` en chiquito: el arreglo cambió la pregunta que hace el control. El riesgo es acotado —cuando `T-006` mueva la columna, la frase se vuelve verdadera y el hallazgo se cierra solo—, pero hasta entonces el test no distingue el estado actual del destino. Alcanza con una aserción de que la frase sobre `contacts` traiga su calificativo temporal.

No es bloqueante y no pido otra ronda por esto.

---

## Lo que queda abierto al cerrar la PR

| | Dónde va |
|---|---|
| `H22` · `notes` a `delivery_request_contacts` + aserción de columna | **`T-006`**, por decisión de Lautaro073 |
| `H17` · la aserción «CI corre `pnpm test`» se cumple por substring | tarea de controles |
| `H23` · el Test 2 no impide listar `notes` como columna presente | se cierra con `T-006` |
| `H19` · 23 vulnerabilidades `high`/`critical`, 13 en `next` | ficha propia; el aviso ya es visible en CI |
| `H20` · 14 archivos de `src/**` sin formatear | `pnpm format`, fuera de T-007 |

Ninguno es de T-007 ni bloquea el merge. Los tres que quedan `arreglado-sin-verificar` —`H18` en su parte de payload, `H19` y `H20`— los aplicó esta revisión, y por eso no firman su propia verificación; están respaldados por pruebas que corren en CI y por las anotaciones reales del run.

## No revisado / dudas para Lautaro073

- **Las cifras de los tres proveedores no las verifiqué contra sus sitios.** Los ADR ahora traen las URLs y la fecha de consulta, que es lo que pedía la convención.
- **`pnpm build` y el presupuesto de bundle** no los corrí: `build` y `bundle-budget` están verdes y la PR no toca código de aplicación.
