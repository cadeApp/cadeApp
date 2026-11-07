# Informe de revisión — PR #647 / T-406 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/647  
**Head SHA revisado:** `abf3f63873f4c8a9a1288d604735c7689708b0de`  
**Base:** `develop` @ `1fc95aa57da2f8c68a1be68e3f0322a4acc0e948`  
**Fecha:** 2026-11-06 · **Revisión independiente** (no autorrevisión del agy).

## Resultado

**CON BLOQUEANTES (1): H01.** **D01: decisión tomada por Lautaro073, opción C.** No se aprueba ni mergea.

| ID | Prioridad | Ubicación | Diagnóstico | Evidencia |
|---|---|---|---|---|
| H01 | BLOQUEANTE · alto | `e2e/specs/incidents.spec.ts:403-413` y `26-58` | El E2E ya enroló un TOTP para la RPC y enrola otro en el login; el formulario de login valida contra `factors.totp[0]` | Inspección de código a SHA |
| D01 | DECISIÓN · resuelta C | `src/app/(admin)/layout.tsx:14-19` y `admin-nav.tsx` | El conteo inicial del layout no se refresca de manera autónoma durante la sesión | Decisión explícita de Lautaro073 el 2026-11-06; implementación pendiente |

## H01 · Bloqueante: segundo factor TOTP invalida la prueba E2E de la bandeja

**Diagnóstico.** En el nuevo escenario T-406 (líneas 403–413) se crea `adminApi`, se invoca `elevateAdminToAal2(adminApi, adminCredentials)` y después `openAdminPageWithMfa(page, adminCredentials)`. El primero enrola y verifica un factor TOTP (ver `src/server/e2e/staging-seed.ts`, `elevateAdminToAal2`), y el segundo vuelve a ejecutar `adminClient.auth.mfa.enroll` y `challengeAndVerify` (líneas 26–42). La acción de producción `verifyAdminMfaAction` toma `factors.totp?.[0]` (`src/features/admin/actions.ts:128-155`) y verifica **ese factor**, no necesariamente el segundo para el que el E2E genera el código. Puede fallar el login MFA antes de comprobar el DoD; si la plataforma rechaza el segundo enrolamiento, falla aún antes. El E2E anterior, que solo llamaba una vez al helper, no tiene este problema.

**Evidencia: [ANÁLISIS].** Comparación directa de tres funciones reales en el SHA indicado, no prueba de navegador ejecutada. No se dispone aquí de clon ejecutable ni se ejecutó Supabase/Playwright; **no se reclama RED ni GREEN independiente**. La bitácora del autor dice que el E2E aún esperaba el gate; ese gate no se acreditó en esta ronda. En `evidencia/comandos.md` se documentan comprobación estructural y mutación propuesta.

**Arreglo preciso.** En `e2e/specs/incidents.spec.ts`, aislar un helper de enrolamiento/verificación que devuelva `{ factorId, totpSecret }` y acepte un cliente autenticado. Cambiar `openAdminPageWithMfa` para recibir opcionalmente ese factor previamente verificado: si existe, **no** invocar `mfa.enroll`, generar el TOTP desde `totpSecret` y completar el login de navegador con ese código; si no existe, seguir haciendo exactamente **un** enrolamiento para el DoD 1 antiguo. En el escenario T-406, enrolar/verificar el factor en `adminApi`, usar esa sesión AAL2 para `admin_resolve_incident` y pasar el mismo `factorId` y `totpSecret` al login. Evitar grabar o imprimir el secreto.

**Pruebas obligatorias.** Demostrar que el escenario T-406 usa un único factor TOTP y que la sesión del navegador llega a AAL2 por el formulario real. Reafirmar las tres pestañas, contadores y transición. Mutación RED independiente: reintroducir temporalmente el segundo `mfa.enroll` en el camino con factor ya provisto; la aserción de un solo factor o el E2E debe fallar. Restaurar en memoria / sin commit la mutación y documentar las líneas resumen reales; no fabricar fallas con mocks que eviten el camino real.

## D01 · DECISIÓN de Lautaro073 = C, cerrada a nivel de diseño

**Texto de decisión (2026-11-06):** «contador periódico: solo el número de abiertos cada 60 s mientras el panel está visible y al recuperar el foco, sin Realtime; el layout sigue dando el valor inicial». Lautaro073 autorizó ampliar la ficha **en esta misma PR** para la ruta `/api/live`, un hook TanStack Query y los archivos indispensables, y registrar la ampliación en ficha, bitácora y PR. No hace falta volver a preguntarle ni tratarlo como propuesta pendiente.

**Hecho revisado.** `AdminLayout` lee el total al render y se lo pasa a `AdminNav`. El valor no tiene un mecanismo de actualización autónomo; un nuevo reporte mientras el administrador permanece en otra vista no dispara lectura del layout. El detalle usa `router.refresh()` cuando se resuelve desde la interfaz, pero eso no cubre incidentes ajenos.

**Implementación autorizada (no verificada todavía).** Mantener el conteo inicial de servidor y agregar un punto de lectura autenticado con `getServerSession()` (`role === 'admin'` y `aal === 'aal2'`), sin service role y con `Cache-Control: no-store`. Devolver solo `{ count: number }` con validación de respuesta; nunca 0 fingido en errores. El hook cliente debe usar `useQuery`, `initialData` del layout, `refetchInterval: 60_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`; pausar las consultas cuando `document.visibilityState !== 'visible'` y reiniciarlas al volver. Reutilizar el patrón `src/features/requests/hooks/use-online-couriers.ts` (T-415), sin Realtime. Mostrar/ocultar correctamente los badges en sidebar expandida, colapsada y Sheet móvil, y que el fallo transitorio no se represente como cero.

**Pruebas necesarias.** Endpoint: sin sesión 401, no admin 403, admin AAL1 403, admin AAL2 devuelve solo conteo y no-cache, error 500 sin filtrar detalles. Hook: usa initialData sin fetch inmediato innecesario, cuenta cada 60 s visible, no consulta oculto, refetch al volver al foco, 0 oculta el badge, lectura fallida mantiene estado/fallback definido. UI: número y texto accesible, panel expandido, colapsado y móvil. Mutaciones RED: quitar autorización AAL2; desactivar pausa al ocultar; desactivar refetch al foco; sustituir el filtro `['open','reviewing']` por `['open']`. Cada mutación debe activar su prueba específica.

**Control de alcance.** La ficha en `origin/develop` no autorizaba originalmente los archivos nuevos: la decisión expresa permite modificar `docs/tasks/T-406.md` en la rama para incorporar **solamente** las rutas del endpoint/hook/tests necesarios. Comparar la ficha nueva contra `origin/develop`, sin declarar ampliación implementada hasta que exista en el commit del autor. Si se exige modificar `src/ui/**`, contratos de dominio o migraciones, corresponde CC: no está autorizado por esta decisión.

## Correcto en la implementación revisada / no tocar

- Tres estados de pestaña con filtros separados: `open+reviewing`, `resolved`, `dismissed`.
- `?tab=closed` redirige a `resolved` descartando el cursor previo.
- Conteos de pestañas con `head: true` y `count: 'exact'`, filtro compartido con la bandeja; errores no se convierten en cero.
- Advertencia visual usa `badge-warning` existente, sin introducir tokens de UI ni CC.
- No hay cambios fuera de la lista permitida del **SHA original**; en ese SHA la ficha aún no había sido ampliada.

## Checks y límites de evidencia

| Control | Resultado conocido | Alcance |
|---|---|---|
| Fuente de ficha `develop` | leído | Mapea DoD y archivos permitidos del SHA original |
| Cambios y comentarios PR | leídos | 15 archivos, +523/-79; sin comentarios de revisión humana previos |
| `typecheck`, `lint`, `unit`, `build`, `bundle-budget`, `audit`, `db-tests` | CI de `abf3f638` terminó `success` | No sustituye ejecutar el E2E nuevo ni demostrar mutación H01 |
| `e2e-preview` | no acreditado en esta ronda | Necesario para el nuevo escenario MFA y el DoD |
| Mutaciones independientes / pruebas RED del autor | no reproducidas | La afirmación de bitácora no equivale a verificación del revisor |
| Merge-tree exacto | no ejecutado localmente | GitHub indicaba `mergeable: true`; no equivalente a `git merge-tree` |

La lectura GitHub se realizó sobre la rama remota. No hubo clon local ni tests propios; por eso ningún hallazgo se marca `verificado-runtime` o `arreglado-verificado`.

**Próxima ronda:** verificar el nuevo SHA tras el arreglo y la ampliación de ficha, repetir la batería propia y cruzar CI/E2E con el head exacto. No exigir otro CI GREEN únicamente por un commit documental de revisión/bitácora.
