# CHECKPOINT TEMPORAL — T-340 Paso 3/4 (PR #326)

**REVIEW ONLY / NEVER MERGE.**

Esta rama parte exactamente del merge de la PR #326 en `develop` (`883ee17d76530b622aee205a157dca33b06580aa`). Se crea una modificación documental mínima para obtener un nuevo Vercel Preview y activar el workflow confiable `e2e-preview`, sin alterar migraciones, código, tests, secretos ni workflow.

## Evidencia de entrada

- PR funcional: https://github.com/cadeApp/cadeApp/pull/326
- Decisión de Lautaro073: https://github.com/cadeApp/cadeApp/pull/326#issuecomment-6157550712
- Revisión independiente: ronda 4, sin bloqueantes técnicos.
- Merge `develop`: `883ee17d76530b622aee205a157dca33b06580aa`.
- Migración: https://github.com/cadeApp/cadeApp/actions/runs/38485937531 — `migrate-develop` PASS.
- Vercel Develop: SUCCESS para `883ee17d76530b622aee205a157dca33b06580aa`.

## Condiciones de salida

- Esperar status de `e2e-preview` en el SHA **de esta PR temporal**.
- Verificar desde el log auténtico del job (no sólo el status): `pnpm exec playwright test --project=chromium --workers=1` y `pnpm exec playwright test --project=global-settings --workers=1 --pass-with-no-tests`, exitosos.
- Corroborar que `e2e/specs/t340-legacy-checkpoint.spec.ts` se ejecutó realmente y pasó sobre la versión del Paso 3, además de privacidad antes/después de match, multi-drop, compatibilidad legacy, DoD2 y limpieza de fixtures.
- Si todo es GREEN, registrar SHA, Vercel Preview URL, run/job IDs y cantidades reales; **cerrar esta PR sin mergearla**. Sólo entonces habilitar el Paso 4.
- Si falla migración, deploy o Playwright, dejar Paso 4 congelado y abrir corrección de Paso 3. Jamás adulterar pruebas, omitir fallos ni ejecutar SQL remoto manual para forzar verde.

**No cierra #258.**
