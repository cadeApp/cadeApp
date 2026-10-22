# Informe de revisión — PR #237 / T-325 — Ronda 3 final

**PR:** https://github.com/cadeApp/cadeApp/pull/237  
**Head SHA funcional revisado:** `8b8142b35ddef3c87066398a4ad9a5eed125b36e`  
**Base:** `develop` @ `e39569b59fa8203df9893dbb824cbc4a317d4181`  
**Fecha:** 2026-10-03  
**Resultado:** **SIN BLOQUEANTES — revisión técnica cerrada**

## Decisiones

No hubo decisiones 🔵 pendientes en esta ronda.

## Arranque y alcance

- Desde el commit de revisión R2 `4c85f499...` hasta `8b8142b35ddef3c87066398a4ad9a5eed125b36e`: **1 commit del autor**.
- Ese commit modificó únicamente:
  - `docs/tasks/log/T-325.md`;
  - `src/features/courier-onboarding/evidence/T-325/README.md`;
  - `src/features/courier-onboarding/evidence/T-325/360-05-cargado.jpg`.
- No se tocó ningún `.ts`/`.tsx`, test, RLS, migración, dependencia ni `docs/revision-pr/**`.
- El blob de `README.md` de revisión y `hallazgos.jsonl` seguían siendo los de R2 antes de este commit del revisor.
- Comparación final del SHA funcional con `develop`: **ahead 8 / behind 0**, sin conflicto reportado por GitHub.

## Resumen

| ID | Estado final | Evidencia independiente R3 |
|---|---|---|
| PR237-H01 | **arreglado-verificado** | código exact-head + test de matriz inspeccionado + CI unit exact-head 1774/1774 |
| PR237-H02 | **arreglado-verificado** | código/test exact-head + captura de foco abierta directamente + CI unit exact-head |
| PR237-H03 | **arreglado-verificado** | captura success real abierta directamente + evidencia 390/360 + E2E Preview exact-head |

## PR237-H01 — persistencia del último documento válido

### Diagnóstico final

La corrección sigue presente en `8b8142b35ddef3c87066398a4ad9a5eed125b36e`: `handleOptionalUpload` ya no elimina `optionalDocs[kind]` antes de comprimir/subir. Solo sustituye el path cuando `uploadCourierDocument` devuelve un nuevo `storagePath`.

El bloque T-325 contiene la matriz completa:

- licencia × fallo de compresión;
- licencia × fallo de subida;
- seguro × fallo de compresión;
- seguro × fallo de subida.

En todos los casos se parte de un path exitoso anterior y el submit debe conservar `oldPath`.

### Verificación

- Inspección independiente del código y del test en el SHA final.
- CI #1064 del mismo SHA ejecutó la suite completa: **116 test files, 1774 tests passed**.
- El caso ya no depende de la vieja prueba «primer intento falla»: la regresión específica tiene cuatro controles directos.

La mutación RED del autor no se reejecutó en un worktree del revisor porque el contenedor no resolvía GitHub; no se inventa ese resultado. La propiedad corregida sí queda verificada por inspección exact-head + ejecución exact-head del test que la afirma.

## PR237-H02 — foco visible de teclado

### Diagnóstico final

`DocumentUploadCard` mantiene:

`focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2`

El test lleva el foco al input real y comprueba tanto `document.activeElement` como el contrato del ring.

### Verificación

- El CI #1064 ejecutó los tests del SHA final dentro de los 1774/1774 verdes.
- La revisión abrió directamente el blob `360-04-foco-teclado.jpg`: el anillo de foco se ve alrededor de la tarjeta de licencia, no solo en texto o metadatos.

H02 queda cerrado.

## PR237-H03 — evidencia visual y success real

### Verificación visual independiente

La revisión abrió directamente `360-05-cargado.jpg` del SHA `8b8142b35ddef3c87066398a4ad9a5eed125b36e`.

La captura muestra a 360 px:

- tarjeta **Licencia de con…** con check, archivo `licencia.png` y «Cargado»;
- tarjeta **Seguro** con check, archivo `poliza.png` y «Cargado»;
- sin overflow horizontal visible.

La bitácora y el README de evidencia documentan que la subida fue real contra Storage con un courier nuevo creado por el flujo normal, sin interceptar `fetch`, mutar DOM/React ni tocar RLS/DB.

La evidencia total de T-325 queda compuesta por:

- 390 px idle;
- 390 px uploading;
- 360 px error/retry;
- 360 px foco con teclado;
- 360 px success/Cargado real;
- mediciones de target 56 px, tipografía 14 px, overflow, contraste y reduced motion;
- revisión Diseño/Frontend/Persona.

H03 queda cerrado.

## CI exact-head

**Run CI #1064 — `8b8142b35ddef3c87066398a4ad9a5eed125b36e` — success**

| Job | Resultado contrastado |
|---|---|
| audit | success; audit advisory reportó 3 vulnerabilidades, política preexistente |
| lint | ESLint sin warnings/errors; Prettier advisory preexistente |
| typecheck | success |
| unit/coverage | **116 archivos · 1774/1774 tests · 83% statements / 82% branches** |
| db-tests | sonda 1/10 PASS + suite **17 archivos · 1807 tests · PASS** |
| build | compiled successfully |
| bundle-budget | job success; `/admin/audit` 234 kB supera el advisory de 180 kB, fuera de T-325 |

Los warnings de formato, audit advisory y bundle de `/admin/audit` no provienen de archivos de T-325 y no son bloqueantes de esta PR.

## E2E Preview exact-head

El workflow `e2e-preview` fue disparado por Vercel y publicó el status sobre:

`TARGET_SHA=8b8142b35ddef3c87066398a4ad9a5eed125b36e`

Resultado:

- Chromium: **20 passed**;
- global-settings: **3 passed**;
- artifact Playwright generado;
- status `e2e-preview=success` sobre el SHA exacto;
- Vercel status: `success`.

Esto también confirma que el Preview usó el ambiente Develop separado y pasó health check antes de ejecutar Playwright.

## NO TOCAR — observaciones preexistentes

| Observación | Motivo de no bloquear |
|---|---|
| El success no toma verde | `text-success` / `bg-success/15` ya estaban en el patrón del paso 2 y el token no existe; T-325 replica ese patrón |
| «Licencia de conducir» se trunca a 360 px en success | comportamiento del componente compartido/patrón previo; success sigue inequívoco por check + archivo + «Cargado» |
| Prettier advisory en muchos archivos | global y preexistente; lint real está verde |
| `/admin/audit` = 234 kB | fuera de T-325; bundle-budget está configurado como advisory |

## Checklist final

- [x] Head remoto y base comprobados.
- [x] Autor no tocó `docs/revision-pr/**`.
- [x] Alcance de la última corrección respetado.
- [x] H01 cerrado en SHA exacto.
- [x] H02 cerrado en SHA exacto.
- [x] H03 cerrado con evidencia visual real.
- [x] CI detallado auditado, no solo color.
- [x] DB logs auditados.
- [x] Vercel success.
- [x] E2E Preview exact-head: 23/23.
- [x] Sin decisiones 🔵 pendientes.
- [x] Sin bloqueantes.

## Resultado

**Revisión independiente cerrada: PR #237 queda sin bloqueantes técnicos para merge.**

No se envía aprobación de GitHub ni se hace merge desde esta revisión: eso requiere pedido explícito de Lautaro073.
