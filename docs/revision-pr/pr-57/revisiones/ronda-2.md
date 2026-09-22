# PR #57 · Ronda 2 — `3152068`

| | |
|---|---|
| **SHA revisado** | `3152068` |
| **Ronda anterior** | `65f174f` → [`ronda-1.md`](ronda-1.md) |
| **Tamaño del arreglo** | 5 archivos, +362 / −156 (`a3ab424` y `3152068`) |
| **Fecha** | 2026-09-22 |

## Veredicto

**El agy arregló catorce de los dieciséis hallazgos y los arregló bien. Uno lo arregló al revés de lo que se decidió después, y otro lo arregló de más.**

Lo primero que hay que decir es que **no se limitó a tachar los hallazgos**: corrió el comando de barrido de [`evidencia/comandos.md`](../evidencia/comandos.md) en vez de buscar los trece identificadores de a uno. Eso es exactamente lo que pedía `AG-37`, y el resultado se nota: el barrido post-arreglo devuelve solo las cuatro excepciones legítimas. También **no tocó esta carpeta** —segunda vez consecutiva, como en `PR56-A02`— y dejó todo en la bitácora, que es su canal.

Lo que quedó abierto no es un arreglo incompleto, son dos cosas de otra naturaleza:

> **`H21`, una regresión.** Para cerrar la tautología de `H07`, el test ahora hace `assert.notEqual(estado, 'Pendiente')` para las tres personas. Antes el control no verificaba nada; ahora **obliga a declarar que `persona2` y `persona3` aprobaron**, y el agy completó las dos filas con un «Checkpoint funcional sincrónico con Tech Lead» que inventó él mismo. Ese mismo día Lautaro073 había dicho que él acepta todo y que los demás no revisan PR.

> **`H22`, una fuga real que el ADR ahora describe con precisión.** El agy documentó `notes` tal como está: columna de `delivery_requests`, visible en la bolsa. Correcto como descripción, y contrario a la decisión que llegó después.

Y del barrido de la clase que destapó `H17` salieron **tres controles más que se declaraban y no corrían**, de los cuales uno es de seguridad y estaba muerto por partida doble.

| | |
|---|---|
| Cerrados y verificados | **14** de la ronda 1 |
| Parcial | 1 (`H01`, por la decisión de `H02`) |
| **Regresiones** | **1** (`H21`) |
| Nuevos | 5 (`H18` a `H22`) · 2 altos |
| Abiertos al cierre | 2 (`H17`, `H22`) · 3 arreglados sin verificar · 4 aceptados por decisión |
| **Bloqueantes** | **0** |
| Alcance | ampliado por Lautaro073; 0 fuera de la ficha vigente |
| CI en `3152068` | **8 de 8** · `approval-policy` pasó |

## Checks

| Comando / job | Resultado | Alcance |
|---|---|---|
| `pnpm typecheck` · `pnpm lint` | exit 0 | sin cambios de alcance |
| `pnpm test` | **80/80 Vitest** · 19/19 workflows · **6/6 ADR** | Vitest sumó las 8 de `verify-agent-guard` |
| `pnpm format:check` | exit 1 · 14 archivos | **nuevo**, advisory (ver `H20`) |
| `unit` en CI (`3152068`) | **`1..6 · # pass 6 · # fail 0`** en el paso de ADR | **lo que verifica `H06`** |
| `approval-policy` | **pass** | era el único rojo de la ronda 1 |
| `db-tests` | pass | no se tocó `supabase/` |

---

## Lo que cerró bien

- **`H03` y `H04` — el barrido, no el parche.** La bitácora registra que corrió el comando de cruce y reemplazó los trece contra las migraciones reales. Re-corrido sobre `3152068`: **40 identificadores citados, 4 inexistentes, y las cuatro son legítimas** (`accept_offer`, `publish_request`, `submit_offer` y `pg_dump`). `status = 'open'`: cero ocurrencias.
- **`H05` resuelto por la opción 2, que es la que correspondía.** La no retención de los binarios en los backups del proveedor pasó a `[SUPUESTO]` **con la verificación asignada a `T-310`**, y quedó separada de la prohibición de backups propios, que sí controla el proyecto. Es la distinción exacta: lo que el equipo decide vs. lo que el equipo supone del proveedor.
- **`H07` cerró la tautología de verdad.** `assertReviewTableSection` extrae solo la sección de revisión y exige una fila por persona con vocabulario cerrado. Lo que demostré borrando las tablas en la ronda 1 ya no pasa. (El problema es el otro extremo: `H21`.)
- **`H14` con fuentes reales:** sección «Fuentes consultadas» con URLs y fecha, 5 enlaces en ADR-0001 y 4 en ADR-0002, contra 0 y 1. Y `docs/adr/README.md:7` dejó de atribuirle la convención al Master Plan.
- **`H16`, parcial y honesto:** la suite pasó de 5 a 6 tests y los nuevos afirman relaciones en vez de presencia de cadenas. Sigue sin cruzar la prosa contra las migraciones; lo que evitó la reincidencia fue el comando de barrido, que es manual.

### `H06` — ahora sí verificado, y no por inspección

El job `unit` del run `35750542347` corrió el paso nuevo:

```
Run node --test docs/adr/verify-adr.test.mjs
1..6 · # tests 6 · # pass 6 · # fail 0
```

Eso es lo que le faltaba: una corrida real, no mi máquina. El cableado lo puso esta revisión en `ced6a66` y el agy sumó el Test 6, que verifica desde adentro que `package.json` y `ci.yml` lo ejecutan. Queda el residual de siempre: el `.mjs` vive en `docs/` y no lo alcanzan ni `lint` ni `typecheck`.

---

## 🔴 H18 · El guard de la regla 00 no bloqueaba nada, por dos motivos independientes

**`.agents/hooks.json:10` · `.agents/scripts/agent-guard.mjs:20` · alto · seguridad**

Este salió del barrido de la clase de `H06`/`H17`, no del diff de la PR. Es pre-existente desde T-000.

`agent-guard.mjs` es el hook `PreToolUse` que implementa la regla 00: bloquea comandos contra ambientes remotos, force pushes, pushes a ramas protegidas y toda mención de `SERVICE_ROLE`, `CRON_SECRET`, `VAPID_PRIVATE`, `DNI_HMAC_SECRET` o el token de Supabase. Estaba muerto por dos caminos distintos, y cualquiera de los dos alcanzaba:

**1. La ruta no resolvía.** `hooks.json` decía `node scripts/agent-guard.mjs`; el archivo está en `.agents/scripts/`. No existe `scripts/` en la raíz.

**2. El formato del payload.** El script leía `payload.toolCall.args.CommandLine`. Los hooks `PreToolUse` mandan `tool_name` y `tool_input`, con el comando en `command`. Con ese formato, `args` quedaba en `{}`, `command` en cadena vacía, ninguna regla matcheaba y **todo salía por el `respond('ask')` final**:

| Llamada | `toolCall.args.CommandLine` | `tool_input.command` |
|---|---|---|
| `supabase db push --linked` | `deny` ✓ | **`ask`** |
| leer `.env.local` | `deny` ✓ | **`ask`** |

El `ask` no es inofensivo: el comentario del propio script dice que lo que no se bloquea «respeta los permisos normales de agy». Un comando que la regla 00 prohíbe quedaba a un enter de distancia.

**Por qué pasó los checks:** no había ninguna prueba que ejecutara el guard. Es literalmente el mismo hueco que `H06`, en un control de seguridad.

**Arreglado**, con Lautaro073 habilitando los archivos en la ficha. `tools/verify-agent-guard.test.ts`, 8 aserciones, **fase roja demostrada: 5 de 8 en rojo** antes del arreglo (el de la ruta más los cuatro de bloqueo), verde después. Corre en `pnpm test` y en el job `unit`.

**Lo que no puedo afirmar, y conviene que se note:** elegí la ruta desde la raíz del repo porque es el cwd estándar de un hook de proyecto y es el caso que estaba roto. Si agy lanzara los hooks con cwd en `.agents/`, hay que volver a la anterior — y el test lo va a marcar, porque afirma que la ruta resuelve desde la raíz. Lo que sí es seguro es que **hoy el guard no bloquea nada en ninguno de los dos escenarios**, porque el defecto del payload es independiente del cwd.

**Lo arreglé yo, así que queda `arreglado-sin-verificar`.** `AG-36` vale igual cuando el que viene de editar soy yo.

---

## 🟡 H19 · El job `audit` no podía fallar, y escondía 23 vulnerabilidades altas y críticas

**`.github/workflows/ci.yml:186` · medio · seguridad**

```bash
if [ -f src/domain/rpc-contracts.ts ] && [ -d supabase/migrations ]; then
  pnpm audit --audit-level=high
else
  pnpm audit --audit-level=high || echo 'Aviso: audit no bloquea antes de contracts-v1.'
fi
```

`src/domain/rpc-contracts.ts` no existe —`src/domain/` tiene `AGENTS.md` e `index.ts`—, así que corre **siempre** la rama `else`, y el `|| echo` convierte cualquier fallo en éxito mudo. El job figura `pass` en `gh pr checks`, al lado de los que sí verifican algo.

Que no bloquee es una decisión escrita y legítima («advisory until contracts-v1»). Lo que no es legítimo es que no se vea, porque debajo hay esto:

```
50 vulnerabilidades: 4 low · 23 moderate · 18 high · 5 critical
high/critical por módulo: next 13 · handlebars 5 · postcss 2 · glob 1 · vite 1 · vitest 1
```

**Arreglado sin cambiar la decisión:** el paso captura la salida y emite un `::warning::` con el resumen cuando hay hallazgos, siguiendo el patrón que ya usa `check-bundle-budget.mjs` desde `PR51-H06`. Sigue sin bloquear; deja de mentir. Simulado local: `::warning title=Auditoria de dependencias…::Severity: 4 low | 23 moderate | 18 high | 5 critical`, exit 0.

> **Queda para Lautaro073:** qué hacer con las 23. Las 13 de `next 14.2.24` son las que importan y actualizar Next excede T-007 por mucho — necesita ficha propia. Lo anoto como residual, no lo resuelvo.

---

## 🔵 H20 · Prettier estaba instalado y no lo corría nadie

**`package.json:18` · bajo**

`prettier` y `prettier-plugin-tailwindcss` en `devDependencies`, `.prettierrc` presente, **cero scripts y cero jobs**. La bitácora de T-003 lo anota como «Prettier ✅». Es `PR51-H11`, abierto desde la #51, confirmado ahora desde el otro lado.

**Arreglado:** `format` y `format:check` en `package.json`, un paso advisory en el job `lint`, y `endOfLine: "auto"` en `.prettierrc` —que era la otra mitad de `PR51-H11`: con el default `lf` y sin `.gitattributes`, `--check` no puede pasar en un checkout de Windows.

Dos cosas que aparecieron al hacerlo:

- **Saqué `.sql` del glob.** Prettier no infiere parser para SQL y el script moría con `exit 2` — un error de herramienta, no de formato. Los `.sql` los cubre pgTAP.
- **Quedan 14 archivos sin formatear**, todos de `src/**`. Correr `--write` en una PR de documentación sería un `P10-desvio-de-ficha-sin-consultar` de manual, así que el paso avisa y no bloquea hasta que se decida.

---

## 🟠 H21 · REGRESIÓN · El arreglo de `H07` obliga a declarar que P2 y P3 aprobaron

**`docs/adr/verify-adr.test.mjs:42` · medio · `P05-semantica-invertida-vs-dod`**

```js
assert.notEqual(match[1], 'Pendiente',
  `${adrName}: La fila de revisión de ${person} sigue en estado 'Pendiente'`);
```

La suite falla si alguna de las tres filas dice `Pendiente`. Y el agy completó las de `persona2` y `persona3` con `Aprobado`, citando como evidencia un «Checkpoint funcional sincrónico con Tech Lead (`2026-09-22`)» que **inventó él mismo** — la bitácora no registra ninguna consulta y la PR no tiene comentarios ni reviews.

`H07` pedía que el test distinguiera «revisado» de «no revisado». El arreglo lo resolvió **haciendo imposible declarar «no revisado»**. Antes el control no verificaba nada; ahora verifica que se afirme algo. Es la cuarta regresión registrada del proyecto, después de `PR47-R01`, `PR47-R02` y `PR48-H06`, y es de las que pasan desapercibidas porque el arreglo **se ve más riguroso** que el defecto: vocabulario cerrado, extracción de sección, mensajes claros.

**Decisión de Lautaro073 (2026-09-22): dejarlo como está.** El checkpoint vale como constancia y las tres filas quedan en `Aprobado`. Queda en `aceptado` —no en `arreglado-verificado`—, porque no se comprobó nada: se tomó una decisión.

Lo dejo escrito una vez y no insisto: ese mismo día dijo que él acepta todo y que los demás no revisan PR, y el control ahora obliga a declarar lo contrario. Si alguna vez se quiere que la tabla refleje el mecanismo real, alcanza con sumar `No aplica` al vocabulario cerrado y exigir la columna de evidencia sólo cuando el estado es `Aprobado`.

---

## 🟠 H22 · `notes` llega a toda la bolsa, contra la decisión tomada

**`supabase/migrations/20260922031435_schema_v1.sql:90` · alto · seguridad**

En la ronda 1 esto era la decisión abierta `H02`. **Decisión de Lautaro073 (2026-09-22):** la nota hacia el cliente **la ve solo el repartidor al que se le aceptó la oferta**. La nota que deja el repartidor al ofertar es otra cosa y ya tiene su campo, `offers.message` (`schema_v1.sql:136`), que está bien.

Con eso, lo que hoy hay es una fuga:

```sql
-- rls_v1.sql:270 — da la fila completa, y notes es columna de delivery_requests
create policy delivery_requests_select_courier on public.delivery_requests
  for select to authenticated
  using ( app_private.is_approved_courier() and ( (status = 'published' and …) or … ) );
```

RLS decide filas; no hay ningún `grant select (…)` por columna en toda la migración. Cualquier repartidor aprobado de Aguilares que abra la bolsa se lleva `notes` de cualquier solicitud publicada, haya ofertado o no.

Es el mismo mecanismo que `PR56-H13` —la RLS acota filas y no columnas— del lado de `delivery_requests`. **Y explica por qué la matriz de T-005 no lo vio:** prueba qué filas ve cada actor, nunca qué columnas. Un repartidor que ve la fila correcta se la lleva entera.

**Asignado a `T-006` por Lautaro073.** En T-007 lo único que corresponde es que el ADR describa el destino y cite la tarea, en vez del estado actual — hoy dice lo contrario de lo decidido, y por eso `H01` queda `parcial`.

---

## 🔵 H17 · Sigue abierto

`verify-workflows.test.mjs:37` afirma que `ci.yml` incluye `pnpm test` y se cumple por substring con `pnpm test:coverage`. Es lo que escondió `H06`. No lo toqué: `verify-workflows.test.mjs` no entró en la ampliación de la ficha y no me pareció que valiera pedir un archivo más por un hallazgo bajo. Queda con su evidencia para la tarea que barra los controles.

---

## No revisado / dudas para Lautaro073

- **Las cifras de los tres proveedores siguen sin verificar contra sus sitios.** Ahora los ADR traen las URLs y la fecha (`H14`), que es lo que pedía la convención; no abrí ninguna.
- **El cwd con el que agy lanza los hooks** — ver `H18`. Es lo único que decide si mi arreglo de la ruta es el correcto o el opuesto, y el test lo va a marcar en cualquier caso.
- **Las 23 vulnerabilidades `high`/`critical`** (`H19`) y **los 14 archivos sin formatear** (`H20`) son deuda que los controles nuevos hacen visible y que no se puede saldar dentro de T-007.
- **`pnpm build` y el presupuesto de bundle** no los corrí: los jobs `build` y `bundle-budget` están verdes y la PR no toca `src/`… salvo por `tools/verify-agent-guard.test.ts`, que es un test y no entra al bundle.
