# Informe independiente de revisión — PR #536 / T-413 — ronda 1

**Fecha:** 2026-10-22  
**HEAD de código revisado:** `4bc500cd5e15c21887a4b1ed70423e3cd8bcf920`  
**Base:** `develop` @ `0e4e83a699b118a1464b01bd546a947447025b01`  
**Resultado estático:** SIN BLOQUEANTES de código (0). **Estado de merge:** AÚN NO, gates pendientes.

## Alcance y corrección

Ficha fuente: `docs/tasks/T-413.md` leída desde la **base**, no desde la rama. Tres archivos cambiados:
1. `package.json`: exclusivamente `next` y `eslint-config-next` 15.5.26 → 15.5.28.
2. `pnpm-lock.yaml`: `next`, `eslint-config-next`, `@next/env`, `@next/eslint-plugin-next`, y 8 binarios `@next/swc-*` a 15.5.28, sin otras familias modificadas.
3. `docs/tasks/log/T-413.md`: evidencia y pendientes.

No hay cambios de `src/`, SQL, contratos, CI, dependencias ajenas a la ficha o tests. Mergeability informado por GitHub: `true` en el momento de lectura.

Dos advisories asociados: GHSA-2464-fhr4-w9xw y GHSA-p3m5-59mp-jv5r; el parche 15.5.28 está reconocido para ambos. `sharp@0.35.5` ya figura en el lockfile; no se exagera el alcance de explotación concreto en cada despliegue.

## Evidencia propia

- Inspección del patch completo y enumeración de la familia `@next/*` afectada.
- Verificación programática **de contenido obtenido del conector de GitHub**, no de un clon local: **16/16** aserciones de manifiesto/lock/Sharp correctas en `4bc500cd5e15c21887a4b1ed70423e3cd8bcf920`.
- Contracontrol RED: la misma comprobación falla sobre `0e4e83a699b118a1464b01bd546a947447025b01` en 15 condiciones relacionadas con versión. Mutaciones propias en memoria: revertir `next` del manifiesto, y revertir una ocurrencia de `next@` en el lockfile; ambas detectadas. Los scripts de repetición están en `evidencia/comandos.md`.
- Esta comprobación **no** equivale a ejecutar `pnpm audit` o un E2E en entorno local. No se fabricaron mocks, salidas ni tests.

## CI verificado sobre el HEAD de código

Run CI: https://github.com/cadeApp/cadeApp/actions/runs/39867665428

| Check | Evidencia / resultado |
|---|---|
| install | `pnpm install --frozen-lockfile`: PASS, `Lockfile is up to date, resolution step is skipped` |
| audit | PASS. Log: `4 vulnerabilities found; Severity: 3 moderate | 1 high (1 ignored)`. Ninguno de los dos avisos objetivo. El job tiene una rama advisory, **pero en este SHA** existe el código/esquema y ejecutó la rama estricta `pnpm audit --audit-level=high` |
| typecheck / lint | PASS |
| unit | PASS; Vitest: `Test Files 168 passed (168)`, `Tests 3289 passed (3289)`; 81 y 6 pruebas auxiliares adicionales también PASS |
| build | PASS; `Compiled successfully in 17.2s` |
| bundle-budget | PASS con **warning** por rutas sobre 180 kB (p. ej. `/admin/audit = 249 kB`); no se demuestra regresión causada por esta PR |
| db-tests | EN CURSO al redactar |
| e2e-preview | EN CURSO, run https://github.com/cadeApp/cadeApp/actions/runs/39867838378 |
| Vercel | SUCCESS, Preview desplegado |
| approval-policy | FAIL porque todavía faltaba el informe `Informe revisar-pr` en el cuerpo del PR |

La bitácora declara RED de `pnpm audit` en 15.5.26 con salida 1 y GREEN con salida 0 en 15.5.28. La salida GREEN queda respaldada por el log de CI y la versión instalada. El RED de pnpm audit **no se reprodujo** localmente en este entorno sin red.

## Bloqueantes de código

**Ninguno identificado.** No se proponen cambios de dependencias, fuentes ni pruebas.

## Condiciones externas antes de merge

1. Esperar resultado final de `db-tests` y `e2e-preview`; un estado pending no es verde.
2. Verificar en el log de `e2e-preview` la ejecución real de Playwright con flujo de comercio, repartidor y admin, contra el Preview de esta PR y su SHA.
3. Publicar el informe en el cuerpo del PR con formato exigido para `approval-policy`. El verde del policy verifica el formato, no suplanta esta revisión.
4. Tras merge, promover `develop → staging → main` siguiendo la decisión ya asentada en la ficha. La promoción a producción es **una acción distinta**, no ejecutada por esta revisión.

## NO TOCAR — falsos positivos descartados

| Posible objeción | Motivo |
|---|---|
| Actualizar también React/Sharp | No lo exige la ficha ni este diff; `sharp@0.35.5` está en el lockfile |
| Resolver moderados o el alto ignorado | Expresamente fuera de alcance de T-413 |
| Hacer pasar el aviso de bundle como regresión de T-413 | No hay evidencia de comparación base-HEAD que demuestre ese efecto |
| Cambiar tests para forzar verde | Prohibido. No hace falta para la actualización |

## Checks locales

No ejecutados: este entorno no resolvió `github.com` con `git ls-remote`. Se consultaron logs del CI, más verificación y mutaciones puras de los textos obtenidos de GitHub. No declarar verde local inexistente.
