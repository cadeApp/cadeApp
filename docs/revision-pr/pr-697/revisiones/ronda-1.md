# Informe de revisión independiente — PR #697 · T-432 / CC-049

**Fecha:** 2026-11-12 · **SHA revisado:** `b9f0bb12f480ce2c95afa42fee6031021611be2b` · **Base:** `develop@9dafedab103cdfdd7eca0fa88cc38f2e319dc831`.

## Veredicto

**CON BLOQUEANTES (4), todos documentales.** No se aprueba ni mergea. D4-B y D5-C fueron decididas por Lautaro073 antes del cierre; no hay decisiones pendientes. Se requiere ajustar contrato, ficha, plan si cambia su DoD resumido, y bitácora; la implementación se revisa en otra PR después del merge documental.

### Hechos verificados por inspección

- `docs/contracts/CC-049.md`, `docs/tasks/T-432.md` y `docs/tasks/log/T-432.md` son archivos nuevos y `docs/implementation-plan.md` añade solo la fila T-432. La ficha no existía en develop; el alcance documental coincide con los cuatro archivos.
- En `develop@9dafedab` existe `push_subscriptions_all_self` como policy `FOR ALL` (`20260925170000_cc007_consent_enforcement.sql:311-315`). La RPC `register_push_subscription` valida `https` genérico (`20261020123000_cc035_register_push_subscription.sql`), sin allowlist. El emisor hace POST mediante `web-push` y conserva lotes de 10 (`src/server/push/sender.ts`).
- El body del PR y `docs/tasks/log/T-432.md` atribuyen al autor `pnpm exec vitest run tools` → 123/123, pero el revisor no pudo repetir esa suite. No se revisó CI con intención de aprobar porque hay bloqueantes.

## Resumen por prioridad

| ID | Tipo | Archivo:línea | Qué bloquea |
|---|---|---|---|
| PR697-H01 | BLOQUEANTE · alto | `docs/tasks/T-432.md:109-110` y `docs/contracts/CC-049.md:194-196` | Mutación del grant no hace fallar el bypass mientras la RLS lo deniega: falso rojo declarado |
| PR697-H02 | BLOQUEANTE · alto | `docs/contracts/CC-049.md:63-65` y `docs/tasks/T-432.md:79,95` | La prueba de volver a ejecutar el DELETE no controla la ejecución del borrado por la migración; contradice D5-C |
| PR697-H03 | BLOQUEANTE · alto | `docs/contracts/CC-049.md:75,139-140` y `docs/tasks/T-432.md:102-103` | `web-push.timeout` es inactividad de socket, no deadline absoluto de 5000 ms, contrario a D4-B |
| PR697-H04 | BLOQUEANTE · medio | `docs/contracts/CC-049.md:70-74` y `docs/tasks/T-432.md:99-101` | Se exige un intento sin endpoint pero `PushAttemptRecord.endpoint` es obligatorio |

## H01 — La mutación de grants no demuestra el bypass

**Diagnóstico [ANÁLISIS + CONTRAEJEMPLO LÓGICO].** La ficha pide `sin el revoke de insert/update → falla el bypass`, en `T-432.md:110`. Sin embargo, aun restableciendo INSERT y UPDATE, la ausencia de policy `FOR INSERT` o `FOR UPDATE` mantiene el bloqueo de RLS. Un test que solo intente la escritura seguirá verde. Es el mismo fenómeno documentado en `pr-63/AG-70`: una mutación que no puede alcanzar la aserción indicada no es un rojo válido.

**Evidencia:** `node /tmp/cc049-counterexamples.mjs` imprimió `H01: GREEN (bypass de escritura denegado incluso con grant restituido).`. El contraejemplo es una tabla de verdad de dos barreras, no ejecución de PostgreSQL; la confirmación final exige pgTAP real en CI.

**Arreglo:** especificar dos protecciones y dos mutaciones independientes: (a) `has_table_privilege('authenticated', ..., 'INSERT'/'UPDATE') = false`, que debe ponerse en rojo si se restaura el grant aunque la RLS siga cerrada; (b) bypass de INSERT y UPDATE con policies indebidamente permisivas **y** grants temporales en una transacción aislada, que debe ponerse rojo ante la apertura de RLS. Verificar estado real de filas, y distinguir ausencia de grant (42501) de RLS que filtra 0 filas o arroja error. Mantener caso `TRUNCATE` separado.

## H02 — El test de limpieza no valida la migración; D5-C cambia el plan

**Diagnóstico [ANÁLISIS + CONTRAEJEMPLO LÓGICO].** La ficha exige que un pgTAP vuelva a aplicar `DELETE ... WHERE NOT is_allowed_push_endpoint` para comprobar el resultado. Ese test puede pasar aun si la migración productiva nunca ejecutó ese DELETE. Además, el borrado automático de la misma migración (`CC-049.md:63-65`) es irreversible y entra en conflicto con la nueva decisión D5-C.

**Evidencia:** el arnés imprime `H02: GREEN del test de DELETE rehecho, aunque no haya limpieza en migración.`, únicamente como contraejemplo de cobertura, no prueba de datos reales.

**Arreglo elegido — D5-C:** la primera migración **no borra filas históricas**; quita INSERT/UPDATE, agrega el helper y la validación y preserva filas fuera de allowlist. El emisor las ignora sin enviarlas ni borrarlas (D2-A). Separar el saneamiento futuro en una segunda migración/PR después de un inventario **de solo lectura por conteos y servicios**, sin endpoint, claves, usuario ni datos en logs. Contar por ambiente, revisar servicios/hosts desconocidos y aprobar explícitamente los descartes antes de destruir. Sustituir los ítems de DoD, rollback y backfill que dicen que se borran; prohibir un test verde que ejecute él mismo la operación que debía haber ejecutado la migración. Para probar preservación **durante** la migración, presembrar un fixture en una base efímera *antes* de aplicarla; el pgTAP postmigración no demuestra ese histórico por sí solo.

## H03 — El valor timeout no asegura duración absoluta

**Diagnóstico [INSPECCIÓN DE DEPENDENCIA + DEMOSTRACIÓN LOCAL].** El contrato prescribe `sendNotification(..., { timeout:5000 })` y afirma que toda tanda queda temporalmente acotada. En `web-push@3.6.7`, `generateRequestDetails` copia `options.timeout` y `sendNotification` lo pasa como `httpsOptions.timeout`; destruye la petición solo en el evento `timeout` del request. Esto es un timeout por inactividad de socket, no un cronómetro total: una respuesta que siga enviando datos puede durar más de 5 s.

**Evidencia externa:** https://raw.githubusercontent.com/web-push-libs/web-push/v3.6.7/src/web-push-lib.js (líneas 205-207, 292-294, 329-330 y 341-379). El arnés aislado de Node ejecutó `http.request({timeout:110})` contra un servidor loopback que envió un byte cada 30 ms y completó tras ~559 ms sin disparar timeout. **No se ejecutó web-push ni una petición remota** en esa prueba.

**Arreglo elegido — D4-B:** contrato debe exigir un límite total de 5000 ms **y abortar físicamente la solicitud de red**, no solo dejar de esperarla. En `src/server/push/sender.ts`, reutilizar `webpush.generateRequestDetails` para VAPID/cifrado/TTL y hacer la petición real con `node:https.request`, temporizador absoluto iniciado al crear la solicitud y `request.destroy` al vencer. Mantener `POST`, headers/cuerpo, semántica HTTP, 404/410 y batches de 10. Prohibir seguir redirecciones (un 3xx no dispara otra URL). Limpiar timer en resolución y rechazo. No usar `Promise.race` que deje el socket vivo. Pruebas de stream goteando, conexión sin respuesta, 2xx, 404, 410, 3xx y timer limpiado. El timeout reporta fallo sin borrar.

## H04 — El shape del intento rechazado es inconsistente

**Diagnóstico [ANÁLISIS].** `CC-049.md:70-74` pide que un intento rechazado se registre `status:0`, `error:'ENDPOINT_NOT_ALLOWED'` y **sin endpoint**. Pero la fuente actual `src/server/push/sender.ts:130-134` declara `PushAttemptRecord { endpoint: string; status: number; error?: string }`, y `SendPushResult.attempts` usa ese tipo. El contrato no indica cómo mantener el tipo ni la respuesta API; un objeto sin `endpoint` no compila sin cambiarlo, y `endpoint:''` es un centinela implícito no contratado.

**Arreglo:** tipar explícitamente el resultado como unión de intento permitido (con `endpoint:string`) e intento bloqueado (`status:0, error:'ENDPOINT_NOT_ALLOWED'`, sin propiedad `endpoint`). Mantener el shape de los envíos permitidos y los códigos HTTP. En `src/server/push/push.test.ts` y en `src/app/api/push/send/route.test.ts` probar presencia/ausencia por clave (`Object.hasOwn`), no solo `toBeUndefined` ni una afirmación de texto. No almacenar ni devolver URL rechazada. Verificar lectores del resultado y compilar con `pnpm typecheck`.

## Decisiones cerradas

| Código | Decisión | Estado |
|---|---|---|
| D1-A | FCM, Mozilla, Apple y WNS | previa, conservada |
| D2-A | el emisor descarta sin borrar | previa, conservada |
| D3 | umbral 5000 ms | previo, conservado |
| D4-B | deadline total de 5000 ms con cancelación real | **Lautaro073, 2026-11-12** |
| D5-C | limpieza escalonada, sin DELETE inmediato | **Lautaro073, 2026-11-12** |

**Nuevas decisiones pendientes: ninguna.**

## Mejora no bloqueante M01

Ampliar la matriz de paridad entre `app_private.is_allowed_push_endpoint`, `src/domain/push-endpoint.ts`, schema, fake y transport con URLs de host en mayúsculas, `:443`, sufijo fraudulento, userinfo, puerto distinto, barra invertida, punto final, encodings, IPv6, subdominios WNS de 0/1/2 niveles y redirección HTTP. Debe usarse la misma **tabla explícita de resultados esperados**, no un test que calcule el esperado usando el propio helper. No afirmar cobertura de un caso sin ejecutar su mutación.

## NO TOCAR / falsos positivos descartados

- El trabajo de código/SQL **no falta en esta PR**: es intencionalmente documental, siguiendo T-409/T-430. No reportarlo como desvío.
- `D1-A`, `D2-A` y 5000 ms **no se reabren**; D4 define la semántica, D5 define la estrategia de limpieza.
- `CC-047` ya establece `push_subscriptions_select_admin`, que debe preservarse.
- El emisor ya hace lotes paralelos de 10: no pedir nueva concurrencia.
- No pedir cambios de `SEC-08`, credenciales, infra, Supabase remoto ni Vercel en esta ronda.

## Por qué los checks no alcanzan

| Instrumento | Qué consta | Qué NO valida |
|---|---|---|
| Vitest tools 123/123, según autor | chequeos generales de herramientas | deadline real, migración SQL ni forma de los intentos |
| `mergeable:true` de GitHub | sin conflicto anunciado | corrección de CC/DoD |
| arnés independiente de esta ronda | H01 y H02 son contraejemplos; H03 es semántica real de socket | pgTAP, flujo push de producción o build de T-432 |
| CI del SHA | **no inspeccionado en esta ronda con bloqueantes** | no puede citarse como evidencia de aprobación |

## Verificación final / próximo ciclo

1. Agy modifica solo `docs/contracts/CC-049.md`, `docs/tasks/T-432.md`, `docs/implementation-plan.md` (solo si cambia DoD resumido), `docs/tasks/log/T-432.md`; nunca esta carpeta.
2. Deja claramente especificados los cuatro arreglos, D4-B y D5-C; corrige contradicciones de rollback, D2, backfill y pruebas de limpieza.
3. Copia resultados reales de los checks; no fabrica rojo ni verde, no rebaja aserciones.
4. Commit y push a `feat/T-432-sec07-push-hardening`; pega `git ls-remote origin feat/T-432-sec07-push-hardening`. La ronda 2 verificará el nuevo SHA. En la PR posterior de implementación se exigirán RED→GREEN de verdad.

## Metodología y límites

Inspección independiente de diff, ficha desde `develop` (ausente al ser nueva), issue #665, bitácora, policy CC-007, RPC CC-035, CC-047 y emisor; inspección de `web-push@3.6.7` y tres contraejemplos aislados. Sin clon Git local: no se ejecutó `git merge-tree`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:db` ni CI. Ninguna prueba de PostgreSQL fue ejecutada; se entregan los comandos/controles propuestos sin atribuirles una corrida inexistente. `verificado_en_sha` permanece nulo para hallazgos abiertos.
