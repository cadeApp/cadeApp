# Informe de revisión independiente — PR #587 / T-421 · Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/587
**SHA revisado:** `2512a3735ff7ce10d67a0e846218a6f3e4e74e36`
**Base:** `develop` @ `146c9f9749dbc7fa20b63583cbc9b3c939cdc339`
**Fecha:** 2026-11-04 · **Resultado: CON BLOQUEANTES (2 nuevos), 7/7 hallazgos de R1 atendidos en documentación.**

## Resumen

| Hallazgo | Resultado R2 | Evidencia |
|---|---|---|
| PR587-H01 | Corregido documentalmente | `CC-043` define `finalize_courier_application`; T-421 permite la acción y tests |
| PR587-H02 | Corregido documentalmente | Reintento de histórico `application_submitted=true, submitted_at=null` devuelve `null` sin sobrescribir |
| PR587-H03 | Corregido documentalmente | Auth/confirm, guards, sesión, login, cambio de contraseña, perfil y modo edición migran a la marca nueva |
| PR587-H04 | Corregido documentalmente; pendiente pgTAP de ejecución en T-421 | Trigger exige GUC local **Y** `current_user` dueño de función `security definer`; prueba de suplantación definida |
| PR587-H05 | Corregido documentalmente | Compatibilidad CC-042, nuevo seed con RPC y fixtures sin resetear envíos |
| PR587-H06 | Corregido documentalmente | Se distingue RLS SELECT PostgREST sin AAL2 frente a la RPC protegida; T-408 sigue pendiente |
| PR587-H07 | Corregido documentalmente | `raise notice` solo del número de históricos con documentos incompletos, sin inventar fechas |
| **PR587-H08** | **NUEVO BLOQUEANTE (alto)** | Ventana de despliegue permite éxito de writer viejo sin marca nueva |
| **PR587-H09** | **NUEVO BLOQUEANTE (medio)** | RPC de finalización acepta patente inválida/para vehículo sin matrícula |

## H08 · Escritura antigua silenciosa durante el rollout

**Archivo:** `docs/contracts/CC-043.md:214-227` (sección «Compatibilidad, rollout y rollback») y `docs/tasks/T-421.md:39-45`. **Estado:** [ANÁLISIS] · **Severidad:** ALTO · **Patrón:** P08-control-no-cubre-lo-que-dice.

### Diagnóstico

CC-043 reconoce expresamente que `migrate-*` se ejecuta antes de `deploy-*` y que la versión antigua de `courierOnboardingAction` ejecuta `createAdminClient().from('couriers').update({dni_hmac,vehicle_type,vehicle_plate})` sin cambiar ninguna columna nueva. El trigger propuesto solo rechaza escrituras directas de `application_submitted` o `submitted_at`. Por eso, una solicitud que se complete durante la ventana de despliegue puede recibir un **OK verdadero del UPDATE antiguo** pero persistir `application_submitted=false`. Los lectores nuevos la envían de vuelta a onboarding y la pestaña `pending` no la cuenta ni lista. No hay reparación transaccional especificada; un backfill posterior no podría reconstruir el timestamp real.

**Riesgo demostrado por lectura de ambas definiciones, no reproducido en SQL**, porque todavía no hay migración de CC-043 y no se levantó Supabase.

### Arreglo técnico

En CC-043 y T-421 definir una **compatibilidad segura de corte**, de preferencia **fail-closed** para el escritor viejo: el trigger rechaza el intento de primer DNI/vehículo persistido sin finalizar por RPC, en vez de dar éxito engañoso. Apuntar al patrón **antiguo** (primer `dni_hmac` y vehículo en la misma operación), no prohibir globalmente `vehicle_type:null→valor`, porque CC-042 permite crear el vehículo antes de enviar. Si se elige una compatibilidad temporal que sí procese el escritor viejo, deberá ejecutar las mismas validaciones bajo lock y registrar fecha en ese momento, retirarse de forma versionada y probarse; no basta el backfill posterior. Documentar qué error verá la versión vieja durante el deploy y cómo reintenta el repartidor con la nueva. No inventar fechas.

### Prueba exigida

pgTAP: después de migrar, ejecutar bajo `service_role` un UPDATE con el payload exacto de `courierOnboardingAction` anterior sobre un `courier` con documentos y sin envío; debe **fallar explícitamente** o finalizar correctamente con marca y fecha válidas, **nunca** terminar con éxito y `application_submitted=false`. Mutación RED: desactivar temporalmente la protección transitoria y comprobar que la aserción detecta el éxito incorrecto. E2E de transición en entorno permitido; no modificar CI ni la UI en PR #587.

## H09 · La validación de patente existe solo en el formulario

**Archivo:** `docs/contracts/CC-043.md:73-86`, función `finalize_courier_application`. **Estado:** [ANÁLISIS] · **Severidad:** MEDIO · **Patrón:** P08-control-no-cubre-lo-que-dice.

### Diagnóstico

La RPC valida `p_vehicle_type` y `p_vehicle_plate` de **hasta 20 caracteres**, pero no define la regla existente de `src/features/courier-onboarding/schemas.ts:12-18,56-79`: patente argentina obligatoria para `moto`/`car` y nula para `bike`/`walk`. La tabla base `couriers` tampoco tiene CHECK de formato de patente. `service_role` es confiable y el formulario actual valida correctamente; esto **no** es una vía de ataque desde `anon`, sino una omisión de invariante al implementar un escritor privilegiado nuevo que será utilizado también por el seed E2E.

### Arreglo técnico

Reutilizar exactamente los formatos permitidos por `ARGENTINA_PLATE_REGEX`, incluidos los modelos viejos: `AB 123 CD`, `A 123 BCD`, `ABC 123`, `123 ABC` y variantes de espacios admitidos. La función valida y normaliza `upper(btrim(p_vehicle_plate))`: para `moto/car`, valor no nulo y regex equivalente (y máximo 20); para `bike/walk`, valor nulo; cualquier otro caso `VALIDATION_ERROR` sin tocar columnas. Mantener `courierOnboardingSchema` como validación de UX, pero no como única autoridad. Añadir pgTAP de cada patrón válido e inválido y mutaciones que quiten formato/obligatoriedad/ausencia de patente en bicicleta. Ajustar DoD T-421, sin ampliar código de esta PR documental.

## NO TOCAR / errores descartados

- **H04 no sigue abierto por la sola presencia de `set_config`**: la guardia por dueño adicional, si se implementa tal como describe el CC, distingue `current_user` privilegiado de roles PostgREST. El límite del dueño o superusuario está explícito. Queda pendiente **probar SQL**, no inventar bypass.
- **H02:** un histórico puede conservar `submitted_at=null`; la idempotencia no debe ponerle fecha por reintento.
- **H06:** no exigir MFA en todo PostgREST dentro de T-421; Lautaro073 aceptó mantener ese riesgo hasta T-408.
- **H07:** backfill por vehículo es decisión aprobada; diagnosticar documentos incompletos no cambia el conjunto histórico.
- El comentario de coordinación de T-419 ya existe: https://github.com/cadeApp/cadeApp/issues/573#issuecomment-6623990161.
- No ejecutar SQL, Supabase remoto, Docker ni crear mutaciones de seguridad expuestas en Preview desde esta PR de documentos.

## Evidencia de revisión / límites

1. Leí CC-043, CC-044, T-421, T-403, T-404, la fila T-421 del plan y `docs/tasks/log/T-421.md` **del SHA exacto**. Comparé la corrección con los siete hallazgos de R1 y con el código actual `actions.ts` y `schemas.ts` en develop.
2. Comparación remota `ee077bcd…2512a373`: seis archivos documentales (incluida bitácora); ninguna edición del autor en `docs/revision-pr/pr-587/**`. En el compare de `develop` contra el SHA, 3 commits ahead y 0 behind. GitHub informa `mergeable=true`, **no** equivale a ejecutar `git merge-tree`.
3. Batería **independiente de mutaciones textuales en memoria** sobre el contenido de GitHub: **12/12 baseline GREEN, 12/12 mutaciones RED**. Prueba solo que las cláusulas están escritas en el documento; no valida su SQL futuro. Script íntegro en `evidencia/comandos.md`.
4. Intento de clon local `git ls-remote`: `Could not resolve host: github.com`. Por eso **no** reejecuté los 91 Vitest de la bitácora, `git diff --check`, `git merge-tree` ni `node docs/revision-pr/analizar.mjs verificacion` en un clon.
5. GitHub CI estaba **en progreso** al comienzo de esta revisión; no lo uso como aprobación con dos bloqueantes.
6. Corregí la descripción obsoleta de la PR (texto de trigger de R1 y afirmación general de MFA), cambio de **metadata**, sin modificar archivos del autor. El commit de esta ronda toca solo `docs/revision-pr/pr-587/**`.

## Para R3

Revisar que desaparezca el estado silencioso durante la ventana de rollout; comprobar que la SQL de finalización exige todas las reglas de patente. En esta PR bastan contratos, fixtures/pgTAP **especificados** y coherencia con T-421; el runtime se revisará en la PR de implementación. Una vez corregidos estos dos bloqueantes, verificar cuerpo/CI del SHA y recién entonces considerar merge.
