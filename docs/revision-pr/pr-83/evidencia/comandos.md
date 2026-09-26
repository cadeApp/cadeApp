# Evidencia reproducible — PR #83 / ronda 1

**SHA revisado:** `4b4f18b0676cd5c5afb8ab5bb7f4328e28050621`

## Preflight

```text
head: 4b4f18b0676cd5c5afb8ab5bb7f4328e28050621
branch: feat/T-115-vista-de-viaje
base: develop@720e2d4f39ab5b4d5d09a55016072eb8fe940855
compare: ahead 2 / behind 0
files: 3
comments: 0
threads: 0
```

Intento de checkout:

```bash
git clone https://github.com/cadeApp/cadeApp.git /tmp/cadeApp-pr83
# fatal: unable to access ... Could not resolve host: github.com
```

No se usaron `.env*`, secretos ni servicios remotos.

## H01 · RPC equivocada invisible

Mutación: las seis actions llaman a `mark_picked_up`. El mock sigue devolviendo el resultado configurado.

```text
picked_up: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
delivered: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
courier_cancel: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
no_show: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
merchant_cancel: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
republish: WRONG RPC NAME, CURRENT ASSERTIONS GREEN
```

## H02 · Guards faltantes

```text
pickedUp       unauth ✅ wrong-role ✅
delivered      unauth ❌ wrong-role ✅
courierCancel  unauth ❌ wrong-role ❌
noShow         unauth ❌ wrong-role ✅
merchantCancel unauth ❌ wrong-role ❌
republish      unauth ❌ wrong-role ❌
```

Mutación sin guard en las tres actions sin caso de rol incorrecto:

```text
courierCancel: current happy path GREEN; proposed wrong-role RED
merchantCancel: current happy path GREEN; proposed wrong-role RED
republish: current happy path GREEN; proposed wrong-role RED
```

## H03 · no-show

Mutación: forzar `republish=true`.

```text
current republish=true: GREEN
proposed republish=false => cancelled: RED
```

El caso “por defecto” actual pasa `true`; no prueba el default.

## H04 · privacidad

Mutación en ambos mensajes: agregar `Dirección exacta: San Martín 450`.

```text
coordination mutant: CURRENT ASSERTIONS GREEN
customer mutant: CURRENT ASSERTIONS GREEN
```

La blacklist no ve ese dato extra.

## H05 · rojo declarado

La evidencia del PR es fallo de resolución de imports. Eso prueba que faltan módulos, no que una aserción detecta su propiedad rota.

## JSONL

Validación local previa:

```bash
node docs/revision-pr/analizar.mjs verificacion
# 7 hallazgos
# 1 decisión aceptada
# 0 decisiones pendientes
# 6 otros abiertos
```

---

# Ronda 2 · auditoría completa desde cero

**SHA head auditado:** `4c2adedbcae27d3b3cb754325a12769cda5e1749`
**develop actual:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`

## Preflight fresco

```text
PR head: 4c2adedbcae27d3b3cb754325a12769cda5e1749
branch: feat/T-115-vista-de-viaje
compare vs develop: diverged
ahead_by: 3
behind_by: 6
merge_base: 720e2d4f39ab5b4d5d09a55016072eb8fe940855
comments: 1 (informe ronda 1)
review threads: 0
```

## Drift de ficha — H07

Comparación de `docs/tasks/T-115.md` entre el merge-base y develop actual:

```text
OLD DoD:
- mensajes + actions
- typecheck/lint/test
- scope
- bitácora

NEW DoD:
- rojo separado con mensajes + transitions válidas/inválidas + no_show + republish + cancel reason
- implementar-diseno C06/R07/T05; datos solo post-matched
- cancelación: primitiva aprobada + 2 pasos + foco + 48 px
- mensajes/actions + loading/empty/error/pending
- navegador + capturas 390/360
- typecheck/lint/test
- scope
- bitácora

Archivos permitidos: IDENTICAL
```

## Barrido completo de actions — H01, H02, H08, H11

Conteo mecánico sobre `src/features/trips/actions.test.ts`:

```text
callRequestRpc assertions: 0
revalidatePath/revalidateTag mentions: 2 (solo vi.mock)
revalidate expect lines: 0
reportNoShow explicit false: 0
reportNoShow explicit true: 1
queries references en las 2 suites nuevas: 0
```

Matriz:

```text
action           unauth  wrong-role  validation  invalid-state/error  call-assert  revalidate-assert
pickedUp         yes     yes         yes         yes                  no           no
delivered        no      yes         no          no                   no           no
courierCancel    no      no          yes         no                   no           no
noShow           no      yes         no          no                   no           no
merchantCancel   no      no          yes         no                   no           no
republish        no      no          no          no                   no           no
```

## Query / datos del viaje — H09

```text
src/features/trips/queries.test.ts: MISSING
referencias a queries en actions.test.ts + whatsapp.test.ts: 0
```

Mutación que la suite actual no observa:

```text
accepted amount source -> cualquier otro monto: no test falla
contacts before matched -> no test de query falla
courier identity omitida/equivocada -> no test de query falla
```

## UI / T05 / estados — H10

Archivos de producto del diff:

```text
src/features/trips/actions.test.ts
src/features/trips/whatsapp.test.ts
```

No hay `*.test.tsx` de trips. Por lo tanto no existe un control rojo para foco, 2 pasos, 48 px,
loading/empty/error/pending ni envío pendiente.

Primitivas en develop:

```text
src/ui/dialog.tsx: EXISTS
src/ui/alert-dialog.tsx: MISSING
src/ui/button.tsx: EXISTS
src/ui/skeleton.tsx: EXISTS
```

La ficha vigente manda `contract-change` si falta la primitiva compartida requerida.

## Borde de teléfono — H12

`src/lib/format/index.ts` documenta “10 dígitos nacionales”, pero la condición heredada es `length < 8`.

Reproducción del algoritmo exacto:

```text
1234567     => THROW
12345678    => https://wa.me/54912345678?text=Hola
123456789   => https://wa.me/549123456789?text=Hola
1234567890  => https://wa.me/5491234567890?text=Hola
12345678901 => https://wa.me/54912345678901?text=Hola
```

El test nuevo solo usa `'123'`, así que no distingue 8/9/11 del borde documentado.

## Checkout / suites

```bash
git ls-remote https://github.com/cadeApp/cadeApp.git HEAD
# fatal: unable to access ... Could not resolve host: github.com
```

No se pudo obtener el checkout para ejecutar `pnpm typecheck/lint/test`. CI tampoco se consultó porque la ronda
tiene bloqueantes.

## Hallazgos estructurados

Construcción validada con `JSON.parse` línea por línea:

```text
13 registros
12 abiertos
11 bloqueantes abiertos
1 decisión aceptada
lecciones AG-76..AG-87
```

La validación con `node docs/revision-pr/analizar.mjs verificacion` sobre el checkout completo queda pendiente
porque el checkout no está disponible en esta sesión; no se afirma haberla ejecutado.



---

# Ronda 3 · verificación de implementación

**SHA:** `8bc4ee282c11f193c117885404fc2652b8ae820f`

## Preflight

```text
head remoto: 8bc4ee282c11f193c117885404fc2652b8ae820f
PR: Draft
threads: 0
comentarios previos: 2 informes de Lautaro073
compare develop...branch: diverged · ahead 13 · behind 13
último ancestro funcional usado para aislar scope: 2a096317fa1cea1e0c112b2f785907679cf86713
```

La historia extraña viene del rebase pedido por la Ronda 2 y del merge posterior del remoto viejo. No se abrió hallazgo contra P2 por eso.

## Estado de arreglos anteriores

```text
H01 rpcNames exactos presentes: 6/6
H01 toHaveBeenCalledTimes(1): 6
H02 matriz auth: 6 unauth + 6 wrong-role
H03 input omitido para report_no_show: sí
H04 SENTINEL_ADDR/NOTE/COORDS/ID/DNI/PHONE: presentes
H08 INVALID_STATE_TRANSITION: caso por 6 actions
H09 query tests: 6
H10 component tests: 15; aserciones de foco: 0
H11 revalidatePath assertions: 12
H12 bordes <10/>10 y +54/549/0/15: presentes
```

No se ejecutó Vitest, por lo que H01–H04/H07–H09/H11/H12 quedan `arreglado-sin-verificar`.

## Mutaciones / reproducciones independientes

```text
H13 query-mock: GREEN con 3 proyecciones, incluidas 2 inválidas
H14 contacto: GREEN usando recipientPhone como teléfono del cadete
H17 vehicle walk => Bicicleta
H17 vehicle bike => Bicicleta
H17 vehicle moto => Bicicleta
H17 vehicle car => Bicicleta
H17 payment cash => Efectivo
H17 payment transfer => Transferencia
H17 payment to_agree => Transferencia
H18 anti-12px: 18 ocurrencias text-xs enumeradas
```

H13 usó las proyecciones `id,code,pickup_address`, `columna_que_no_existe` y `totally_invalid(*)`; las tres devuelven el mismo `rowData` porque el mock actual ignora el argumento de `.select()`.

## Contrato de esquema comprobado en develop

```text
delivery_requests: sin code, pickup_address, pickup_lat/lng, dropoff_lat/lng
delivery_request_contacts: pickup/dropoff exactos + recipient_name/phone; sin delivery_notes
offers_courier_id_fkey: offers.courier_id -> couriers.profile_id
profiles: sin vehicle_type, vehicle_plate, avatar_url
```

## Alcance / rutas

T-115 dice “mapa reservado para T-117”, pero el head transporta coordenadas, genera `google.com/maps/dir` y lo exige en tests.

Next.js documenta que route groups `(...)` no afectan la URL:
https://nextjs.org/docs/app/api-reference/file-conventions/route-groups

T-114 ya navega a `/trips/${offer.requestId}` y `src/app/route-integrity.test.ts` documenta `/trips/[id]` como contrato de T-115.

## Visual

```text
text-xs total: 18
hex arbitrarios: #25D366, #20ba5a
src/ui/alert-dialog.tsx: no existe
PR body: ítem 390/360 marcado [x]
capturas/enlaces de implementación en PR/bitácora: 0
```

## Monto

```text
TripMerchantView: amountArs: trip.amountArs ?? 0
TripCourierView: amountArs ? formatArs(amountArs) : '$ 0'
components.test.tsx: fixtures con amountArs=1800; sin caso null
```

## Validación estructurada

El `hallazgos.jsonl` de Ronda 3 se validó línea por línea con `JSON.parse` y con la vista `verificacion` de `analizar.mjs` en un árbol aislado de revisión:

```text
26 hallazgos
9 corregidos SIN verificar
5 decisiones aceptadas
0 decisiones pendientes
12 otros (incluye H06 no bloqueante)
11 bloqueantes actuales
```

## Checks no ejecutados

No se inspeccionó CI porque hay bloqueantes. No se ejecutaron `pnpm typecheck`, `pnpm lint` ni `pnpm test` de forma independiente por falta de checkout/pnpm del repo. No se usaron `.env*`, secretos ni servicios remotos.


---

# Ronda 4 · SHA 6a42a26675a8f6bb584e2eaa66c7fdf854bbf49e

## Preflight

```text
head: 6a42a26675a8f6bb584e2eaa66c7fdf854bbf49e
develop: ac4587f3c76f3ce8d63f3abbafff0847b89d9b54
threads inline: 0
CC-008: PR #103 abierta
CC-009: PR #104 abierta
```

## Autorrevisión

```text
commit: b805c947e0631f68172eef26a65dc164b38deb23
author: asako669
path: docs/revision-pr/pr-83/**
```

Se conserva como `revisiones/autorrevision-agy-r4.md`; sus estados verificados no se usan.

## H13

```text
query:
pickup_zone:pickup_zone_id(name)
dropoff_zone:dropoff_zone_id(name)

mock:
solo rechaza code,pickup_address,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng
```

Mutación que el próximo control debe matar: relación/FK inexistente. Si queda verde, el test sigue midiendo un proxy.

## H14

```text
courierWaUrl -> trip.recipientPhone
tel del repartidor -> trip.recipientPhone
TripDetails -> sin courierPhone/merchantPhone
TripCourierView -> sin contacto al comercio
```

## H18 · corrección del revisor

```text
tailwind.config.ts:
xs = 0.875rem
sm = 0.875rem
=> ambos 14px
```

## H20/H23

```text
PR body: todavía menciona Google Maps + rutas (merchant)/(courier)
PR body: 55 suites / 596 tests
bitácora posterior: 56 suites / 630 tests
capturas/enlaces 390/360: ausentes
```

## H24

```text
amountArs: trip.amountArs!
formatArs(trip.amountArs!)
```

CI no consultado por bloqueantes. No se ejecutó suite completa independiente.


---

# Ronda 5 · SHA 2f9cf91fb6f9534b8d60e6f716a6d607239f6dc3

## Preflight

```text
head: 2f9cf91fb6f9534b8d60e6f716a6d607239f6dc3
author final comment: "T-115 lista para Ronda 5 independiente"
docs/revision-pr después de R4: sin nuevos commits del autor
delta 86229cba..2f9cf91f: solo docs/tasks/log/T-115.md (+1/-1)
```

## H05 · reproducción independiente

```text
H14 current courier phone assertion = true
H14 mutated recipient phone assertion = false

H13 current exact requestId input = true
H13 mutated requestId+"-mutated" input = false

H19 current alertdialog role = true
H19 mutated generic dialog role = false
```

Se contrastó además con los asserts exactos presentes en `components.test.tsx` y `queries.test.ts`.

## H20 · inspección visual

Se abrieron las seis PNG directamente desde los blobs del SHA revisado:

```text
c06_merchant_390x844.png
c06_merchant_360x800.png
r07_courier_390x844.png
r07_courier_360x800.png
t05_cancel_390x844.png
t05_cancel_360x800.png
```

Resultado:

- C06: sin overflow visible; contactos principales legibles; faltan contingencias porque preview no pasa callbacks.
- R07: sin overflow visible; datos correctos; CTA inferior visible pero disabled en 390 y 360.
- T05: modal completo y legible en ambas medidas.

Causa confirmada en `render-previews.test.tsx`: render server-side de vistas sin containers/handlers.

La directiva `docs/design/visual-task-directive.md` exige “navegador real con la app corriendo”; el método actual no cumple esa cláusula.

## CI #423

```text
build          success
unit           success — 60 files / 671 tests
audit          success
db-tests       success
typecheck      success
lint           success
bundle-budget  success
```

Metadata del workflow:

```text
event: pull_request
head_sha: 2f9cf91f...
base_sha: 6ac32e77...
```

Develop al cerrar Ronda 5:

```text
bdafee8ff04d6b620eb46dd885b62fe0d675ca49
```

Commits faltantes en la rama:

```text
366a2b85 [T-106]
bdafee8f [CC-010]
```

## Ficha

La ficha oficial de develop aún lista los route groups viejos. La rama agrega `src/app/trips/**` y CC-008/009. Esa modificación está respaldada por las decisiones D02–D05 ya tomadas por Lautaro073; no se abre un nuevo hallazgo de scope.

No se leyeron secretos ni .env.


---

# Ronda 6 · SHA a1914d49fabb7276cba5040449852a55810edb65

## H20

Inspección directa de seis PNG del blob final:

```text
C06 390: contingencias visibles, contactos correctos, sin overflow visible
C06 360: contingencias visibles, contactos correctos, sin overflow visible
R07 390: CTA "Marcar como retirado" habilitado
R07 360: CTA "Marcar como retirado" habilitado
T05 390: alertdialog completo sobre la pantalla
T05 360: alertdialog completo sobre la pantalla
```

Tree del SHA:
- `render-previews.test.tsx`: ausente.
- `c06-merchant.html`: ausente.
- `r07-courier.html`: ausente.
- `t05-cancel-dialog.html`: ausente.

## H25

```text
compare status: ahead
ahead: 29
behind: 0
merge-base: bdafee8ff04d6b620eb46dd885b62fe0d675ca49
```

CI #430:
```text
base_sha: bdafee8ff04d6b620eb46dd885b62fe0d675ca49
head_sha: a1914d49fabb7276cba5040449852a55810edb65
build          success
typecheck      success
db-tests       success
lint           success
audit          success
unit           success — 59 files / 670 tests
bundle-budget  success
```

Build:
```text
ƒ /trips/[id]  229 B  186 kB
```

## Revalidación histórica

Inspección de source + CI #430 confirma H01–H04, H07–H09, H11–H12, H15–H17 y H21.

## Barrido completo

25 archivos TS/TSX revisados; cero coincidencias en:
```text
.only/.skip
setTimeout/sleep
any
@ts-ignore
google.com/maps / maps.google / pickupLat/Lng / dropoffLat/Lng
hex #RRGGBB
import directo de sonner
```

El JSONL actualizado se validó con `JSON.parse` línea por línea. No se ejecutó `node docs/revision-pr/analizar.mjs verificacion` en un checkout local porque esta revisión opera mediante blobs/CI remoto; no se afirma haberlo ejecutado.
