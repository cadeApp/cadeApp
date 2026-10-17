# Informe revisar-pr — PR #368 / T-354 — Ronda 6

**Fecha:** 2026-10-16
**SHA de código/documentación revisado:** `5388ed3627e4958cb3bcd112eb38ed66aa892bed`
**Rama:** `feat/T-354-unificar-texto-selfie-dni` → `develop`
**Resultado: CON BLOQUEANTES DE GATE (CI build FALLÓ, E2E CANCELADO). No se encontraron nuevos defectos funcionales de T-354. H02 mantiene límites de verificación independiente.**

## Alcance de la ronda

Comparación de la rama con el commit de revisión de R5 `d83030113388891b185612b11d1bf12bc6028bbc`: UN único archivo cambiado, `docs/tasks/log/T-354.md` (+43 líneas). No hubo cambios propios del autor a `docs/revision-pr/pr-368/**` ni a los componentes/tests del producto desde R5. La rama está 4 commits por detrás de `develop` y GitHub informa `mergeable=true` (esto no sustituye `git merge-tree`).

## Código de aplicación, accesibilidad y presentación

- Aprobadas las decisiones 1-A, 2-B y 3-A: título `Selfie con el DNI`, subtítulo completo, la denominación administrativa y el test cruzado que conserva `Pendiente`.
- Se inspeccionaron 9 archivos de fuente/test de la SHA actual. Los 14 controles de texto/estructura tuvieron GREEN y los 14 mutantes propios de copia de código **en memoria** fueron detectados. No son Vitest mutado.
- La UI real sigue recibiendo los títulos desde `COURIER_ONBOARDING_COPY`, sin el encabezado `DOCUMENTUPLOADCARD` que pertenecía al reporte QA.
- La bitácora y el cuerpo de la PR ahora contienen enlaces a nuevas capturas 360×800 y 390×844 sin encabezado técnico, según su autor. No fue posible abrir las imágenes externas desde las herramientas actuales: se reconoce el entregable publicado, pero **no se afirma verificación visual independiente**.

## H02 y H05: prueba hermética del algoritmo RED→GREEN

El autor corrigió las descripciones contradictorias de sus controles negativos. El texto de la bitácora ahora explica correctamente que `node -e "process.exit(0)"` cae en el GREEN inicial por no tener salida Vitest, mientras que un mock que emite `Tests 1 passed (1)` ejercita la protección real contra mutantes sobrevivientes. Un comando inexistente se rechaza en el GREEN inicial.

El revisor reejecutó un programa Node hermético que reconstruye la lógica publicada. Salida observada:

```text
always-GREEN reason=Mutante sobreviviente o fallo no atribuible a test: exit=0
always-GREEN REJECTED clean=true
nonexistent-command reason=Control GREEN inicial ausente
nonexistent-command REJECTED clean=true
RED-and-GREEN DETECTED clean=true
R6_HARNESS_VALIDATION=PASS
```

Se verifica que el nuevo harness **no autoaprueba los falsos RED que mostraba H05**, y restaura buffers. No se ejecutaron las nueve mutaciones reales de Vitest contra un checkout de la app desde esta sesión. Por eso **H05=arreglado-verificado para el algoritmo**, mientras **H02=parcial** por la reproducción independiente que falta. La mutación (i) se reconoce correctamente como deriva de test, no invariante funcional.

## Gates de CI — bloqueantes comprobados

| Check de HEAD 5388ed3 | Resultado comprobado |
|---|---|
| unit | SUCCESS: job 116635958117, 133 archivos / 2370 Vitest passed, además 79 node:test y 6 ADR |
| typecheck / lint / audit | SUCCESS |
| db-tests | SUCCESS, job 116635958806: último pgTAP normal `Files=24, Tests=2283, Result: PASS`; otros RED internos pertenecen a CC ajenos |
| approval-policy | SUCCESS: aprobación vigente de Lautaro073; no emitida por el revisor |
| Vercel deployment | SUCCESS, deployment `dpl_GGvsTyGPrmMFKhKyVNqc3dYonmCT` |
| build | **FAILURE**, job [116635958258](https://github.com/cadeApp/cadeApp/actions/runs/38797012691/job/116635958258): `next/font` google loader `TypeError: Cannot read properties of null (reading '1')` al compilar |
| bundle-budget | SKIPPED al fallar build; **no** es success |
| e2e-preview | **ERROR por CANCELLED**, [run 38797126543](https://github.com/cadeApp/cadeApp/actions/runs/38797126543), job 116636476695 cancelado |

### Diagnóstico del build

`src/app/layout.tsx` en `develop` importa `Inter` y `Montserrat` de `next/font/google`. El diff de T-354 no cambia ese archivo ni la configuración de fuentes; el deployment Vercel del mismo SHA sí terminó. El stack trace indica un error al procesar fuentes en el entorno de GitHub Actions, **pero no demuestra si la causa es una descarga remota, una versión de Next, una respuesta inesperada u otra condición del entorno**. No culpar a T-354 ni modificar dependencias/workflows/estilos para forzar verde sin reproducir; primero reejecutar el job build sobre el HEAD definitivo. Si vuelve a fallar, investigar fuera de alcance de T-354 con seguimiento separado y causa reproducida.

### Diagnóstico de E2E

El workflow `e2e-preview.yml` es disparado por Vercel `repository_dispatch`, no por el HEAD del workflow. El `e2e-preview-target.mjs` permite una **reejecución manual del run** porque para `runAttempt>1` no se aplica la exclusión de eventos duplicados. El run vigente `38797126543` fue cancelado, el commit status indica ERROR, y el E2E exitoso de `20392c26` no se puede heredar a `5388ed3`. La cola global `cadeapp-develop-e2e` usa `cancel-in-progress=false`, pero nuevas solicitudes pending pueden reemplazarse; no afirmar que el job corrió cuando fue CANCELLED.

**Acciones manuales operativas:** cuando el HEAD de la feature sea definitivo y vuelva a desplegar, reejecutar los jobs fallidos de CI/build y el E2E Preview del deployment/commit EXACTOS mediante el control de GitHub Actions. Solo el usuario puede autorizar/ejecutar manualmente estas corridas; el revisor no hizo dispatch. Tras cualquier nuevo commit, comprobar CI/E2E en el SHA nuevo.

## Estado final

H01 y H03: código verificado. H05: algoritmo corregido verificado herméticamente. H02: parcial, sin mutación Vitest propia ejecutada. H04: parcial por E2E cancelado y capturas no inspeccionadas directamente. Gates BUILD y E2E impiden merge. No se aprobó ni mergeó; no hay decisiones nuevas sobre el diseño de la selfie.
