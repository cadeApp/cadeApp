# Evidencia y reproducción — PR #454 / T-384

**HEAD inspeccionado:** `cc87a902e30c5c2f452e80edb34ca78dac396ab3`; **fecha:** 2026-10-20.

**Limitación reproducible:** el entorno del revisor no puede resolver github.com con git; no hay clon local y la ficha prohíbe levantar Supabase/Docker. Las evidencias ejecutadas provienen exclusivamente de GitHub CI, mientras que los diagnósticos de SQL y cobertura de casos son inspección de blobs. Ninguna mutación de base fue ejecutada por este revisor.

## Evidencia real observada
- Parches y archivo completos consultados a través de GitHub: 9 archivos modificados; `supabase/tests/cc033_add_courier_optional_document.sql` tiene 16 líneas con `plan(1)` y `has_function`.
- CI run: https://github.com/cadeApp/cadeApp/actions/runs/39384096110
- Job unit: https://github.com/cadeApp/cadeApp/actions/runs/39384096110/job/118499702217
- Líneas comprobadas en el log: `Test Files 149 passed (149)`, `Tests 2904 passed (2904)` y `Coverage for branches (89.45%) does not meet "src/domain/**/*.ts" threshold (90%) for src/domain/testing/rpc-fake.ts`.
- `db-tests` (job 118499702385) terminó FAILURE: la suite SQL final registró `Files=32, Tests=2869, Result: PASS`, pero el paso `git diff --exit-code -- src/types/database.types.ts` salió con código 1. El log muestra la firma en otra posición y la indentación incorrecta.

## Comandos para ejecutar DESPUÉS del arreglo sobre un worktree limpio
Desde el clon normal del proyecto y sobre el HEAD publicado por el autor. No ejecutar sobre el árbol sucio ni con secretos.

```bash
#!/usr/bin/env bash
set -euo pipefail
git fetch origin
git status --short
git rev-parse HEAD
git ls-remote origin feat/T-384-cc033-optional-document

# Mínimo focalizado.
pnpm exec vitest run src/domain/cc033-add-courier-optional-document.test.ts src/server/rpc/courier.test.ts

# Gate real de cobertura (NO ajustar umbrales ni adulterar expectativas).
pnpm test:coverage > /tmp/pr454-coverage.log 2>&1 || {
  tail -n 60 /tmp/pr454-coverage.log
  exit 1
}
grep -E 'Test Files|Tests |Coverage for branches|ERROR:' /tmp/pr454-coverage.log | tail -n 30

pnpm typecheck
pnpm lint

# NO ejecutar supabase start, pnpm test:db ni Docker local para esta revisión.
# Verificar db-tests y su comparación db:types SOLO en el job CI del SHA.
```

## Mutaciones independientes exigidas para la ronda 2 (NO ejecutadas aún)
Deben correr de forma temporal y RESTAURARSE; nunca se commitean mutantes ni se alteran assertions. En PostgreSQL usar base efímera exclusivamente a través de db-tests CI, con las dos sesiones reales existentes de CC-025; una mutación RED debe fallar por **la propiedad** verificada.

| Hallazgo | Mutación RED propuesta | Aserción que debe caer |
|---|---|---|
| H01 | Quitar la validación del objeto en `storage.objects` en copia efímera | pgTAP objeto inexistente → NOT_FOUND sin inserciones/auditoría |
| H01 | Quitar el rechazo de `vehicle_type is null` | pgTAP pending incompleto → INVALID_STATE_TRANSITION y sin inserción |
| H01 | Permitir `kind = 'selfie'` en copia efímera | pgTAP kind prohibido → VALIDATION_ERROR |
| H01 | Eliminar revoke de EXECUTE a anon en copia efímera | pgTAP `has_function_privilege('anon', ..., 'EXECUTE') = false` |
| H01 | Suprimir insert de `audit_log` | Aserción positiva del único registro auditado falla |
| H02 | Invertir orden de locks couriers/documentos en función efímera | `cc033_concurrency.mjs --mutation-check` detecta carrera/deadlock real; restaurado normal verde |
| H03 | Quitar `v_kind_text IS NULL` tras corregir | Llamada directa sin kind rechazada específicamente con VALIDATION_ERROR |
| H03 | Convertir `!~` a `!~*` en sufijo tras corregir | Prueba .PNG en PostgreSQL pasa de VALIDATION_ERROR a aceptación indebida |
| H03 | Volver a convertir UUID vacío en ausencia | Prueba clave enviada `""` exige VALIDATION_ERROR |
| H04 | Saltarse comprobación de existencia Storage del fake | Caso fake sin objeto deja de retornar NOT_FOUND |
| H04 | Borrar guard `vehicleType === null` del fake | Caso pending incompleto deja de retornar INVALID_STATE_TRANSITION |
| H04 | Devolver `idempotent: false` en un reintento | Test de reintento y no duplicación falla |
| H05 | Sustituir nombre RPC del wrapper por `replace_courier_document` | Spy debe detectar exactamente el nombre incorrecto |

**Condición de aceptación:** por cada mutación, anotar run/comando, línea de rechazo RED y GREEN restaurado del *mismo* test, verificar que el fallo no sea por crash del harness o ausencia de objetivo. No falsificar resultados ni editar pruebas para pasar.

## Inspección estática del bug NULL (H03)
En SQL, `NULL NOT IN ('license','insurance')` evalúa a NULL, no TRUE. Con `storagePath` no vacío, la expresión del IF es NULL/FALSE y no entra al `raise VALIDATION_ERROR`. El valor NULL continúa hasta una verificación de objeto y un INSERT de `kind` NOT NULL (o un NOT_FOUND si el objeto no existe), quebrando el contrato de error. Se requiere pgTAP antes de marcar verificado.

## No comprobado
No se pudo ejecutar `git merge-tree`, tests unitarios locales ni suite SQL propia. La ausencia de estos comandos no es un pase silencioso: exige revalidación por un revisor en la siguiente ronda.

## Ronda 2 — 2026-10-20 — SHA cb32fdce9986ed133db68def0d1a2017122b90a7

### CI verificado desde los logs originales

- Run https://github.com/cadeApp/cadeApp/actions/runs/39437579550 (completado SUCCESS).
- Unit job https://github.com/cadeApp/cadeApp/actions/runs/39437579550/job/118678566926: `Test Files 152 passed`, `Tests 2961 passed`, `rpc-fake.ts branches 90.63%`.
- DB job https://github.com/cadeApp/cadeApp/actions/runs/39437579550/job/118678566374: `Files=34, Tests=3012, Result: PASS`, `[CC-033] concurrencia completada sin deadlocks en producción.`, `[CC-033] mutación RED detectada y migración original GREEN restaurada.`; paso `git diff --exit-code -- src/types/database.types.ts` con resultado SUCCESS.
- Typecheck, lint, audit, build, bundle-budget: SUCCESS en el mismo run.

### Comprobación independiente en Node (sólo regex, no FakeRpcClient)

Se reprodujo este fragmento aislado de las regex presentes en la rama:

```bash
node - <<'JS'
const suffix='1730000000005.PNG';
const fake=/^[0-9]+[.](png|jpe?g|webp|pdf)$/i;
const sql=/^[0-9]+[.](png|jpe?g|webp|pdf)$/;
console.log(JSON.stringify({suffix,fake_accepts:fake.test(suffix),sql_accepts:sql.test(suffix)}));
JS
```

**Salida real:** `{"suffix":"1730000000005.PNG","fake_accepts":true,"sql_accepts":false}`.
Prueba aislada de semántica de expresiones regulares; no se hizo pasar por test verde/rojo del repositorio.

### Arnés para la próxima ronda (guardar como /tmp/pr454-r3.sh y ejecutar desde repo limpio)

```bash
#!/usr/bin/env bash
set -euo pipefail
test -f src/domain/testing/rpc-fake.ts
test -f src/domain/cc033-add-courier-optional-document.test.ts
node --input-type=module <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('src/domain/testing/rpc-fake.ts','utf8');
const segment=s.slice(s.indexOf("add_courier_optional_document: (rawInput)"),s.indexOf("replace_courier_document: (rawInput)"));
assert.ok(segment.length>0,'RPC fake debe existir');
assert.ok(segment.includes('!/^[0-9]+[.](png|jpe?g|webp|pdf)$/.test(suffix)'), 'fake debe usar regex sin i');
console.log('PASS: guard de extensión case-sensitive presente');
JS
pnpm exec vitest run src/domain/cc033-add-courier-optional-document.test.ts src/server/rpc/courier.test.ts
pnpm test:coverage > /tmp/pr454-r3-coverage.log 2>&1 || { tail -n 60 /tmp/pr454-r3-coverage.log; exit 1; }
grep -E 'Test Files|Tests |rpc-fake.ts|Coverage for branches' /tmp/pr454-r3-coverage.log | tail -n 15
pnpm typecheck
pnpm lint
# PostgreSQL NO local. Verificar pgTAP, concurrencia y drift sólo desde db-tests CI.
```

Para RED genuino, agregar primero los tests de `.PNG`, actor merchant, consentimiento inactivo y `approved`. El test de `.PNG` debe fallar sobre el fake actual con `/i` (se acepta cuando se exige VALIDATION_ERROR), luego pasar sin `/i`. Comprobar que falla la ASERCIÓN esperada y no el arnés. Para SQL, preparar mutaciones efímeras bajo el runner autorizado db-tests y conservar sus resúmenes. Esta sesión no pudo ejecutar dicho arnés sobre el repositorio por fallo DNS al hacer git ls-remote; no se inventó resultado.

## Ronda 3 — 2026-10-20 — SHA `5ebda83932d8279a7f88e61e70694d0136ed8fc5`

- Comparación GitHub `7e0712a5...5ebda83932d8279a7f88e61e70694d0136ed8fc5`: solo cuatro archivos de corrección (SQL pgTAP, fake, test fake, bitácora), cero commits behind. No edición nueva de la carpeta del revisor.
- CI oficial [39444717225](https://github.com/cadeApp/cadeApp/actions/runs/39444717225): unit job 118703452341 `152 files / 2965 tests passed`, fake branch `90.69%`; db job 118703452788 `cc033_add_courier_optional_document.sql .. ok`, `Files=34, Tests=3019, Result: PASS`, comparador de tipos SUCCESS. `build/lint/typecheck/audit/bundle-budget` verdes.
- [e2e-preview workflow 39444841967](https://github.com/cadeApp/cadeApp/actions/runs/39444841967): resolve-preview imprimió `BLOCKED / REQUIRES DEVELOP MIGRATION`, e2e job SKIPPED; el contexto de commit `e2e-preview` es ERROR adrede por `gatePreview` al detectar la migración. No hay Playwright ejecutado.
- `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD`: error real `Could not resolve host: github.com` en contenedor de revisión; no clon Git ni tests Vitest/PG locales. Protección de develop: API devuelve 403.

### Comprobación independiente de semántica de regex (fuente real, en memoria)

Ejecutado por este revisor sobre las expresiones extraídas del blob publicado de `rpc-fake.ts` y la migración. **Los once chequeos estructurales/semánticos dieron true**, pero los estructurales solo comprueban presencia de reglas y aserciones; no constituyen pruebas de comportamiento de la aplicación. Observación directa:

```text
SHA=5ebda83932d8279a7f88e61e70694d0136ed8fc5
fakeFlags=""
fake aceptó .jpg=true
fake aceptó .PNG=false
SQL aceptó .PNG=false
mutante /i aceptó .PNG=true
```

La variante mutada admite el sufijo que la prueba pretende rechazar, **RED de la propiedad de la expresión**, no RED ejecutado en Vitest. No se mutó archivo alguno, no se alteró una expectativa y no se afirmó haber reproducido las mutaciones del agy.

### Arnés completo copiable a /tmp (sin mutación del working tree)

El siguiente script puede guardarse como `/tmp/pr454-r3.sh` y ejecutarse desde un clon limpio del SHA revisado. El bloque Node *extrae* la regex y demuestra su mutación `/i` en memoria; los tests reales se corren sin modificar producción. **Este arnés no fue ejecutado íntegro por este revisor** porque no hay clon. No iniciar Supabase ni Docker local.

```bash
#!/usr/bin/env bash
set -euo pipefail
test "$(git rev-parse HEAD)" = "5ebda83932d8279a7f88e61e70694d0136ed8fc5"
git diff --quiet
git diff --cached --quiet
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const fake = readFileSync('src/domain/testing/rpc-fake.ts','utf8');
const migration = readFileSync('supabase/migrations/20261020065319_cc033_add_courier_optional_document.sql','utf8');
const tests = readFileSync('src/domain/cc033-add-courier-optional-document.test.ts','utf8');
const pg = readFileSync('supabase/tests/cc033_add_courier_optional_document.sql','utf8');
const slice = fake.slice(fake.indexOf('add_courier_optional_document: (rawInput)'),fake.indexOf('replace_courier_document: (rawInput)'));
assert.ok(slice.length > 200);
const re = slice.match(/!\/([^\n/]+)\/([a-z]*)\.test\(suffix\)/);
const sql = migration.match(/v_storage_suffix !~ '([^']+)'/);
assert.ok(re && sql, 'Guard de producción real no encontrado');
const green = new RegExp(re[1],re[2]), sqlPattern = new RegExp(sql[1]), red = new RegExp(re[1],re[2]+'i');
assert.equal(green.test('1730000000005.jpg'),true);
assert.equal(green.test('1730000000005.PNG'),false);
assert.equal(sqlPattern.test('1730000000005.PNG'),false);
assert.equal(red.test('1730000000005.PNG'),true);
assert.ok(tests.includes('storagePath: uppercasePath })'));
assert.ok(tests.includes("getDocument(documentId)"));
assert.ok(pg.includes("consent_status = 'reconsent_required'"));
assert.ok(pg.includes("'pending crea license vigente'"));
assert.ok(pg.includes("'42501'::char(5),null::text,'INSERT directo denegado"));
console.log('GREEN guard original; RED propiedad con mutación /i en memoria; tests/pgTAP presentes');
JS
pnpm exec vitest run src/domain/cc033-add-courier-optional-document.test.ts src/server/rpc/courier.test.ts
pnpm test:coverage > /tmp/pr454-r3-coverage.log 2>&1 || { tail -n 60 /tmp/pr454-r3-coverage.log; exit 1; }
grep -E 'Test Files|Tests |rpc-fake.ts' /tmp/pr454-r3-coverage.log | tail -n 15
pnpm typecheck
pnpm lint
node --check supabase/tests/integration/cc033_concurrency.mjs
git diff --check
```

La mutación RED del fake completo (merchant/consent/documentos.set) y mutación RED de PostgreSQL **no se ejecutaron independientemente**. En un futuro entorno con clon + runner autorizado, ejecutar mutaciones efímeras con test real y restauración, sin cambiar expectativas ni rebajar gates.
