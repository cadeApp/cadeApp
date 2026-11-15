# Informe de revisión independiente — PR #708 / T-433 — Ronda 1

**Fecha:** 2026-11-12  
**PR:** https://github.com/cadeApp/cadeApp/pull/708  
**Head SHA revisado:** `e61a9e318208cf3385f80f4eadb8af95c304799e`  
**Código de implementación:** `d0096c1df7c2d27225c4cb901675cdfefadad1d3`  
**Base:** `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1`  
**Resultado:** **CON BLOQUEANTES (1)**; no aprobar ni mergear.  
**Tipo de verificación:** inspección del código publicado vía GitHub + experimento aislado del predicado de autenticación con Node. **Sin ejecución independiente de Vitest ni mutaciones dentro del repositorio**: el entorno no dispone de clon, pnpm ni acceso directo Git; NO atribuirse la evidencia RED del autor.

## Secuencia y alcance

- Ficha T-433 leída en `develop@dba3314f`, mergeada por #707. La PR no la modifica. Los siete archivos cambiados son permitidos por la ficha.
- `e1887fcf` cambia solo pruebas (RED declarado por el autor: 8 failed, 105 passed / 113); `d0096c1d` agrega el cambio productivo (GREEN declarado: 121/121 en suites selectivas); `e61a9e31` solo agrega `docs/tasks/log/T-433.md`.
- El diff del PR contra la base muestra 7 archivos y ninguna modificación a contratos, DB, workflows ni paquetes. GitHub declara `mergeable: true`; no se pudo ejecutar `git merge-tree` local.
- Comentarios de PR leídos (solo bot Vercel); #666 consultado (sin constancia de D3-A a la fecha de revisión); carpeta `pr-708/` inexistente antes de crear este informe.
- Se enumeraron los tres consumidores del Bearer afectados por el diseño: `src/app/api/push/send/route.ts`, `src/app/api/cron/health/route.ts`, `src/app/api/cron/sweep/route.ts`, y sus tests. Los cron handlers siguen usando `CRON_SECRET`, sin cambio productivo.

## Resumen

| ID | Tipo | Severidad | Ruta | Diagnóstico |
|---|---|---|---|---|
| PR708-H01 | BLOQUEANTE · test-coverage | alto | `src/app/api/push/send/route.test.ts:9-10, 36-48, 86-97` | Ningún negativo presenta un secreto erróneo de la misma longitud: el guard de longitud basta para pasar las pruebas aunque se suprima la comparación de contenido |

## H01 — Los negativos autorizan un control de solo longitud

**Diagnóstico [ANÁLISIS + experimento aislado; NO Vitest]:** Los fixtures en `route.test.ts` son `CRON_SECRET='test-cron-secret-0123456789abcdef'` (33 caracteres) y `PUSH_SEND_SECRET='test-push-send-secret-0123456789ab'` (34). Los casos negativos usan CRON (33), `token-invalido` (14, sin Bearer) o falta de variable; la comparación `authHeaderBuf.length !== expectedAuthBuf.length` rechaza cada uno antes de `crypto.timingSafeEqual`. En el caso positivo el token es idéntico. Por lo tanto, la prueba no demuestra que se compare el **valor** de credenciales distintas de igual longitud.

**Mutación independiente propuesta:** en `src/app/api/push/send/route.ts`, reemplazar **temporalmente** la expresión `!crypto.timingSafeEqual(authHeaderBuf, expectedAuthBuf)` por `false`, preservando el guard de longitud. La matriz de los tests actuales sugiere que la suite de la ruta seguiría verde pese a aceptar cualquier token de longitud igual. Esta predicción **no fue ejecutada con Vitest**. El arnés íntegro y auto-restaurable está en [evidencia/comandos.md](../evidencia/comandos.md).

**Comprobación aislada realizada con Node (replica exactamente el predicado, no ejecuta el Route Handler):**

| Header | Longitud con Bearer | Predicado actual | Predicado mutado |
|---|---:|---:|---:|
| `Bearer <CRON_SECRET>` | 40 | 401 | 401 |
| `Bearer token-invalido` | 21 | 401 | 401 |
| Credencial incorrecta de longitud igual | 41 | 401 | **200** |
| `Bearer <PUSH_SEND_SECRET>` | 41 | 200 | 200 |

**Por qué pasó los checks:** todos los tests usan una longitud distinta en los rechazos; `toBe(401)` no distingue una comparación real de un filtro por longitud. Relacionado con `P08-control-no-cubre-lo-que-dice`.

**Arreglo exacto:** modificar SOLO `src/app/api/push/send/route.test.ts` (más bitácora):
1. Hacer que el fixture `CRON_SECRET` mida **34** caracteres, por ejemplo `test-cron-secret-0123456789abcdefX`; mantenerlo distinto del `PUSH_SEND_SECRET` de 34 caracteres. De este modo el caso obligatorio del bypass sí exige igualdad de contenido.
2. Añadir un `it` que construya `const invalid = PUSH_SEND_SECRET.slice(0,-1) + 'X'`, compruebe `invalid !== PUSH_SEND_SECRET` y longitud igual en bytes, envíe `Authorization: Bearer ${invalid}`, y espere **401** y `sendPushNotification` sin invocaciones.
3. En un worktree limpio: control sin mutar GREEN, mutación anterior RED atribuible al caso correcto, restauración desde copia en memoria (no `git checkout`) y control GREEN. Registrar las líneas `Test Files` y `Tests` auténticas.
4. Conservar los tests de `Bearer undefined`, ausencia de la variable y CC-049. No tocar la implementación productiva para satisfacer tests.

## Lo correcto y lo que no hay que cambiar

- `serverEnvSchema`: `CRON_SECRET.min(32)`, `PUSH_SEND_SECRET.min(32).optional()`, y `refine` de desigualdad correctamente delimitados.
- La ruta push deja de leer `CRON_SECRET`; sin `PUSH_SEND_SECRET`, responde 401 antes de construir `Bearer`; compara buffers mediante `crypto.timingSafeEqual` después del control de longitud.
- Los tests de límites 31/32, secreto igual, configuración ausente, CC-049 y el fixture M10 están presentes. Los crons conservan su guard anterior. No modificar los dos crons ni extraer helper de seguridad: explícitamente fuera de alcance.
- D3-A es una condición operacional **externa**; no consultar, rotar ni imprimir secretos en el review. Ninguna decisión 🔵 nueva.

## Checks y limitaciones

| Control | Evidencia | Alcance |
|---|---|---|
| GitHub CI `unit` run [43180302035](https://github.com/cadeApp/cadeApp/actions/runs/43180302035), SHA exacto `e61a9e31` | 204/204 suites y **3871/3871 tests**, correcto en log real | GREEN compartido, no prueba ceguera de H01 |
| GitHub CI `typecheck`, `lint`, `build` | jobs SUCCESS | Mismo SHA `e61a9e31` |
| `db-tests` | EN CURSO al consultar; no atribuir GREEN | No se levantó DB local |
| RED `e1887fcf` | 8 failed / 105 passed según bitácora | **No reproducido independientemente** |
| Mutaciones locales declaradas (4) | 4 resultados documentados por el autor | **No reproducidas independientemente** |
| Mutación H01 | Predicado aislado: longitud igual errónea 200 con la comparación anulada | **No ejecutada en Vitest** |
| `pnpm typecheck/lint/test` local | No ejecutados (sin repositorio/clon ni pnpm disponibles) | No presentar como CI local |

El job `bundle-budget` terminó SUCCESS pero informó rutas de UI por encima de 180 kB; la ruta `/api/push/send` figura en **104 kB (OK)**. No se atribuye a esta PR el exceso de otras rutas. El formato Prettier advisory reporta deuda general del repositorio; tampoco es hallazgo de T-433.

## NO TOCAR — falsos positivos descartados

| Supuesto | Por qué no es defecto de la PR |
|---|---|
| `PUSH_SEND_SECRET` opcional | D1-A acordó fail-closed (401) cuando falta; sin callers internos actuales |
| `CRON_SECRET` mantiene autorización en los dos crons | Es intencional: solo la ruta push debe separarse |
| Mínimo de 32 caracteres no asegura aleatoriedad | D3-A exige generar con CSPRNG de 32 bytes; largo es un control diferente |
| Falta de constancia en #666 | Bloquea merge por D3-A, pero no implica defecto de implementación |
| Al publicarse esta revisión cambia el SHA del head | Es un commit exclusivamente documental; no exigir otro GREEN solo por esta bitácora/revisión |

## Próxima ronda

Corroborar H01 con el arnés del reviewer y el nuevo test; revisar nuevamente el código, el diff y la lista completa de auth; corroborar el gate D3-A solo por constancia sí/no en #666; no aprobar ni mergear automáticamente.
