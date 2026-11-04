# Informe de revisión — PR #584 / T-402 — ronda 4

**Fecha (GitHub UTC):** 2026-11-04  
**SHA exacto de código revisado:** `e15734e5ed48ad275083ff6d6224fe44d3465513`  
**Merge de develop:** `8ef49640645af3e51619e957e2fba0b42b5ea3b3`  
**Base de PR:** `develop` @ `ceec11ef70df929fbebfe2dabd6012c86466dc05`  
**Resultado:** **SIN BLOQUEANTES TÉCNICOS detectados en el código revisado**; **CI/E2E finales aún no completados** en la consulta hecha para este informe. No aprobar ni mergear hasta que los gates oficiales obligatorios estén en success.

## 1. Alcance, trazabilidad y riesgo de conflictos

- El HEAD real de GitHub coincide exactamente con el solicitado por Lautaro073: `e15734e5`, no un diff de trabajo no commiteado.
- Se comprobó con la API GitHub que `8ef49640` es un verdadero commit de merge (dos padres: `29c8a61b` y `ceec11ef`); no es rebase ni force-push. El commit siguiente `e15734e5` solo agrega la bitácora de integración.
- Base develop a `ceec11ef`; comparación de GitHub `develop…feat/T-402-admin-shell`: **10 ahead / 0 behind** y `mergeable=true` / `mergeable_state=unstable` (el estado «unstable» se debe a checks aún en curso/fallidos, no a conflicto de merge).
- T-401 introdujo cambios a `queries.ts`, `queries.test.ts` y `copy.ts`. El resultado del merge conservó sus componentes junto a T-402; el diff final contra develop solo enumera archivos de T-402 y las evidencias de su propia revisión.
- Se contrastó la ficha de develop con la ampliada; D01 (7 secciones, nueva query) y el almacenamiento de 15 capturas en repo fueron autorizados previamente por Lautaro073. No hay otros archivos funcionales añadidos fuera de permisos.
- **Límite:** no se ejecutó `git merge-tree --write-tree` local en este runtime porque no hay checkout/pnpm; el autor declara esa ejecución limpia. Independientemente, la API GitHub informa mergeable=true y la base es el padre del merge.

## 2. PR584-H03 — CERRADO / VERIFICADO, fusión de T-401 y T-402

**Estado estructurado:** `arreglado-verificado`, `verificado_en_sha=e15734e5ed48ad275083ff6d6224fe44d3465513`.

Se leyó el contenido completo de `src/features/admin/queries.ts`, `queries.test.ts`, `copy.ts`, la navegación y el nuevo spec. El único conflicto declarado del autor fue `queries.test.ts`. En el resultado:

- **T-401:** `getApplicantsQueue` y `getApplicantDetail` devuelven `hasDni: Boolean(c.dni_hmac)` sin propiedad `dniHash`; `ADMIN_COPY` usa `dniLoaded` / `dniPending`; `merchantDisplayName` y `signupIncomplete` marcan alta incompleta, también en `getAdminMerchantHeader`. Están presentes y no se debilitaron los tests de privacidad, nombre vacío y encabezado de créditos.
- **T-402:** `getAdminOperatorName` conserva `createClient` de sesión y `auth.getUser`, filtra `profiles.display_name` por `user.id` y normaliza/fallback; los tests verifican consulta y no-uso de service role, además de tres casos de fallback. `ADMIN_COPY.nav.menuButton/menuTitle` intactos; menu móvil/aside y E2E 390/1023/1024/1280 intactos.
- **La unión es congruente:** ambos imports `getAdminMerchantHeader` y `getAdminOperatorName` están en `queries.test.ts`, se mantienen ambas suites y no hay marcadores de conflicto.

**Prueba propia independiente en JS sobre la fuente recibida del SHA exacto:** 14/14 invariantes estructurales GREEN; 8/8 mutaciones **estáticas** que alteran los DTO, el fallback, la fuente de sesión o retiran tests disparan sus guardas RED. No son ocho tests Vitest ejecutados: el harness completo y la salida exacta están en `evidencia/comandos.md`.

## 3. CI oficial del SHA e15734e5

[Workflow CI #41754008650](https://github.com/cadeApp/cadeApp/actions/runs/41754008650), HEAD e15734e5:

| Job | Estado confirmado por log/job |
|---|---|
| typecheck | success |
| lint | success; ESLint sin errores. Prettier advisory reporta formato pendiente preexistente, no bloquea |
| unit | success; **189 archivos, 3467 tests passing** leídos del log del job `126326131930` |
| build | success |
| audit | success |
| bundle-budget | success; mantiene alertas advisory de First Load JS (p. ej. /admin/applicants 263 kB) |
| db-tests | **in_progress / pendiente** en la consulta realizada |

[Workflow e2e-preview #41754128185](https://github.com/cadeApp/cadeApp/actions/runs/41754128185) aparecía **pending**, con commit status `e2e-preview=pending` para e15734e5. El evento `repository_dispatch` puede mostrar el SHA de develop en el workflow; para acreditar éxito se debe comprobar **checkout dentro del job de e15734e5** y los dos casos nuevos. Hasta entonces, solo se conoce la evidencia E2E verde del anterior SHA `4a265745` y el autor declara un smoke local de 3 tests contra el Preview del merge `8ef49640`. **No se inventa un verde del gate final.**

`approval-policy` falló antes porque el cuerpo aún decía CON BLOQUEANTES; se actualiza el cuerpo de la PR con el resultado correcto **SIN BLOQUEANTES**, pero queda explícitamente **pendiente de gates**. No forzar el check manualmente.

## 4. Hallazgos históricos y mejoras

- **H01:** arreglado y verificado en `4a265745`, suite de E2E responsive y geometría. Se conservó en el merge.
- **H02:** arreglado y verificado en `c4eba54c`, 15 capturas PNG sintéticas inspeccionadas y autorizadas en el repo; se conservan.
- **H03:** arreglado y verificado en `e15734e5`, sin conflictos y ambas suites de T-401 y T-402 presentes.
- **D01:** opción A autorizada. Sin nuevas decisiones 🔵.
- **Mejora no bloqueante:** flaky de `admin-trips` del gate previo (T-410, no causado por T-402) tiene [QA #585](https://github.com/cadeApp/cadeApp/issues/585); no debilitar assertions ni hacer workaround en esta PR.
- **Bundle:** varias rutas exceden el presupuesto 180 kB pero el número ya existía en la base y no se probó regresión por T-402. Seguir en QA/performance separado, no inventar hallazgo nuevo.

## 5. Límites y política de cierre

**No hay cambios de código solicitados ni una decisión del usuario pendiente.** La ronda cierra la revisión técnica de H03 y deja el gate externo pendiente; no convierte «pending» en «success». El commit documental de esta ronda moverá el HEAD y puede disparar workflows. **No se exige repetir CI únicamente porque cambie documentación de revisión**; cotejar el último SHA **de código** e15734e5, y si hay un conflicto nuevo con develop volver a verificar mergeabilidad. No se aprueba ni se mergea esta PR desde la revisión.

**Condición manual de merge de Lautaro073:** al estar disponible CI y E2E, comprobar success real de db-tests y e2e-preview en el SHA de código, success de approval-policy y que la PR siga mergeable y sin nuevos commits funcionales. Si un gate falla por el código, detenerse y abrir nueva revisión; no alterar tests ni forzar checks.
