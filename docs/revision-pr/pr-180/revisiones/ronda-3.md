# Ronda 3 — PR #180 / T-307

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `ae0758b7c8f8fc88dd2a4201f738835faf200f48`  
**Resultado:** **CÓDIGO CORREGIDO / NO APROBABLE TODAVÍA — VERIFICACIÓN E2E T-307 BLOQUEADA POR T-327**

## Resumen

La corrección del agy resolvió correctamente por inspección los dos problemas funcionales de control que quedaban:

- **PR180-H05:** ahora espera el GET inicial, fija baseline antes del INSERT y exige una segunda request + UI.
- **PR180-H02:** ahora mide exclusivamente la query activa y separa correctamente offline/formulario de reconexión/refetch.

No encontré un nuevo defecto grande en esos flujos.

Sí encontré **PR180-H06**, un detalle de Playwright: el test leía `Notification.permission` inmediatamente después de registrar `page.addInitScript`, antes de una navegación donde dicho script pueda ejecutarse. Como es un fix mínimo, la revisión lo corrigió directamente moviendo la primera lectura después de `loginAsMerchant(page)`.

## Sincronización

Al iniciar Ronda 3:

```text
develop: cb4111273da663f7591aec370a44767c4e677b82
PR head: ae0758b7c8f8fc88dd2a4201f738835faf200f48
ahead: 13
behind: 5
merge-base: 8bfdd2c5e90584f5ac77c93557077f10e3d6fb9f
```

Los cinco commits nuevos de `develop` solo cambian workflows/tests de workflow. Antes del cierre final la rama debe volver a integrar `origin/develop`.

## H02 — arreglado sin verificar

El test B ya:
- espera response inicial 2xx;
- toma baseline;
- usa `setOffline(true/false)`;
- exige una nueva GET exacta de `/api/live/requests/<id>/offers`;
- no genera `/api/health` ni tráfico proxy.

Falta la prueba semántica obligatoria: RED con `refetchOnReconnect:false` y GREEN restaurado en Develop Preview.

## H05 — arreglado sin verificar

El test de Realtime ahora elimina la carrera del refetch inicial:
- listener exacto antes de navegar;
- response inicial completado;
- baseline;
- INSERT posterior;
- segunda request en <15 s;
- courier + monto visibles.

Falta RED con websocket Realtime bloqueado y GREEN restaurado en el ambiente real.

## H06 — fix mínimo del revisor

Se movió la primera aserción de `Notification.permission === 'denied'` después de `loginAsMerchant(page)`.

Motivo: `page.addInitScript` se evalúa con la navegación/nuevo documento. La expectativa anterior ocurría sobre el documento existente y podía fallar antes de ejercer T-307.

No se cambia producto; solo se alinea el test con el contrato de Playwright. Queda sin verificar hasta que corra el spec remoto.

## CI y Preview

### CI general

Run `37035483999`: **GREEN**.

typecheck, lint, unit/coverage, workflow tests, ADR, db-tests, build, audit y bundle-budget: ✅.

### e2e-preview

Run `37035612143`: **RED**, pero el fallo es:

```text
T-303 Flow 4
Expected: E2E Courier Doc2 ...
Received: Repartidor
```

Es el problema conocido de **#200 / CC-016**, no un fallo introducido por T-307.

El gate de ese run ejecutó:
- `main-flow.spec.ts`
- `smoke.spec.ts`

**No ejecutó `notifications.spec.ts`.**

Por lo tanto:
- el rojo global no se carga a T-307;
- tampoco existe todavía evidencia GREEN de T-307.

## Dependencia T-327 / #205

El ambiente Develop + Preview existe y funciona. El hueco restante es específico del runner trusted: debe incluir `notifications.spec.ts` o una vía trusted equivalente.

La revisión actualizó issue #205 con el run real de PR #180. No se modifica `.github/**` desde T-307.

## Estado

- PR180-H01 ✅ arreglado-verificado
- PR180-H02 🟡 arreglado-sin-verificar
- PR180-H03 ✅ arreglado-verificado
- PR180-H04 ✅ arreglado-verificado
- PR180-H05 🟡 arreglado-sin-verificar
- PR180-H06 🟡 arreglado-sin-verificar; fix mínimo aplicado por revisión
- D01 ✅ aplicada
- T-327/#205 🔴 bloquea la verificación E2E final

No hay decisiones 🔵 pendientes para Lautaro073.

## Informe revisar-pr

Informe revisar-pr — T-307 — 2026-10-02 — generado por revisión independiente  
Resultado: CÓDIGO CORREGIDO / VERIFICACIÓN E2E T-307 PENDIENTE  
Checks: CI general ✅ · Preview/health ✅ · gate trusted ejecutado ✅ pero notifications.spec.ts no incluido · e2e-preview global ❌ por #200/T-303

No aprobar ni mergear todavía.
