# Informe de revisión — PR #143 / T-318 — Ronda 1

**Head SHA revisado:** `d843026b9d0e951278c954fdde7494dddbd88f56`  
**develop actual:** `ec3c671db6f5ae5664f929925f5a77209bd57682`  
**Fecha:** 2026-09-30

## Resultado

**CON BLOQUEANTES (2).**

La separación documental pedida en la Ronda 2 de #142 se ejecutó correctamente: la PR toca solo la ficha y su fila del plan. Sin embargo, la rama quedó desactualizada respecto del `develop` actual y la ficha conserva una contradicción de seguridad con la decisión 2-A.

## BLOQUEANTES

### PR143-H01 — ALTO · la PR está 8 commits detrás de develop

`compare develop...d843026b9d0e951278c954fdde7494dddbd88f56`:
- `behind_by = 8`
- `ahead_by = 1`
- estado: diverged.

Los ocho commits nuevos son principalmente T-301/E2E y no muestran un conflicto semántico directo con T-318, pero una ficha no se valida ni mergea contra una base vieja.

**Corrección:** mergear `origin/develop` dentro de `docs/T-318-ficha` sin rebase, amend ni force-push; resolver cualquier conflicto conservando el contenido actual de T-318 y volver a verificar que el diff propio siga siendo solo ficha + plan.

### PR143-H02 — ALTO · la ficha todavía deja un canal de enumeración en códigos explícitos

La decisión 2-A y el objetivo de la ficha dicen que el cliente no debe poder averiguar si un email ya tiene cuenta.

El primer DoD corrige bien el caso sanitizado:
- signup válido nuevo y `identities: []` deben tener mismo `ok`, mismos campos públicos y misma navegación.

Pero el tercer ítem todavía dice:
- `user_already_exists` / `email_exists` → `VALIDATION_ERROR`.

Eso vuelve a introducir la diferencia pública:
- alta válida → resultado de éxito;
- esos códigos → `ok:false`.

El copy puede ser neutro, pero el booleano del `ActionResult` sigue siendo observable.

La fuente actual de Supabase distingue dos caminos cuando el usuario ya existe:
- con autoconfirm desactivado, devuelve usuario sanitizado HTTP 200;
- con autoconfirm activado, puede devolver `user_already_exists`.
La propia documentación avisa que el signup intenta ocultar la existencia de cuentas y `sanitizeUser` existe explícitamente para evitar esa filtración.

**Corrección:** la ficha debe tratar TODA señal que signifique “cuenta existente” de forma no enumerable. Si `user_already_exists` o `email_exists` llegan, tampoco pueden terminar en un resultado público distinguible del alta válida. No hace falta agregar un código de dominio nuevo: se puede exigir un camino público neutral de éxito para esos casos, separado del mapper de errores genuinos de datos.

Actualizar:
1. Objetivo/DoD para incluir explícitamente estos códigos en la indistinguibilidad, no solo en el copy.
2. Prueba comparativa para cubrir alta nueva vs `identities: []` **y** alta nueva vs códigos explícitos de cuenta existente.
3. Mantener `weak_password`, `email_address_invalid`, `validation_failed` como `VALIDATION_ERROR`; rate limits como `RATE_LIMITED`; operativos/desconocidos como `INTERNAL_ERROR`.

## MEJORAS

Ninguna adicional.

## Checks observados

Exact-head `d843026b9d0e951278c954fdde7494dddbd88f56`:
- `verify-fichas` ✅ 7/7
- unit ✅ 103 archivos / 1383 tests
- typecheck ✅
- lint ✅
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅
- approval-policy ❌ únicamente por faltar informe independiente SIN BLOQUEANTES.

## No revisado / dudas

- No se usó Supabase remoto ni cuentas reales.
- No aprobé ni mergeé la PR.
