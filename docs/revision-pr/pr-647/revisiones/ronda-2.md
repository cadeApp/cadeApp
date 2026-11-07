# Informe de revisión — PR #647 / T-406, ronda 2

**SHA revisado:** `4fce771d774ccf5837992e228d46f6de4322f6f1`  
**Base develop exacta:** `4ae5404ee14651d00ad0c9286f250ba6c5441c49`  
**Fecha:** 2026-11-06 · **Autor PR:** Lautaro073 · **Revisor:** revisión independiente vía lectura GitHub + logs trusted CI.

## Resultado

**SIN BLOQUEANTES DE IMPLEMENTACIÓN DE T-406. NO APTO PARA MERGE AÚN**: la ficha exige E2E completo verde y el gate de este SHA sigue rojo por dos pruebas de otros módulos. No se hace excepción de gate ni se mergea.

| Revisión | Resultado | Evidencia |
|---|---|---|
| H01: doble TOTP en E2E | **ARREGLADO / VERIFICADO** | `incidents.spec.ts:27-63` enrola una sola vez y retorna `{adminPage,adminApi}` AAL2; T-406: `:372` pasa en gate trusted 42303370007 |
| D01=C, contador periódico | **IMPLEMENTADA, comprobación estática + unit CI** | `src/app/api/live/open-incidents/route.ts:16-29`; `src/app/(admin)/admin-nav.tsx:47-83`, `:169-185`; T-406 E2E navega y ve el badge |
| H02: `approval-policy` rojo por body incompleto | **ARREGLADO / VERIFICADO** | run 42302305442 falló; body actualizado con informe obligatorio y run 42309455413 pasó |
| Gate completo | **ROJO; bloqueo externo de integración** | 2 failed / 1 flaky / 120 passed, run 42303370007; issues #636, #653 y #585 |

## H01 — confirmado el arreglo

Antes el nuevo caso T-406 llamaba `elevateAdminToAal2` y luego `openAdminPageWithMfa`, produciendo dos enrolamientos. Ahora el helper `e2e/specs/incidents.spec.ts:27-63` enrola y verifica un factor, retiene `totpSecret`, genera un segundo código temporal desde **el mismo secreto** para el formulario real y retorna el mismo cliente `adminApi` elevado; en `:407-416` el escenario usa `adminApi.rpc('admin_resolve_incident')`, sin otra llamada a elevar. La función conserva el login real del navegador con MFA. En el gate trusted del SHA exacto, los cuatro casos T-308 y el nuevo T-406 pasaron. **Verificación por inspección independiente y ejecución externa oficial; no se corrió Playwright local.**

**Evidencia RED previa:** el gate anterior de `abf3f638` documentado en la bitácora falló por intentar enrolar dos TOTP; esta sesión no volvió a crear ni ejecutar la mutación en staging. Se verificó el comportamiento corregido mediante el E2E oficial. Clasificación H01: `arreglado-verificado`, SHA `4fce771d`.

## D01=C — autorizada e implementada

1. `AdminLayout` lee `getOpenIncidentsCount()` con el operador y la cookie de la barra y pasa `initialOpenIncidents` a `AdminNav`; conservar el valor inicial cumple la decisión.
2. `GET /api/live/open-incidents` exige `getServerSession()` real, responde 401 sin sesión, 403 si rol != admin o AAL != aal2, 500 genérico si el count es null, y 200 con **solo** `{count}`; todos con `Cache-Control: no-store`. El contrato `liveOpenIncidentsResponseSchema` usa `.strict()` y `count` entero no negativo. No usa service role.
3. `getOpenIncidentsCount` hace conteo exacto `head:true` con el **mismo** `INCIDENT_TAB_STATUSES['open']` (`open`,`reviewing`) que la bandeja; cero trae cero, fallo conserva null.
4. `AdminNav` usa `useQuery`, query key estable, initialData incluso con cero, staleTime/refetchInterval 60_000 ms, `refetchIntervalInBackground:false`, `refetchOnWindowFocus:'always'`, `refetchOnReconnect:'always'`, retry false y excepción en fetch sin convertir error a cero. Solo existe en layout admin, por lo que se detiene al desmontarlo.
5. El badge es hermano del link en el mismo `<li>`, con `role='img'` + `aria-label`, y el link mantiene el nombre «Incidentes» para desktop y menú móvil. Corrige la regresión detectada por el gate previo. El E2E nuevo y `admin-nav-mobile` pasan en el actual.

**Pruebas y limitación:** `route.test.ts` verifica cinco variantes negativas/positivas más sin leer datos sin autorización; `admin-nav.test.tsx` comprueba key/opciones/fetch inicial/badge y contrato. La bitácora presenta mutaciones RED reales y GREEN (AAL2: 1 failed/5 passed; background y focus: 1 failed/36 passed; filtro solo open: 4 failed), **no reproducidas por este revisor**. Las pruebas de polling/visibilidad verifican las *opciones de TanStack Query*, no ticks de temporizador real: mejora M01 recomendada sin bloquear, dado que el código usa la semántica pública correcta y el patrón ya implementado en `use-online-couriers`.

## H02 — el cuerpo PR fallaba `approval-policy`, resuelto sin tocar el código

El SHA `4fce771d` recibió check `approval-policy: failure` (run 42302305442), mensaje `Falta el informe completo de revisar-pr sin bloqueantes.` El body tenía datos antiguos (conteo solo al montar y unit 197/3725) y carecía de la sección `### Informe de revisión de agy` exigida por `.github/workflows/approval-policy.mjs`. El revisor actualizó el body (sin commit ni cambios en archivos de implementación), especificando `SIN BLOQUEANTES de implementación` y **que el gate E2E externo sigue rojo**. El mismo SHA recibió nueva corrida [42309455413](https://github.com/cadeApp/cadeApp/actions/runs/42309455413) `success`. No relajar el workflow.

## Los dos rojos ajenos: atribución y decisión de merge

**T-407 / auditoría:** `e2e/specs/admin-audit-filters.spec.ts:69`, falla en `:108` con `strict mode violation` porque `getByText('Mostrando los eventos de una sola entidad.')` resuelve a dos párrafos. El log confirma tres fallos. Su blob es **idéntico** en `develop` y en la PR (`98402507ea8a1c92d9559f562538d9003f25a77f`); ni test ni feature Auditoría se modifican en T-406. Es **regresión preexistente de test o de DOM**, no demostración de fallo funcional de T-406. Issue [#636](https://github.com/cadeApp/cadeApp/issues/636) ya existía cerrado; reabierto con este gate. Reparar con locator semántico acotado a la región, *solo tras inspeccionar el DOM/trace real*, preservando filtros por entidad y las filas excluidas; no usar `.first()` a ciegas.

**T-419/T-356 / licencia:** `e2e/specs/courier-onboarding.spec.ts:1056`, falla en `:1177` esperando `Rechazado / requiere corrección` en **3/3**. El test sí ejecuta `admin_verify_document` y recibe `rejected`; su fixture inserta una `license` sin `vehicle_id`. CC-042/T-419 pasó a documentos vehiculares vinculados al vehículo activo: **hipótesis causal razonable, aún no comprobada** de que el perfil excluye documento huérfano. Mismo blob exacto en base y PR (`b5661e89b37db59ff7447fb7fd8c55dab27b53a1`); PR #647 no toca perfil ni fixture. Issue nuevo [#653](https://github.com/cadeApp/cadeApp/issues/653). Diagnosticar consulta de perfil, seed y vehículo activo antes de tocar expectativas; reparar en PR propia, preservar seguridad del motivo y flujo de reemplazo.

**Flaky aparte:** `admin-trips.spec.ts:167`, pasa tras retries; issue ya abierto [#585](https://github.com/cadeApp/cadeApp/issues/585). Registrar y corregir, no confundir con dos fallos persistentes.

**Decisión de integración:** resolver #636 y #653 fuera de la rama T-406, integrarlos en develop, merge normal de develop a la rama #647, y verificar **E2E completo verde** en el SHA de código resultante, no solo `--grep T-406`. No quitar checks, aislar specs para eludir gate ni subir retries. Sin esa condición no corresponde merge aunque la implementación de T-406 esté limpia. Esta no es una solicitud para que el agy de T-406 edite las specs ajenas.

## Alcance y evidencias CI

- Ficha ampliada en esta PR exclusivamente con rutas de `open-incidents`, contrato y `ADMIN_COPY`, y plan/bitácora; el diff PR vs develop contiene **26 rutas**, todas dentro de `docs/tasks/T-406.md` (incluida carpeta de revisión). El merge commit incluye cambios de develop T-419/T-426/T-427, pero no son parte del delta contra base vigente. Head `4fce771d` tiene develop `4ae5404` como segundo padre, sin atraso según GitHub; mergeable true. `git merge-tree` local **no ejecutado**.
- CI general 42302308824 asociado explícitamente a `4fce771d`: siete jobs success; `unit` 198 files / 3735 tests; `db-tests` success incluyendo RED/GREEN temporales de mutaciones SQL restauradas. El job `lint` pasó ESLint, pero `format:check` avisó de 344 archivos del repo y no fue gate bloqueante; no atribuir ese warning a T-406 sin diff.
- Gate trusted E2E 42303370007 se lanzó por `workflow_run` sobre develop, **pero el step checkout usa `ref: 4fce771d...` explícito**, y corrió 123 tests. Resultado 120 passed, 1 flaky, 2 failed; T-406 passed `incidents.spec.ts:372` y T-308 passed. El contexto de commit `e2e-preview` es `failure`.
- No se usó clon local, Supabase remoto directo, Docker, Vercel ni secrets. Lectura de código, diff, logs trusted, y pruebas estáticas adversariales del revisor ejecutadas en memoria sobre fuentes GitHub; no confundirlas con mutaciones runtime.

## Qué sigue

1. QA independiente resuelve #636 y #653, aporta pruebas RED→GREEN sin adulteraciones y fusiona a develop con revisión propia.
2. #647 trae develop con merge, revalida CI+gate completo con nuevo SHA; confirmar que los cinco E2E de incidentes, contador, badge y MFA siguen pasando.
3. Lautaro073 decide y realiza merge una vez verde y la PR deje de ser Draft. No hay decisión 🔵 nueva: la D01=C fue elegida por él en la ronda 1.

Ver [evidencia/comandos.md](../evidencia/comandos.md) y [hallazgos.jsonl](../hallazgos.jsonl). No se borró ni reescribió la ronda 1.
