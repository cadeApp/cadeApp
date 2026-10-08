# PR #308 · T-350 — Revisión independiente, ronda 2

**Fecha:** 2026-10-08. **HEAD autor revisado:** `6728cadcf84a526a20f9e486fcb0c25e7775165f`. **Base develop:** `d2ad3315ae9403194a35726b25f84996110a9216`.

**DICTAMEN: SIN BLOQUEANTES.**

## H01 (alto, ronda 1): ARREGLADO Y VERIFICADO

El único defecto de ronda 1 era la pérdida de dos sesiones históricas en `docs/tasks/log/T-350.md`. Inspeccioné el archivo completo desde `develop`, la versión anterior a la reparación y el HEAD `6728cadcf84a526a20f9e486fcb0c25e7775165f`:

- La versión original de `develop` se conserva **íntegra, byte por byte, como prefijo** de la versión final, incluidos los bloques «alta de tarea» y «ronda 1 de revisión de la ficha: PR305-H01, H02 y H03», **en el mismo orden y exactamente una vez**.
- Las cinco sesiones de implementación/RED-GREEN preexistentes en `445e44e4cc7be4a36f6d5143e8aab3fa33aab54f` se conservan **idénticas**. Solo se agregó al final la sesión «corrección de PR308-H01» y sus resultados.
- Verificador independiente en memoria sobre contenido de GitHub: baseline `develop` PASS; versión anterior RED; HEAD corregido PASS; mutante de omisión de «alta» RED y de omisión de «ronda 1» RED. Las expectativas del control nunca cambiaron. No se reescribió código de producto ni se creó un test que pase por diseño.
- La rama incorporó `origin/develop` mediante merge tradicional `1a3352b783ffd73c53871886ce39eeaf871f71dc` con los cambios de T-314 (#298) y ficha T-351 (#306). `compare develop...rama` informa `behind_by=0`; GitHub declara `mergeable=true`.
- Los cinco blobs de código y pruebas de T-350 y su ficha son **idénticos** a ronda 1. La comparación neta contra develop no introduce otros cambios fuera de los 7 archivos permitidos y `docs/revision-pr/pr-308/**`. Los históricos ajenos entraron por el merge, pero no son parte del diff neto.

**H01 pasa a `arreglado-verificado` en `6728cadcf84a526a20f9e486fcb0c25e7775165f`; abiertos: 0.**

## E2E de T-350 y límites de la evidencia

Se mantienen los logs de la PR aislada #307, cerrada sin merge: runs `37752295736` y `37757764311`, con GREEN R07, C06 y `DoD: axe AA en viaje` de T-309; run `37755123346`, con RED real de rol C06 y fallback de Google Maps. El código que esos E2E auditaron sigue siendo byte por byte el código de esta PR. Ningún test E2E temporal ni dependencia axe se llevó a #308.

**El E2E trusted del SHA actual** corrió en run `37805675854` (GitHub status `e2e-preview=success`). Los logs detallan **49/49 Chromium PASS** y `global-settings` con **2 PASS + 1 flaky** (la prueba `DoD 2: Con el piloto encendido la solicitud sí se publica` falló inicialmente por `page.waitForURL`, pero pasó en retry). No se falseó ese primer fallo: el job terminó success según la política existente. Este E2E actual **no incluye el spec axe T-309 ni los dos temporales de #307**, por diseño; el GREEN axe se basa en #307, no en el run actual.

## Checks del SHA revisado `6728cadcf84a526a20f9e486fcb0c25e7775165f`

| Check | Resultado visto en GitHub |
|---|---|
| unit | **success** — 123/123 archivos Vitest, 1945/1945 tests, workflows 75/75, ADR 6/6 |
| db-tests | **success** — 1854 PASS + 10 PASS |
| typecheck / lint / build / audit / bundle-budget | **success** |
| Vercel | **success**, deployment del HEAD completado |
| e2e-preview | **success**, con el flaky documentado arriba |
| approval-policy | **failure inicial**: aún falta informe SIN BLOQUEANTES en body; publicar tras este commit |

El agente declaró en la bitácora un `pnpm test` local **exit 1** en Windows por timeout del `beforeAll` de `cc007.test.ts`; dicho archivo aislado le dio 13/13, y la suite completa **CI del HEAD revisado** confirmó 1945/1945. No se presenta la ejecución local fallida como verde.

No corrí `pnpm` o Playwright desde un clone local. La revisión usa comparación exacta de archivos e invariantes JS, consultas GitHub REST y logs auténticos de Actions.

## Nota de entorno Production

Lautaro073 compartió una captura de Vercel donde `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` aparece asignada a **All Environments**: Production, Preview y Development. Eso acredita el ámbito de la variable en la configuración, **no** que un deployment anterior de Production ya haya incorporado el valor ni que se haya probado el mapa en Production. El smoke test de mapa real en Production queda como seguimiento operativo del responsable del despliegue; no introduce cambio de código ni nuevo bloqueo de esta PR.

**Resultado final: SIN BLOQUEANTES.** No hay decisiones técnicas pendientes de T-350 ni cambios que solicitar a agy. `approval-policy` debe reevaluarse cuando se agregue el informe al cuerpo de la PR. Esperar los checks requeridos del **nuevo commit de revisión** antes de mergear. No aprobar ni mergear desde la revisión.
