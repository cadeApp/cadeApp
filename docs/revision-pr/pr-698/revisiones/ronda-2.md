# Informe revisar-pr — PR #698 / T-432 / CC-049 — Ronda 2

**Fecha:** 2026-11-12  
**SHA auditado:** `69fdfd852873bb01bf7cc2411f3cf1a7bea091b8`  
**Base:** `develop@28de2b98dd4f1bff6320a4b313748359293025b2`  
**Resultado: SIN BLOQUEANTES NUEVOS DE CÓDIGO; H01/H02 CORREGIDOS Y VERIFICADOS EN LAS PROPIEDADES AISLADAS.** **No está lista para merge: CI `build` FALLÓ en este SHA.** No se aprueba ni mergea.

## Qué cambió entre rondas

- `494e718c..69fdfd85`: **un commit**, tres archivos — `src/app/api/push/send/route.test.ts` (+2 líneas), `src/server/push/push.test.ts` (+300 y 399 a la matriz), `docs/tasks/log/T-432.md` (19 líneas). `sender.ts` y `route.ts` **no se modificaron** para obtener GREEN. Carpeta `docs/revision-pr/pr-698/` no fue tocada por el autor desde la revisión anterior (último commit previo de esa ruta: `494e718c`).
- Full diff `develop..69fdfd85`: 27 rutas, incluyendo los cinco documentos de revisión de ronda 1. `src/domain/cc040-announcements.test.ts` es la única ruta extra respecto de la whitelist **de develop**, y ya está aceptada como D01-A. La ficha de la rama agrega solo esa ruta a «Archivos permitidos».
- PR abierta, sin merge; `mergeable: true` según GitHub. No se ejecutó `git merge-tree`: el contenedor no resuelve `github.com` para clonar.

## Cierre de hallazgos

### PR698-H01 · CORREGIDO / VERIFICADO EN LA FRONTERA AISLADA

`src/app/api/push/send/route.test.ts:113-143`: POST autorizado con un `sent` y un `blocked` sin `endpoint`. Aserciones concretas: HTTP 200, `sentCount=1`, `failedCount=1`, `JSON.stringify(json)` sin `push.example.com`, objeto `blocked` exacto y `Object.hasOwn(blocked, 'endpoint') === false`. El mock de `sendPushNotification` solo sustituye la dependencia normal de la ruta; la función `POST` real es el SUT.

- **Autor, bitácora:** 55/55 GREEN, mutación temporal de `route.ts` que agrega un `endpoint` en `blocked`: **1 fail / 54 pass**, fallo esperado de aserción; restaurado 55/55.
- **Revisor, comprobación propia en Node 22:** ejecutó en VM la función `POST` extraída del código TypeScript real, con `NextResponse.json` simulado mediante `JSON.stringify`/`JSON.parse`, auth y schema stub válidos. Control GREEN; mutación **en memoria** de serializar un endpoint rechazado → RED por objeto distinto; retorno a fuente intacta → GREEN.
- **Límite:** no ejecutó Vitest local ni una integración con Next; sí se verificó la prueba de ruta publicada y el log CI unit del SHA.

### PR698-H02 · CORREGIDO / VERIFICADO EN EL EMISOR AISLADO

`src/server/push/push.test.ts:280-359`: la matriz de status incluye `[200,201]`, `[404,410]` y `[300,302,399,429,500,503]`. Para todos los 3xx exige `sentCount=0`, `failedCount=1`, `deletedSubscriptions=[]`, cero llamadas a `deleteSubscriptionByEndpoint`, y el intento `sent` exacto con status recibido.

- **Autor, bitácora:** 55/55 GREEN, mutación temporal `status < 300` → `status < 400`: **3 fail / 52 pass** (300,302,399; sentCount), restaurado 55/55.
- **Revisor, comprobación propia en Node 22:** compiló y ejecutó la función `sendPushNotification` auténtica; controles para 200,201,300,302,399,404,410,429,500,503. Baseline GREEN, mutación en memoria `status < 400` → RED **exactamente en 300/302/399**, restauración GREEN.
- **Límite:** el `PushDatabaseClient` y `PushTransport` son dobles controlados para aislar contadores/no-borrado, no red ni DB real; no se repitió la mutación del autor en la suite Vitest local.

**Integridad de fuente del ensayo independiente:** hashes FNV-1a de fragmentos textualmente idénticos al SHA publicado: `sender.ts` desde `PUSH_BATCH_SIZE` hasta antes de `safeNotifyPostTransition` = `fe533666` (2945 caracteres); `route.ts` desde `POST` = `f2f06254` (1174 caracteres). El harness falla cerrado si no coinciden. Se ejecutó contra copias locales **idénticas** de esos fragmentos, no contra un clon. El script completo reproducible desde el repo está en [evidencia/comandos.md](../evidencia/comandos.md).

## D01-A · fe de erratas de atribución

El informe anterior dijo **«elección expresa de Lautaro073»**, lo que se corrige aquí por información posterior del agente: **el agente seleccionó en automático la opción A recomendada, amparándose en una autorización permanente declarada de Lautaro073; no fue una elección expresa en esa sesión.** D01-A permanece **aceptada**, sin reabrir la decisión ni atribuir al humano una acción que no realizó directamente. No se edita `ronda-1.md` para preservar el histórico; se actualizan README, `hallazgos.jsonl` y esta fe de erratas.

## CI del SHA auditado: atención, el build no pasó

**Run [43172625497](https://github.com/cadeApp/cadeApp/actions/runs/43172625497), SHA `69fdfd85`:**

| Job | Resultado verificado |
|---|---|
| unit | **SUCCESS** · **204/204 archivos; 3864/3864 tests** (líneas reales de Vitest) |
| typecheck / lint / audit | **SUCCESS** |
| db-tests | **SUCCESS** · **46 archivos / 3858 pgTAP, Result PASS**, `cc049` ok, preservación CC-049 GREEN, `git diff --exit-code -- src/types/database.types.ts` sin drift |
| build | **FAILURE** · `src/app/layout.tsx`, `next/font` Montserrat, `TypeError: Cannot read properties of null (reading '1')` en `@next/font/dist/google/loader.js:122:78` |
| bundle-budget | SKIPPED porque no hubo build |
| approval-policy | SUCCESS, run [43172625367](https://github.com/cadeApp/cadeApp/actions/runs/43172625367) |

El error de `next/font` es **real en este run**; la causa raíz precisa (servicio de fuentes, caché o regresión de build) **no está demostrada**. `src/app/layout.tsx` y dependencias no cambiaron en el diff `494e718c..69fdfd85`. El run verde anterior del código `c26f7673` sí construyó; por ello **no se acusa a H01/H02 de romper el build**. No editar `layout.tsx` fuera de alcance para «hacer pasar». **Gate pendiente: confirmar build GREEN en un run posterior, y bundle-budget.** Si vuelve a fallar igual en un runner limpio, diagnosticar como problema separado y autorizar alcance antes de modificarlo.

## Resto, decisiones y conclusión

- Sin hallazgos funcionales nuevos en este diff acotado. E01–E19, RLS/grants, primera aplicación y plazo absoluto siguen sin modificaciones desde el código verde original, y db-tests vuelve a confirmar SQL.
- **No se ejecutó:** pnpm/Vitest sobre clon, E2E preview, PostgreSQL local, `git merge-tree`. El ensayo propio usó Node + TypeScript en aislamiento con doubles explícitos, **no debe rotularse «Vitest mutado de revisión»**.
- D01-A: sin decisión abierta. No se requieren cambios de código de T-432 por H01/H02. 
- **Estado de entrega:** **H01/H02 cerrados en las propiedades auditadas; PR bloqueada operativamente por `build` fallido hasta nuevo run exitoso.** No se aprueba/mergea. Si el nuevo CI disparado por este commit de revisión falla igual, corresponde acción humana para reejecutar build o abrir investigación separada; sin forzar un cambio fuera de whitelist.
