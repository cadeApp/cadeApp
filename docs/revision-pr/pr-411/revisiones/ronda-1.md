# PR #411 — T-369 paso 3/3, revisión independiente ronda 1

**2026-10-18** · PR [#411](https://github.com/cadeApp/cadeApp/pull/411) · código SHA `672de34db9602ccb0c97b3ee8d780acbd0d52f08` · rama `feat/T-369-e2e` hacia `develop` · **CON BLOQUEANTES (1)**: bloqueo del gate E2E por fixture preexistente T-302. **No es una regresión demostrada de T-369**.

## Alcance y contexto

- 7 archivos: `docs/tasks/T-369.md`, bitácora T-369, `e2e/mutations/manifest.json`, `e2e/mutations/t369-pilot-plan-copy.patch`, `e2e/specs/publication-credits.spec.ts`, `e2e/specs/publication-credits.global-settings.spec.ts`, `src/server/e2e/staging-seed.ts`. Todos autorizados por la ficha con ampliación del paso 3 registrada. Sin código de producto, SQL, RLS, CI ni políticas modificados.
- El PR es Draft. Su base `develop` coincide con `15c68d9ad57fdb6084483d0ba2702c09391aad7c` al inspeccionarlo. PR #402 ya mergeada y migración D01-B aplicada por `migrate-develop` [39089611080](https://github.com/cadeApp/cadeApp/actions/runs/39089611080).
- `publication-credits.spec.ts`: caso de piloto activo sin cambiar setting, Mi plan gratis e ilimitado, request publicado, cargos y movimientos vacíos. **Pasó** (línea de log número de caso 63; 15,3 segundos).
- `publication-credits.global-settings.spec.ts`: tres escenarios con el piloto apagado, `withPilot(false)` con restauración/verificación `finally`, admin con TOTP en UI, reserva→consumo, reintegro por reconciliación, ilimitado y cleanup de plan. **No llegaron a ejecutarse** en el gate por fallo anterior.
- `e2e/mutations/t369-pilot-plan-copy.patch` modifica temporalmente el texto mostrado del modo piloto; el RED_CONFIRMED se prevé tras merge de este paso, no se afirma ejecutado. La bitácora presenta un acta de staging **pendiente** para posterior release; sin validación real de staging. No habilitar cobros ni apagar el piloto.

## BLOQUEANTE — PR411-H01

- **Referencia:** `e2e/specs/courier-onboarding.spec.ts:550-561` (archivo preexistente, **no incluido** en el diff de #411); se calcula HMAC del DNI literal `35999888`, y luego se intenta actualizar el courier sembrado. Una fila anterior en Develop ya tiene esa clave; PostgreSQL rechaza por `couriers_dni_hmac_key` antes de probar la UI de DNI duplicado.
- **Evidencia:** [E2E run 39094918384](https://github.com/cadeApp/cadeApp/actions/runs/39094918384), [job 117579281090](https://github.com/cadeApp/cadeApp/actions/runs/39094918384/job/117579281090): `1 failed, 87 passed`; falla tres veces en el mismo test T-302, mientras el test T-369 de piloto activo pasa. Igual fallo preexistente en base develop run [39090664594](https://github.com/cadeApp/cadeApp/actions/runs/39090664594). En `.github/workflows/e2e-preview.yml:119-120` corre chromium y luego global-settings bajo `-e`; el proyecto global-settings **no empezó** tras el error.
- **Impacto:** ausencia de evidencia runtime de bloqueo sin saldo, acreditación admin AAL2, reserva/consumo, vencimiento y plan ilimitado. No se puede declarar `e2e-preview` verde ni T-369 terminada.
- **Corrección exigida:** aislar reparación del seed de T-302 en una PR/tarea independiente, con autorización de la ruta; cambiar el DNI fijo por valor válido, único por corrida, no reutilizar registro ni borrar usuarios ajenos, conservar intención de duplicado *dentro de esa corrida* y cleanup. Test negativo reproducible antes del arreglo y GREEN contra Supabase Develop después, sin adulterar expectativas ni saltear casos. Luego re-ejecutar gate E2E de #411 y documentar resultados reales de **ambos** proyectos.
- **Frontera de alcance:** no introducir `e2e/specs/courier-onboarding.spec.ts` en #411 sin decisión expresa de Lautaro073. No tocar `couriers` ni `pilot_active` directamente para limpiar residuos de otros tests; primero diagnóstico de identidad/datos. El reporte puede proponer una PR T-302 separada.

## Comprobaciones y límites

- [CI run 39094854809](https://github.com/cadeApp/cadeApp/actions/runs/39094854809) sobre SHA auditado: unit, typecheck, lint, build, audit, bundle-budget y db-tests SUCCESS.
- `e2e-preview` real = **FAILURE**, no bloqueo de migración. El ejecutor comprobó que el caso de piloto activo pasa, y detectó la colisión en T-302. La ejecución `global-settings` no se inició. La política `approval-policy` aparece FAIL por informe placeholder (se sustituye en esta ronda, no se afirma verde).
- No se ejecutó Playwright ni acceso a Supabase desde este revisor. La conclusión técnica está basada en lectura directa de source y logs auténticos de GitHub Actions. No afirmar RED/GREEN de los tres E2E que no corrieron.
- **Limitaciones aceptadas en la ficha:** los RED E2E para specs global-settings se sustituyen por controles previos pgTAP/Vitest, pero ello no certifica la sensibilidad de todos los escenarios browser de los nuevos specs. Registrar como límite explícito; no declarar pruebas nuevas completas antes de correr el E2E real.
- La guía de staging es un entregable de esta PR; el acta ejecutada va **después** de `develop → staging`, no antes. La issue #356 permanece abierta y `pilot_active` no cambia.

## Dictamen

**CON BLOQUEANTES (1, externo a código propio de #411).** La única corrección conocida es desatascar el gate real E2E y ejecutar los tres escenarios todavía ausentes. Mantener esta PR Draft, no mergear ni aprobar; no cerrar #356 ni iniciar release/staging. Una nueva ronda independiente debe contrastar el nuevo run y sus aserciones reales.