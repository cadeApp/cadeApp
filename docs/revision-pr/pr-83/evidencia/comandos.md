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

