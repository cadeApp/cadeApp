# Informe revisar-pr — PR #698 · T-432 / CC-049 · Ronda 1

**Fecha:** 2026-11-12 · **SHA revisado:** `e77beb59c753b36584d0bf504a3181dcb89515c9`.  
**Base:** `develop@28de2b98dd4f1bff6320a4b313748359293025b2`.  
**Resultado: CON BLOQUEANTES (2). Mejoras: 0. Decisiones pendientes: 0.** No se aprueba ni mergea.

## Comprobaciones de partida

Leídos `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, lecciones de pr-56/pr-62/pr-64/pr-63/pr-68/pr-82, `docs/contracts/CC-049.md`, ficha **desde develop**, bitácora, cuerpo/comentarios del PR y diff de 22 archivos. Head `e77beb59` coincidió al iniciar; `develop` en `28de2b98`; GitHub: `mergeable:true`. `c26f7673..e77beb59` solo añade bitácora. Carpeta `pr-698` inexistente al empezar. `git merge-tree` no ejecutado por falta de clon.

**PR698-A01 / D01-A (ACEPTADA):** la ficha mergeada no incluía `src/domain/cc040-announcements.test.ts`. La rama lo incorpora a whitelist y CC, plan y log, cambiando únicamente endpoint de fixture a un host permitido. Lautaro073 contestó explícitamente **A — aceptar la ampliación de Archivos permitidos**. No queda decisión abierta. Los restantes archivos cumplen la whitelist auditada.

## BLOQUEANTES

### PR698-H01 — No se prueba el JSON del intento bloqueado en el route handler

**Archivo:** `src/app/api/push/send/route.test.ts:81-112` · Alto · `P08-control-no-cubre-lo-que-dice` · origen: agente.

El test exitoso 200 mockea solo `{outcome:'sent', endpoint, status:201}` y afirma `ok`, `sentCount` y que se llamó al emisor. No ejerce `blocked` ni la ausencia de la propiedad `endpoint` en JSON. `src/server/push/push.test.ts:250-277` sí verifica esa ausencia **dentro del emisor**, pero no en `POST /api/push/send`; CC-049 `Impacto exacto y T-432 DoD exigen explícitamente ambas fronteras. **Código de producción actual:** `route.ts:42-45` retorna el resultado directamente y parece correcto; defecto encontrado es de prueba.

**Prueba requerida:** en `route.test.ts`, POST autorizado con mock de `sendPushNotification` devolviendo `attempts` con intento `blocked` sin endpoint; afirmar forma exacta en JSON, `Object.hasOwn(blocked, 'endpoint') === false` y conteos. **Mutación nueva independiente pendiente:** agregar temporalmente `endpoint: 'https://push.example.com/leak'` solo al intento bloqueado al serializar en `route.ts`; el test nuevo debe fallar por su aserción, no setup; restaurar fuente sana y GREEN. **No se ejecutó esta mutación en la revisión.** CI no detectó el hueco porque solo le suministra un intento enviado.

### PR698-H02 — No se prueba la contabilización del 3xx por el emisor

**Archivo:** `src/server/push/push.test.ts:280-358` · Alto · `P08-control-no-cubre-lo-que-dice` · origen: agente.

La matriz del emisor prueba éxito con `200/201`, borrado con `404/410` y fallo con `429/500/503`, pero no `3xx`. `src/server/push/transport.test.ts:105-119` demuestra que un 302 **no se sigue**, no que `sendPushNotification` lo compute como fallo y no borre. El código `sender.ts:379-392` clasifica `status >= 200 && status < 300` correctamente, pero falta protección de regresión en la frontera siguiente.

**Prueba requerida:** incluir 302 en la matriz (idealmente 300/302/307/399 para bordes), comprobar `sentCount=0`, `failedCount=1`, `deletedSubscriptions=[]`, cero `deleteSubscriptionByEndpoint`, y `attempts=[{outcome:'sent',endpoint,status}]`. **Mutación independiente pendiente:** cambiar temporalmente `status < 300` → `status < 400` en `sender.ts`, prueba de 3xx RED por contadores y restauración GREEN. **No se ejecutó esta mutación en la revisión.**

## MEJORAS

Ninguna adicional identificada en este SHA.

## Evidencia RED/GREEN y límites

- Run [43165418123](https://github.com/cadeApp/cadeApp/actions/runs/43165418123) **de código `c26f7673`**: Vitest **204 archivos / 3860 tests**; pgTAP **46 archivos / 3858 tests** (CC-049 57/57); `CC-049 preservación GREEN` en primera aplicación; typecheck, lint, build, audit, bundle-budget SUCCESS, y paso `git diff --exit-code -- src/types/database.types.ts`. Es evidencia del proveedor consultada, no ejecución propia.
- RED antes de migración [43164852008](https://github.com/cadeApp/cadeApp/actions/runs/43164852008): CC-049 **19/21** fallan antes de error por helper ausente.
- Mutaciones del autor #699 grant, #700 policy, #701 RPC, #702 host, #703 emisor, #704 timeout, #705 DELETE, #706 timestamp: los fallos correspondientes aparecen en logs y las PR están cerradas sin merge. No reemplazan mutaciones **propias** para H01/H02.
- Inspección por clases: privilegios RLS vs grants, RPC, host E01–E19, filtro emisor, categorías HTTP, JSON de intentos y preservación histórica. No se detecta otra violación concreta.
- **No corrí** `pnpm typecheck`, `lint`, `test`, `test:db`, Vitest de mutaciones nuevas, E2E ni `git merge-tree`: terminal sin DNS hacia github.com. Supabase/Docker no levantados. Ambos hallazgos son **por inspección**, `verificado_en_sha=null`. CI GREEN `c26f7673` sirve para el código; `e77beb59` solo agrega log y no se exige nuevo GREEN por eso.
- **Carrera detectada antes del commit:** mientras se confeccionaba esta ronda, head avanzó a `71b5f3b2` con cambios en `route.test.ts`, `push.test.ts` y bitácora. Ya hay un caso `blocked` y un 302 en el nuevo código, **aún no verificados independientemente**. No se retrocede ni pisa ese commit. La ronda **1** registra lo encontrado sobre `e77beb59`; la ronda **2** auditará `71b5f3b2` o posterior y su RED/GREEN. El agy dejó declarada una mutación local de 302 en bitácora; no la firmamos como verificada.
- E2E preview con migración se difiere al rollout a Develop; no se da por verde.

## Prompt acotado para el agy

Tarea: T-432, PR #698, rama `feat/T-432-sec07-push-hardening`.

0. `git pull` primero (trae el commit de la revisión); sin rebase, force-push ni amend. **Nota de carrera:** el agy ya publicó `71b5f3b2` mientras se preparaba este informe. No rehagas cambios de H01/H02 a ciegas: compará esos tests con los criterios abajo, ejecutá pruebas RED→GREEN y dejá la evidencia en la bitácora.
1. Archivos persistentes que podés tocar **SOLO si hace falta ajustar**: `src/app/api/push/send/route.test.ts`, `src/server/push/push.test.ts` y `docs/tasks/log/T-432.md`. Para mutaciones exclusivamente temporales sin commit, `src/app/api/push/send/route.ts` y `src/server/push/sender.ts`. Prohibido `docs/revision-pr/**` (propiedad del revisor), cambiar ficha/CC/plan/migración, dependencias, crear archivos nuevos en el repo y agregar `.only`, `.skip` o sleeps.
2. **PR698-H01:** prueba POST autorizada en `src/app/api/push/send/route.test.ts`. Mockear `sendPushNotification` con al menos un intento `{ outcome: 'blocked', status: 0, error: 'ENDPOINT_NOT_ALLOWED' }` sin `endpoint`. Verificar HTTP 200, JSON con el intento exacto, `Object.hasOwn(blocked,'endpoint') === false`, conteos y ausencia de la URL rechazada en la respuesta. La versión publicada en `71b5f3b2` ya incluye un caso de este tipo: **no eliminar ni debilitarlo**. Mutación efímera de `route.ts`: transformar únicamente los intentos `blocked` del resultado HTTP para agregar `endpoint: 'https://push.example.com/leak'`; el test nuevo tiene que dar RED por su expectativa concreta; con fuente sana, GREEN.
3. **PR698-H02:** matriz en `src/server/push/push.test.ts` que afirme para un 3xx `sentCount===0`, `failedCount===1`, `deletedSubscriptions===[]`, ningún borrado y `attempts` con `{outcome:'sent', endpoint, status}`. El commit `71b5f3b2` ya agregó 302; **verificá** con mutación efímera en `sender.ts` reemplazando `status < 300` por `status < 400`: debe quedar RED únicamente por contar erróneamente 302 como éxito, no por setup ni mocks. Restaurado, GREEN. Como endurecimiento adicional recomendado, agregar 300 y 399 (límites del intervalo) si no alarga desproporcionadamente la suite; la misma mutación debe volverlos rojos.
4. **No fabricar tests RED/GREEN ni adulterar expectations, mocks o código productivo para que pasen.** Mantener las rutas reales como SUT. Las mutaciones solo en copia descartable/ejecución efímera, nunca commiteadas. Registrar líneas reales `Test Files` y `Tests` rojas/verdes más nombres de aserciones; un error de import/setup no es rojo válido.
5. Control y cierre: `pnpm exec vitest run src/app/api/push/send/route.test.ts src/server/push/push.test.ts` (control, mutación RED, restaurado GREEN); `pnpm typecheck && pnpm lint && pnpm test`; `pnpm exec vitest run tools`; `git diff --name-only`; `git status --short`. `test:db` se verifica en CI, sin Supabase/Docker local. No exigir GREEN nuevo solo por documentación.
6. En bitácora: hecho / prueba RED-GREEN / falta, D01-A **elegida expresamente por Lautaro073**. No escribir estados `arreglado-verificado` ni `verificado_en_sha`. Si hay cambios nuevos: commit Conventional Commits con [T-432], push normal y adjuntar `git ls-remote origin feat/T-432-sec07-push-hardening`. El revisor hará ronda 2 independiente del SHA resultante.
