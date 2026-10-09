# Informe revisar-pr — PR #298 / T-314 — Ronda 5

**Fecha:** 2026-10-08  
**SHA HEAD revisado:** `8b063d80d796449e13ac4fe71edc10feb27b671c`  
**SHA de código E2E verificado en trusted Preview:** `10f0e4fe9c6614346408de1e4502844f796f92a6`  
**Resultado:** **SIN BLOQUEANTES**. No se aprobó ni se mergeó la PR.

## 1. Alcance, origen y coherencia de los SHA

Desde el commit documental de la Ronda 4 `09818a78`, el autor agregó 4 commits que modifican únicamente `e2e/specs/map-privacy.spec.ts` y `docs/tasks/log/T-314.md`. No se alteró la carpeta independiente `docs/revision-pr/pr-298/**`.

La verificación positiva corresponde al código de `10f0e4fe` (no debe confundirse con el `head_sha` del workflow trusted que corre en `develop` por `repository_dispatch`). Se verificó directamente el log de su job E2E: `git checkout --force 10f0e4fe9c6614346408de1e4502844f796f92a6`.

La comparación `10f0e4fe..8b063d80` muestra **solo 31 adiciones y 3 borrados de bitácora** `docs/tasks/log/T-314.md`. Por tanto, las dos confirmaciones posteriores no modificaron ni el spec E2E ni el código de la aplicación. Este nuevo informe es también un commit solo documental que moverá HEAD y disparará nuevos checks.

La comparación completa vs `develop` arroja 10 archivos, todos dentro del alcance de `docs/tasks/T-314.md` (spec, bitácora y revisiones independientes). La rama estaba siete commits detrás de `develop` al revisar; GitHub reportó `mergeable: true`. No se ejecutó merge en esta revisión.

## 2. Checks, con SHA explícito

| Check | Resultado |
|---|---|
| CI `37741240738` del code SHA `10f0e4fe` | PASS |
| Approval policy `37741296715` del SHA `10f0e4fe` | PASS |
| Trusted e2e-preview `37741363122` (job `113192659524`) | **PASS: 52/52** |
| Vitest + workflows + ADR, reportados en log local limpio por autor | 2004/2004 (no reproducido por revisor) |
| CI del HEAD `8b063d80`, run `37744645426` | En progreso al redactar |
| Trusted E2E del HEAD `8b063d80`, run `37744833708` | Pendiente al redactar |
| Vercel para `8b063d80` | Success al consultar |

**Se comprobó leyendo el log del trusted job** que la ejecución checkout fue `10f0e4fe`, que los seis tests T-314 pasaron y que hubo `49 passed` Chromium + `3 passed` global-settings, sin fallos. Esto es evidencia ejecutada y no una inferencia desde el color del badge.

## 3. Cierre de H01–H07

**H01 (privacidad D3/D15 DOM, fetch y RSC):** `page.route` + `route.fetch()`, `expect.poll(liveBodies.length)` y 4 centinelas siguen en el spec. Caso T-314 #27 GREEN. Sin mutación independiente propia en esta sesión.

**H02 (pines alta y solicitud):** locator `heading.locator('xpath=../..')` con cuenta unívoca de botón; el mock MapPicker deja llegar a los asserts de nudge/GPS/error. Casos T-314 #28 y #29 GREEN. Sin relajación de límites.

**H03 (mapa postmatched):** ausencia de fallback, pins pickup/dropoff, enlace externo canónico en caso #30 GREEN.

**H04 (cero llamadas Google):** caso #32 GREEN; mantiene URL interceptada positiva y ausencia de unexpected, además de nuevas aserciones de MapPicker y map-container montados y sin boundary error. Corrige la cobertura que faltaba en R4.

**H05 (integridad de evidencia):** en `docs/tasks/log/T-314.md` y PR body se anotaron las fallas anteriores, `Marker.setDraggable`, los tests positivos, CI `37741240738` y trusted `37741363122`, así como el `pnpm test` local limpio reportado 2004/0. El requisito E2E solo se marcó [x] tras ese trusted PASS. Las afirmaciones antiguas de mutaciones RED/GREEN sobre casos inicialmente bloqueados por fail-closed **no fueron verificadas independientemente** en esta revisión; no se utilizan como sustento del cierre. La propiedad funcional queda avalada por E2E real.

**H06 (autenticación / roles):** login merchant en rutas protegidas y contexto nuevo en degradación; casos #28, #31 y #32 GREEN, sin tocar guards ni fixtures.

**H07 (SDK mock):** `Marker` clásico ahora implementa `setDraggable/getDraggable` y métodos de estado; `remove()` de listeners null-safe; los dos casos previamente rojos ahora GREEN junto con el smoke positivo. El autor indica `BASELINE GREEN / MUTANTE RED` con script Node; se reconoce como **evidencia del autor**, no como mutación reproducida por este revisor. La evidencia independiente más importante son los E2E trusted.

## 4. Observaciones no bloqueantes

- Como el HEAD se movió por bitácoras, se recomienda esperar los checks de **último SHA** y de este commit de revisión antes de mergear. No es un bug del código E2E.
- La rama sigue detrás de `develop`. GitHub no marca conflicto, pero corresponde comprobar el mergeability/checks actualizados justo antes del merge, sin rebase ni force-push.
- Las mutaciones RED independientes de cada propiedad no se ejecutaron desde este entorno; el spec fue verificado en trusted CI, las mutaciones solo son futuras evidencias adicionales. No afirmar que el revisor las ejecutó.

## 5. Conclusión

**SIN BLOQUEANTES para T-314.** No se requieren correcciones de código ni una nueva ronda por hallazgos conocidos. Lautaro073 puede aprobar/mergear por su cuenta una vez que el HEAD de la PR muestre los checks requeridos completados satisfactoriamente. El revisor no aprobó ni mergeó ni modificó código de producción.

**Informe generado por revisión independiente, no por el autor del PR.**
