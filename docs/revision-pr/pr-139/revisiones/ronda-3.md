# Informe de revisión — PR #139 / T-317 — Ronda 3

**PR:** https://github.com/cadeApp/cadeApp/pull/139  
**Head de implementación revisado:** `6cfa41e949b3ac81c17f4a3f6b545de8b27a10f1`  
**Base:** `develop` @ `24b034f42c6a6345edc4e77701bfb8e7f0a57aa7`  
**Fecha:** 2026-09-30

## Resultado

**SIN BLOQUEANTES de código.** H10–H12 quedaron corregidos y verificados de forma independiente. Como el archivo de implementación cambió después de Ronda 2, también se revalidaron H01–H09 sobre este SHA para evitar `verificado_en_sha` obsoleto.

La tarea todavía **no está cerrada operativamente**: falta la evidencia real obligatoria en `cadeapp-staging`, que la ficha reserva a Lautaro073.

## Revalidación independiente

- H01: rama 0 commits detrás de `develop`; ficha T-317 byte-identical al target.
- H02: launcher exacto `node tools/admin-mfa-enroll.mjs`.
- H03: no se filtran password, código, access token, refresh token, `totp.secret` ni `otpauth://`.
- H04: writer recibe XML `<svg…>`; raw/base64 rechazados.
- H05/H11: no-TTY falla cerrado; Ctrl+C/error/end restauran TTY y limpian listeners.
- H06: tres flags de auth exactos en `createClient`.
- H07/H10: `signOut({scope:'local'})` se intenta aun si falla `removeFile`.
- H08: `listFactors` y `unenroll` fallan cerrado.
- H09: throw post-QR ejecuta borrado + sign-out.
- H12: prefijo correcto con cuerpo no-SVG falla `QR_FORMAT` antes del writer.

## Mutaciones propias de Ronda 3

Sobre el código exacto se aplicaron tres mutaciones independientes en memoria:

- H10: volver al cleanup secuencial → la comprobación de `signOut` cambia de true a false.
- H11: quitar handlers `error/end` → la comprobación de restauración/settlement cambia de true a false.
- H12: quitar la guarda `startsWith('<svg')` → la comprobación de QR no-SVG cambia de true a false.

Cada mutación atacó una sola propiedad y el control sin mutar pasó las tres.

## CI del SHA exacto `6cfa41e`

- `unit` ✅: `pnpm test:coverage` → 104 test files / 1412 tests passed; `tools/admin-mfa-enroll.test.ts` → 30/30. También `verify-workflows` 29 tests y `verify-adr` 6 tests.
- `typecheck` ✅
- `lint` ✅
- `db-tests` ✅
- `build` ✅
- `bundle-budget` ✅
- `audit` ✅
- `Supabase Preview` skipped, no aplicable a este cambio.
- `approval-policy` ❌ por una única causa explícita del log: **“Falta el informe completo de revisar-pr sin bloqueantes.”** No es un fallo del código; el workflow inspecciona la sección del cuerpo de la PR.

La bitácora del autor registra que el comando local `pnpm test` tuvo interferencias ajenas a T-317, pero el mismo conjunto de Vitest corrió limpio en CI bajo `test:coverage` con 1412/1412, y los verificadores adicionales también pasaron.

## BLOQUEANTES:

- Ninguno de código.

## MEJORAS:

- Ninguna necesaria para T-317.

## No revisado / dudas para Lautaro073:

- **Pendiente obligatoria:** evidencia real en `cadeapp-staging`, ejecutada por Lautaro073 con sus propias credenciales.
- No se usaron credenciales ni Supabase remoto durante esta revisión.
- No se aprueba ni mergea la PR desde esta ronda.
