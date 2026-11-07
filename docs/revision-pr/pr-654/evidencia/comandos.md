# Evidencia y comandos reproducibles — PR #654 / T-428 R01

**SHA de implementación:** `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc`  
**Base:** `4ae5404ee14651d00ad0c9286f250ba6c5441c49`  
**Fecha:** 2026-11-07  
**Modo de revisión:** lectura del diff, fuentes y logs oficiales mediante conector GitHub. **Sin clon local ni ejecución propia de comandos**; las salidas de CI abajo son evidencia observada, no pruebas ejecutadas en esta sesión.

## 1. Diff y alcance

Fuente: https://github.com/cadeApp/cadeApp/pull/654/files

```bash
git fetch origin
git diff --stat origin/develop...origin/feat/T-428-licencia-por-vehiculo-e2e
git diff origin/develop...origin/feat/T-428-licencia-por-vehiculo-e2e -- e2e/specs/courier-onboarding.spec.ts
```

**No ejecutado localmente**. En GitHub se observaron 4 archivos: `docs/implementation-plan.md`, `docs/tasks/T-428.md`, `docs/tasks/log/T-428.md`, `e2e/specs/courier-onboarding.spec.ts`. La única modificación funcional: lectura de `active_vehicle_id` (líneas 1087-1096) e inserción de `vehicle_id` (1143).

## 2. CI oficial

- https://github.com/cadeApp/cadeApp/actions/runs/42335300787 — SHA `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc`
- `db-tests`: pgTAP `Files=43, Tests=3582`, `Result: PASS`; comprobación de tipos generados `git diff --exit-code -- src/types/database.types.ts` sin cambios.
- `unit`: `Test Files 197 passed (197)`, `Tests 3708 passed (3708)`.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: jobs `success`.

## 3. Gate trusted E2E del SHA probado

- Run: https://github.com/cadeApp/cadeApp/actions/runs/42335963853
- Job: https://github.com/cadeApp/cadeApp/actions/runs/42335963853/job/128292871037
- `actions/checkout` recibió `ref: c3accb7eb748b58dd2f77d918992f3b54f1fb9fc`, hizo `git checkout --force c3accb7eb748b58dd2f77d918992f3b54f1fb9fc` y registró ese SHA.
- Línea GREEN exacta del job (2026-11-07 04:02:24 UTC):

```text
✓   24 [chromium] › e2e/specs/courier-onboarding.spec.ts:1056:7 › T-302 — E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado › T-356 / CC-025: Recarga de documento rechazado con motivo seguro y actualización a En revisión sin mutar aprobados (29.9s)
```

**Una sola ejecución de ese caso, sin `retry` ni `skip`.** `e2e-preview=success` publicado sobre `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc`.

### Flaky ajeno T-407

```text
✘ [chromium] › e2e/specs/admin-audit-filters.spec.ts:69:7 (16.4s)
✘ [chromium] › e2e/specs/admin-audit-filters.spec.ts:69:7 (retry #1) (16.2s)
✓ [chromium] › e2e/specs/admin-audit-filters.spec.ts:69:7 (retry #2) (17.4s)
Error: strict mode violation: getByText('Mostrando los eventos de una sola entidad.') resolved to 2 elements
1 flaky
121 passed (32.2m)
7 passed (2.6m) [global-settings]
```

Issue: https://github.com/cadeApp/cadeApp/issues/636 ([QA][T-407]); no forma parte del diff de #654. La issue figura cerrada, pero este run demuestra recurrencia del síntoma.

## 4. Approval policy

- Run: https://github.com/cadeApp/cadeApp/actions/runs/42335301066
- Log: `Falta el informe completo de revisar-pr sin bloqueantes.`
- `.github/workflows/approval-policy.mjs` comprueba la sección `### Informe de revisión de agy` en **el cuerpo** de la PR. No afirmar que quedó verde hasta observar nuevo check.

## 5. Comandos para un entorno con clon (pendientes, NO ejecutados aquí)

```bash
git pull --ff-only origin feat/T-428-licencia-por-vehiculo-e2e
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs abiertos
node docs/revision-pr/analizar.mjs verificacion
```

No ejecutar manualmente workflows, migraciones ni E2E contra Supabase remoto desde esta revisión. No hay mutación adversarial independiente ejecutada; no inventar salida RED/GREEN.
