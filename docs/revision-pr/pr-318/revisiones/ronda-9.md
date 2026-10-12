# Revisión independiente — PR #318 / T-340 — Ronda 9

**Fecha:** 2026-10-12 · **SHA del autor auditado:** `838c7686e234bbd18b2aa6c58fb939931c6eb3f1` · **Comparado con R8:** `f8f8bfc0e6d9f6b03523e6af304495ef82149001` → `838c7686e234bbd18b2aa6c58fb939931c6eb3f1`, 1 commit `docs(T-340)`, únicamente `docs/tasks/log/T-340.md` (+38 líneas), sin modificación de código, tests, migraciones ni carpeta de revisión por Asako. Rama `feat/T-340-lectores` a `develop` `267e9810`, PR abierta, Draft, mergeable.

## Dictamen — SIN NUEVOS BLOQUEANTES DE CÓDIGO; APTO PARA MERGE CONTROLADO BAJO OPCIÓN A

La bitácora nueva atribuye a Asako una mutación RED de H06 (3 tests fallidos en cada uno de los tres entrypoints merchant) y H12 (3 tests fallidos del oráculo de privacidad), con GREEN de 37/37 y 4/4. **Es evidencia declarada por el autor, no ejecutada en la sesión del revisor.** Se contrastó contra los cuerpos reales de los dos helpers, las expectativas de tests anteriores y el SHA revisado; el resultado es coherente y no hay cambios regresivos nuevos.

La revisión independiente ejecutó **sondas adversariales en JavaScript aislado sobre los cuerpos extraídos de los blobs exactos del SHA de autor**, quitando solo firmas/anotaciones TypeScript, sin mock del resultado de la función. H06 `3/1` publicado o delivered: original lanza error; al mutar solo `children.length !== expectedCount` el caso devuelve `dropsCount=1`; 3/3 y draft vacío se preservan. H12: original detecta `recipientPhone` anidado y `notes` raíz; al mutar guard de keys a `false` ya no los detecta, conservándose el control separado de valores. **Estas sondas NO son ejecución de Vitest completo ni Playwright**. Harness, mutantes y expectativas reproducibles en `evidencia/comandos.md`.

### Hallazgos acumulados

- **H06 — arreglado-verificado (acotado):** guard de cardinalidad para las tres rutas merchant y evidencia autor RED→GREEN, test unit original en CI PASS y sonda independiente original/mutante correcta.
- **H12 — arreglado-verificado (acotado):** detector recursivo sobre JSON crudo ANTES de Zod, valor y clave PII, prueba de mutación independiente sobre cuerpo de función y CI PASS.
- **H11 y H01/H02/H03/H04/H05/H07/H08/H10:** conservan sus verificaciones de rondas anteriores; este commit solo añadió documentación, no hallamos regresión.
- **H09 — PARCIAL POR ROLLOUT:** no hay E2E real de tres entregas en Preview anterior al merge: status `BLOCKED / REQUIRES DEVELOP MIGRATION`. Opción **A** de Lautaro073 en R8 ya decidió desplazar exclusivamente esa ejecución a un checkpoint **postmerge**. No declarar E2E PASS ni habilitar Paso 3 de Kira antes del checkpoint.

### CI del SHA exacto `838c7686`

| Control | Resultado |
|---|---|
| `unit` / coverage — [job 115029340023](https://github.com/cadeApp/cadeApp/actions/jobs/115029340023) | **129 suites, 2116 tests PASS**, `rpc-fake.ts` 95.32 % statements / 91.35 % branches; workflow 79 y ADR 6 PASS |
| `db-tests` — [job 115029339964](https://github.com/cadeApp/cadeApp/actions/jobs/115029339964) | **21 suites, 1995 tests PASS**, original H08/H14 11/11 concurrencia OK y H15 RED→GREEN restaurado |
| typecheck, lint, build, audit, bundle-budget, Vercel | PASS |
| `approval-policy` — [job 115029333963](https://github.com/cadeApp/cadeApp/actions/jobs/115029333963) | FAIL por falta de informe `revisar-pr` sin bloqueantes en comentario de PR antes de esta ronda |
| `e2e-preview` — [run 38315102812](https://github.com/cadeApp/cadeApp/actions/runs/38315102812) | BLOCKED / REQUIRES DEVELOP MIGRATION (**no ejecutado**) |

**Límite del revisor:** GitHub `git clone` no accesible por DNS desde el contenedor; no se corrió Vitest mutado, Playwright, Docker, Supabase local o remoto ni `analizar.mjs verificacion`. Sí se comparó SHA, archivos, código y logs de CI, se ejecutaron sondas independientes aisladas, y se validó sintaxis de los 12 hallazgos JSONL. No atribuir al revisor la ejecución local que figura en la bitácora del autor.

### Cierre y checkpoint pendiente

**No se pide modificar código a Asako en esta ronda.** No aparece una decisión nueva; mantienen vigencia opciones A R4/R5/R8 y los responsables Asako Paso2, Kira Pasos3–4.

**Condición de merge:** solo con autorización expresa de Lautaro073 y CI del commit documental de esta revisión, incluido `approval-policy`. Después: integrar PR #318, confirmar `migrate-develop` y despliegue del código compatible, crear una PR temporal **docs-only** sobre Develop migrado con su propio Vercel Preview para ejecutar realmente `e2e/specs/multi-drop.spec.ts` y `t340-legacy-checkpoint.spec.ts`; registrar SHA/run/job y casos; cerrar PR temporal **sin merge**. Si E2E falla, detener rollout y abrir corrección independiente de Paso2. **Kira no inicia Paso3 hasta checkpoint E2E GREEN.**

## Informe revisar-pr

Informe revisar-pr — T-340 — 2026-10-12 — revisión independiente, R9.

**Resultado: SIN BLOQUEANTES DE CÓDIGO PREMERGE; H09 CHECKPOINT E2E POSTMIGRACIÓN PENDIENTE BAJO OPCIÓN A.**

Checks: unit ✅ (2116) · db-tests ✅ (1995) · typecheck ✅ · lint ✅ · build ✅ · audit ✅ · bundle-budget ✅ · Vercel ✅ · approval-policy ❌ (informe sin publicar aún) · E2E 3 drops NO EJECUTADO (migration gate).

**Bloqueantes premerge nuevos:** ninguno confirmado. **Mejoras:** bitácora nueva dice último commit `c50f5dfa` aunque HEAD real es `838c7686`; metadato desactualizado no bloqueante, no demanda otra ronda de Asako.

**No mergear ni aprobar automáticamente; solicitar autorización expresa.**