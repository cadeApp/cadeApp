# Informe de revisión independiente — PR #315 / T-347 / T-313 — Ronda 3

**Fecha:** 2026-10-09
**HEAD entregado por agy:** `88e490b5f0912276c0b3b62779c5f9cfde0be275`
**Microfix mínimo de revisión:** `849d2357a9e1f7313b7d37eff4f98e47bf7141ba` (1 condición y 2 tests en archivo permitido).
**Base:** develop `92cd258545f25e162ada062c0c22c02ff17840b8`.
**Resultado: SIN BLOQUEANTES DE CÓDIGO.** H01 y H02 arreglados/verificados mediante ejercicio independiente de funciones; no se aprobó ni mergeó PR #315.

## Lectura y alcance

Se contrastaron: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, fichas de T-347 y T-313 desde develop, cambios `6db397e..88e490b`, bitácora del autor, spec real de PR #251 (`77d430b`), manifest, patch, y la guarda original en develop.

La PR difiere de develop exclusivamente en `.github/workflows/verify-workflows.test.mjs`, `docs/tasks/log/T-347.md`, `e2e/mutations/manifest.json`, `e2e/mutations/t313-courier-merchant-guard.patch` y la carpeta documental `docs/revision-pr/pr-315/**`, todas rutas permitidas. Ningún código `src/**`, E2E spec ni RLS/productive se modifica. El patch apunta a una sola condición de `src/features/auth/guards.ts`, cuyo blob base `b5c2de551e4bf435966a9bbc3739dddee32d38d9` coincide con develop.

## PR315-H01 — RESUELTO

El antiguo `helper.includes` aceptaba texto en strings y `if(false)`. Ahora `scanCode`/`blankStrings` reconocen strings, `balancedBody` aísla bloques y `topLevelStatements` compara:
- primeras sentencias de helper `page.goto(path)` y `toHaveURL(expectedUrl)`,
- declaración real de rutas seguida de bucle `expectMerchantPanelBlocked`,
- primera ruta `/merchant/dashboard` y `expectedFailure` específico `/courier/feed`.

**Prueba independiente:** sobre la implementación pura exacta del HEAD y el spec real de #251: CONTROL GREEN, M1 eliminación de aserción RED, M2 helper no llamado RED, M3 patrón URL erróneo RED, X2 aserción como string RED, X3 helper inalcanzable RED, X4 bucle inalcanzable RED y A1 separación con if(false) RED.

**Microfix de revisión:** una salida anticipada `return;` o `throw...` justo después del login dejó pasar el control del autor (GREEN indebido). Se agregó la condición `(statements[0] === oracle.login && routesAt !== 1)` al control existente; se añadieron 2 aserciones negativas en el fixture del test. Las mutaciones Y1/Y2 ahora son **RED** sin false-positive sobre un statement de diagnóstico después del bucle. Este cambio de test es mínimo (sin production code). La independencia de la autoría del microfix es limitada: fue escrito por el revisor y probado por ejecución local del checker; queda respaldado además por los nuevos checks CI, cuando terminen.

## PR315-H02 — RESUELTO

El caso requiere `await loginAsCourier(0, page);` **como primera sentencia real** de la prueba `DoD: Un courier no entra a (merchant)`, antes de la declaración de las rutas. La comprobación independiente sobre el código del autor y el SHA 849d detectó X1 (login eliminado) y L1 (login cambiado a merchant) como RED; el control legítimo permanece GREEN. No se falsificó un mock ni se alteró `loginAsCourier` en PR #251.

## Evidencia cuantitativa y límites

| Caso (evaluator sobre código real) | Resultado esperado | Resultado observado |
|---|---|---|
| Spec legítimo de PR #251 | GREEN | GREEN |
| M1, M2, M3 | RED | 3 RED |
| X1, X2, X3, X4 | RED | 4 RED |
| L1, A1 | RED | 2 RED |
| Y1 return, Y2 throw | RED | 2 RED |
| Z1 declaración inocua después del bucle | GREEN | GREEN |
| **Total** | 13 pruebas | **13/13 conforme** |

**Alcance del test independiente:** ejecución de funciones JS reales, extraídas de `verify-workflows.test.mjs`, sobre el texto íntegro del spec leído de GitHub de #251, con mutaciones únicamente en memoria. No se descargó el repositorio a un clon local ni se ejecutó el comando `node --test` completo por el revisor; esa suite y Playwright se observan en GitHub Actions. Tampoco se ejecutó un `repository_dispatch` de mutación: no corresponde hasta merge de #251.

## Estado CI de los dos SHAs

- **`88e490b` (código del autor antes del microfix):** GitHub CI `37888616760`: unit, typecheck, lint, build, audit, db-tests, bundle-budget PASS; `e2e-preview` `37888724329` PASS, reporta 56 Chromium + 3 global-settings; Vercel success. `approval-policy` FAIL por informe del autor aún pendiente de revisión independiente.
- **`849d235` (microfix del revisor):** nuevos checks iniciados. El resultado debe comprobarse **sobre este SHA exacto** antes del merge; no trasladar verde automáticamente desde `88e490b`. `approval-policy` requiere incorporar este informe sin bloqueantes en el cuerpo de la PR.

## Mejoras no bloqueantes

X5 elimina una ruta merchant secundaria del spec y supera el control estructural porque este verifica las rutas declaradas y una primera ruta específica, no toda una lista fija. **No se amplía** el catálogo T-347 con la lista completa: el mutante rompe una guarda compartida; T-313 debe verificar su propia cobertura integral. La mutación E2E real constituye la confirmación de seguridad posmerge, no un requisito comprobable antes de integrar #251 a develop.

## Próximos pasos

1. Confirmar checks finales de SHA documental posterior al microfix, `approval-policy` tras actualizar el informe del cuerpo, y trusted E2E sobre el nuevo HEAD.
2. Lautaro073 decide si mergea #315; el revisor **no aprobó ni mergeó**.
3. Kira integra develop en #251, valida CI/E2E, pide revisión; Lautaro073 decide merge.
4. **Solo entonces**: disparar `e2e.mutation.requested`, `target: develop`, `mutation: t313-courier-merchant-guard`. Exigir `RED_CONFIRMED`, artifact minimizado y registrar H04; cualquier resultado distinto se informa sin adulterar el spec o `expectedFailure`.
