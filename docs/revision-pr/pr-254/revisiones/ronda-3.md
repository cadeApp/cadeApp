# Informe de revisión — PR #254 / T-302 — Ronda 3

**Head SHA revisado:** `8a39cab4f7ed740ea7c32e6f8cea14fea3c3760a`  
**Base vigente al revisar:** `develop` @ `6e2da8fb02d4797b9add222206342e6055f1d81c`  
**Fecha:** 2026-10-06

## Resultado

**CON BLOQUEANTES (3).** No hay 🔵 DECISIÓN para Lautaro073 en esta ronda.

### Lo que sí quedó cerrado

- **H01:** el runner real alcanza la deduplicación de producción y el DOM contiene el alert correcto.
- **H02:** desaparecieron los escapes condicionales/fallbacks; los pasos obligatorios ahora hacen fallar el E2E en vez de omitirse.
- **H03:** el reset de courier incompleto se ejecuta antes de los flujos y el runner alcanza onboarding con esa precondición.
- **H04:** el DoD de MFA y el Flujo 3 de aprobación por browser pasan en `e2e-preview` sobre este SHA.
- **H06:** `DNI_HMAC_SECRET` quedó fail-closed y sin clave inventada.

## BLOQUEANTE — PR254-H07 · Rama 48 commits detrás de develop

Al comenzar R3, `develop...8a39cab` devuelve **ahead 8 / behind 48**. La punta de `develop` es `6e2da8f...`; la rama conserva como merge-base `f1ae161...`.

Esto invalida una aprobación final aunque los checks del head fueran verdes: el resultado debe verificarse sobre la integración vigente. Entre esos 48 commits entraron además cambios E2E, por lo que el conjunto final de tests no es el mismo.

**Corrección:** `git fetch origin` y `git merge --no-edit origin/develop` en la rama del PR. Nunca rebase. Si hay conflicto en `docs/tasks/T-302.md`, gana la versión de `develop`; la carpeta `docs/revision-pr/pr-254/**` se conserva.

## BLOQUEANTE — PR254-R01 · Tres locators ambiguos rompen el E2E real

`e2e-preview` run `37542083437`, exacto sobre `8a39cab`, ejecutó T-302 y dejó **3 tests fallando**:

1. DoD de DNI duplicado: `page.getByRole('alert')` resuelve dos elementos, el alert real y `#__next-route-announcer__` de Next.
2. Flujo 1: `getByText('Moto')` resuelve dos elementos.
3. Flujo 2 de DNI duplicado: repite el `getByRole('alert')` ambiguo.

Se barrió la clase completa del spec: las únicas ocurrencias de esta clase son las líneas 296, 402 y 540 del SHA revisado.

**Corrección exacta:**
- En ambos casos de DNI, filtrar el `role=alert` por el texto de error esperado antes de afirmar visibilidad/contenido.
- En vehículo, usar el control semántico `role=radio` con nombre accesible `Moto`, hacer `check()` y afirmar `toBeChecked()`. No usar `getByText('Moto')`.

## BLOQUEANTE — PR254-H05 · La evidencia RED de R2 sigue sin ser una demostración reproducible

La nueva bitácora mejora la transparencia, pero no demuestra lo que afirma para H01/H02/H04: primero reconoce que el host local sin credenciales de Supabase corta en el guard fail-closed antes de ejecutar el flujo. Después describe mutaciones H01/H02 como si el E2E hubiera alcanzado las aserciones, pero no copia ninguna línea de fallo del test. H03 sí muestra un RED real, pero es un `actions.test.ts` unitario, no el E2E pedido. H04 describe un timeout, sin salida reproducible completa.

El runner remoto resolvió una parte de H05: ya sabemos que los E2E realmente se ejecutan. Pero el resultado final es rojo, no GREEN. Por eso H05 queda **parcial**.

**Corrección:** no fabricar ni reconstruir de memoria los RED. En la próxima entrada append-only, aclarar cuáles mutaciones E2E locales no alcanzaron el escenario por fail-closed y tratar el RED unitario H03 solo como evidencia complementaria. La condición para cerrar esta parte en la próxima ronda será un `e2e-preview` GREEN completo sobre el SHA ya sincronizado, más evidencia honesta de lo que sí/no pudo reproducirse localmente.

## CI observado sobre 8a39cab

- CI principal: ✅ success.
- Vercel: ✅ success.
- `e2e-preview`: ❌ failure, run `37542083437`.
- T-302 dentro del runner: DoD MFA ✅; Flujo 3 MFA/UI ✅; DoD DNI ❌; Flujo 1 ❌; Flujo 2 ❌.
- `approval-policy`: sigue rojo por falta de aprobación vigente de Lautaro073. No corresponde aprobar mientras existan estos bloqueantes.

## MEJORA no bloqueante

La bitácora corrigió correctamente en una entrada nueva que `de4ea3a...` fue un merge y no un rebase; no reescribió la sesión anterior.

## Decisiones para Lautaro073

Ninguna. Los tres bloqueantes tienen una resolución técnica determinada.