# Ronda 1 — PR #91 (`T-203`) — revisión independiente

- **PR:** #91 · `feat/T-203-emisor-push` → `develop`
- **Tarea:** `T-203` · Issue #30 · ficha leída desde `develop`
- **Autor:** `Lautaro073` (P1)
- **SHA revisado:** `038faab20a32fe5d468eede1310d45eb8a570c61`
- **develop al revisar:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`
- **Fecha:** 2026-09-24

## Informe `revisar-pr`

```text
Informe revisar-pr — T-203 — 2026-09-24 — generado por revisión independiente
Resultado: CON BLOQUEANTES (8)
Checks locales: typecheck no verificado · lint no verificado · test no verificado · test:db ❌ faltante en la evidencia del autor
BLOQUEANTES:
- [docs/tasks/T-203.md:11-25] (PR91-A01) La ficha vigente en develop no permite package.json/pnpm-lock.yaml y declara dependencias nuevas: ninguna; la rama se autoamplía y después usa esa versión para marcar alcance ✅ → corregir la especificación oficial fuera de esta rama o retirar los cambios fuera de alcance; no volver a ensanchar T-203.md dentro del PR.
- [src/server/push/sender.ts:179-255] (PR91-H01) El emisor queda aislado: no hay ningún call site de producción desde publicar solicitud/nueva oferta/aceptar/expirar, ni purga por logout/deshabilitación; tampoco se conserva platform ni el status HTTP por intento. El fallo del Juez exige esos ítems → alinear primero la ficha oficial con el fallo y luego implementar/probar los call sites y ciclo de vida que correspondan.
- [src/server/push/push.test.ts:127-173] (PR91-H02) El test de “post-commit” fabrica su propia transición y no afirma que el transporte se invoque; convertir safeNotifyPostTransition en no-op conserva sus aserciones → agregar una aserción positiva del envío y, con el alcance corregido, probar el orden post-commit en los call sites reales.
- [src/server/push/sender.ts:131-168] (PR91-H03) El test de 410 inyecta un transporte que ya devuelve {status:410}; no prueba WebPushTransport, donde web-push entrega 410/404 como rejection con statusCode. Si ese adaptador vuelve a propagar el error, la suite del DoD queda verde pero la suscripción real no se borra → mockear web-push y probar la traducción 404/410 y error sin statusCode.
- [src/server/push/push.test.ts:56-125] (PR91-H04) La privacidad se verifica solo para request_published y offer_accepted; offer_submitted, request_cancelled y request_expired quedan fuera del control → enumerar las 5 variantes con sentinelas/extra fields y payload exacto.
- [src/server/push/push.test.ts:214-248] (PR91-H05) “201 o 200” solo prueba 201 y “500, 503, 429” solo prueba 500; una regresión que borre 429 o rechace 200 queda verde → parametrizar 200/201, 404/410 y 429/500/503.
- [docs/tasks/log/T-203.md:16-22] (PR91-H06) La bitácora y el informe marcan test:db n.a. porque no se tocó supabase/, pero AGENTS.md y revisar-pr lo exigen también al tocar src/server/** → ejecutar el check aplicable y registrar su salida real.
- [docs/tasks/log/T-203.md:6-22] (PR91-H07) aa89372 sí puso tests antes del sender, pero todo el archivo fallaba porque ./sender no existía; eso es rojo de setup (pr-83/AG-80), no la mutación semántica de privacidad/best-effort/410 que regla 40 exige anotar → rehacer mutaciones por propiedad y pegar rojo/verde en la bitácora.
MEJORAS:
- ninguna separada; H05 es pequeño pero se mantiene bloqueante porque protege que errores transitorios no destruyan suscripciones válidas.
No revisado / dudas para Lautaro073:
- CI final no se abrió mientras existen bloqueantes.
- No se atribuye verde independiente a typecheck/lint/test porque el entorno de revisión no pudo obtener un checkout ejecutable (DNS a github.com bloqueado).
```

## 1. Alcance y ficha

La ficha de `develop` permite `src/server/push/**`, `src/app/api/push/**`, `supabase/migrations/**`, la propia ficha/bitácora y `docs/revision-pr/**`; en dependencias nuevas dice `ninguna`. En la rama, `docs/tasks/T-203.md` agrega `package.json`, `pnpm-lock.yaml` y `web-push`, y después los dos archivos raíz aparecen en el diff.

La discrepancia es real: `.agents/rules/25-stack-y-patrones.md` ya enumera `web-push (T-203)`. Eso vuelve defectuosa la ficha original, pero no autoriza a la misma rama a modificar la fuente de alcance que se usa para juzgarla. `PR91-A01` se clasifica `origen=ambos` por esa razón.

## 2. Clase completa del fallo del Juez

El fallo `.el-consejo/revision-1/adjudication/push-notification-implementation-scope.json` asigna a backend cinco grupos. Barrido sobre `038faab`:

| Grupo del fallo | Estado en `038faab` |
|---|---|
| almacén por usuario/dispositivo + alta/baja dueño-solo | **parcial**: tabla/RLS ya existían y POST/DELETE existen; `platform` no se escribe |
| emisor server-side Node + VAPID | **implementado** |
| disparo desde transiciones reales, después del commit, con destinatarios correctos | **faltante**: no hay call sites de producción |
| ciclo de vida: upsert/apertura, 404/410, logout, deshabilitación | **parcial**: upsert y 404/410; faltan purgas de logout/deshabilitación |
| payload mínimo tipo+id sin PII | **implementado hoy**, pero el control cubre solo 2/5 variantes |
| registro de resultado + código de respuesta por envío | **parcial/faltante**: `SendPushResult` conserva conteos, no status HTTP por intento |

No hay una tarea posterior de backend que figure como dueña del cableado faltante; `T-202` es cliente y depende precisamente de T-203. Por eso no es seguro mergear T-203 como “terminada” dejando el emisor huérfano.

## 3. Hallazgos técnicos de pruebas

### PR91-H02 — el control “post-commit” mide una bandera del test

`push.test.ts` define `executeTransition`, pone `businessTransitionCommitted = true`, llama a `safeNotifyPostTransition` y luego comprueba esa misma bandera. No hay `expect(failingTransport.send).toHaveBeenCalled()`.

Mutación del revisor `X01`: reemplazar la llamada interna de `safeNotifyPostTransition` por `return`. Las dos aserciones del test siguen determinadas enteramente por el propio `executeTransition`. Es el mismo tipo de agujero que `P04-test-tautologico`/`AG-80`: el control no observa el efecto que nombra.

### PR91-H03 — el 410 de producción atraviesa una frontera que el test salta

La política de limpieza está en dos capas:
1. `WebPushTransport.send` convierte una rejection de `web-push` con `statusCode` en `{ status }`.
2. `sendPushNotification` borra si el status resultante es 404/410.

El test cubre solo la capa 2 con un transporte fake que **resuelve** `{ status: 410 }`. `database-client.test.ts` importa `WebPushTransport` pero no lo usa. Si la capa 1 vuelve a propagar la rejection, `sendPushNotification` la captura como error genérico y nunca entra a la rama de borrado. El DoD queda roto sin que el test actual lo vea.

### PR91-H04/H05 — enumeración incompleta

`PushEvent` tiene cinco variantes separadas. La prueba de extra fields cubre dos. Del mismo modo, dos títulos de tests declaran matrices de status pero ejercen una sola muestra. Para privacidad y ciclo de vida, una muestra no representa la clase entera (`AG-37`).

## 4. Evidencia/TDD

El orden TDD sí existe en Git: `aa89372` agrega `src/server/push/push.test.ts` y `sender.ts` todavía no existe. Eso no alcanza para la exigencia específica de regla 40: romper cada propiedad y mostrar que su prueba cae.

En `aa89372`, el archivo completo no puede importar `./sender`; por lo tanto el rojo es de infraestructura/setup. La bitácora de 18:25 deja `test n.a.` y la de 19:26 solo contiene el verde final. El cuerpo del PR afirma “Cada prueba nueva se demostró fallando al romper la regla (ver bitácora)”, pero esa evidencia no está en la bitácora.

## 5. Entorno y CI

El runtime de revisión no pudo clonar el repositorio: `git clone` terminó con `Could not resolve host: github.com`. La inspección se hizo sobre objetos remotos exactos mediante GitHub, siempre en el SHA `038faab`.

Por eso:
- no se marcan `typecheck`, `lint` ni `test` como verdes independientes;
- no se inspeccionó CI porque ya hay bloqueantes;
- no se levantó Supabase/Docker local;
- el arnés de mutación completo quedó documentado para reproducirlo en un checkout.

## 6. Prompt acotado para el agy

> **No ejecutar la parte de producto hasta que Lautaro073 corrija en `develop` la ficha T-203 o cree tareas dependientes explícitas para los ítems del fallo que hoy no caben en el alcance.** No resuelvas esa contradicción editando otra vez la ficha de esta rama.

```text
Tarea: T-203, PR #91, rama feat/T-203-emisor-push.
0. git pull (trae el commit de la revisión de ronda 1). Sin rebase, force-push ni amend.

Antes de tocar producto: verificá que origin/develop ya contenga la corrección oficial de alcance para T-203. Si no está, frená y anotá “bloqueada por ficha” en la bitácora; no edites docs/tasks/T-203.md para darte permisos.

Una vez corregida la ficha en develop: mergeá origin/develop en la rama (nunca rebase). En docs/tasks/T-203.md gana la versión de develop.

Podés tocar SOLO los archivos que queden explícitamente permitidos por esa ficha corregida, más docs/tasks/log/T-203.md. Para los hallazgos que ya caben en el alcance actual: src/server/push/** y src/app/api/push/**.
Prohibido: docs/revision-pr/**, marcar hallazgos como verificados, ampliar otra vez la ficha desde esta rama, crear dependencias nuevas distintas de las que develop autorice, rebase/force-push/amend.

Pasos:
1. PR91-H02: endurecé safeNotifyPostTransition. La prueba debe afirmar que el transporte fue invocado y que una falla no cambia el resultado de la transición. Mutación roja obligatoria: convertir safeNotifyPostTransition en no-op; pegá la línea “Tests …” roja y luego verde.
2. PR91-H03: testeá WebPushTransport contra el comportamiento real del adaptador. Mockeá web-push.sendNotification rechazando con {statusCode: 410}, {statusCode: 404} y un Error sin statusCode. Mutación roja: reemplazar el mapeo de statusCode por throw; la suite debe caer.
3. PR91-H04: parametrizá las 5 variantes de PushEvent. Para cada una inyectá un SENTINEL_PII mediante extra field y exigí rechazo/payload exacto. Mutación roja: volver .passthrough() una sola variante; debe caer esa fila.
4. PR91-H05: parametrizá 200/201 como éxito, 404/410 como baja y 429/500/503 como falla transitoria sin baja. Mutaciones rojas: tratar 429 como expirada y aceptar solo 201.
5. PR91-H06: corré el check de base que corresponde por tocar src/server/** y registrá salida real; no lo marques n.a.
6. PR91-H07: documentá en la bitácora las mutaciones semánticas anteriores con sus líneas de resumen en rojo y verde. El rojo de import de aa89372 no cuenta como demostración de esas propiedades.
7. PR91-H01/A01: implementá el cableado post-commit, purgas de ciclo de vida, platform y registro de status SOLO en los call sites/archivos que la ficha corregida en develop autorice. Si Lautaro divide esos ítems en otras tareas, dejá sus IDs explícitos y no marques T-203 como cierre del fallo completo hasta que la dependencia quede representada.

No resuelvas decisiones de alcance por tu cuenta. Al terminar: bitácora (hecho / pruebas / falta; no escribas “verificado”), commit [T-203], push, y pegá la salida de git ls-remote origin feat/T-203-emisor-push.
```
