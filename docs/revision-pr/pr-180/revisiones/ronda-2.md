# Ronda 2 — PR #180 / T-307

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `0a70b6819e67a8c83c6b8ddb8a5f160ff5096240`  
**Resultado:** **CON BLOQUEANTES (2 + dependencia de infraestructura T-327)**

## Sincronización

- PR #180: `feat/T-307-notificaciones-resiliencia` → `develop`.
- En esta ronda `develop` estaba en `6577d9e427c5efc0a79a2c374f0f74d847732f4d`.
- Compare: **ahead 9 / behind 30**. La rama volvió a quedar atrás después de la corrección de Ronda 1.
- Entre esos commits nuevos está T-327, que incorpora el ambiente real de E2E por PR con Vercel Preview + Supabase Develop. La próxima corrección debe integrar `origin/develop` antes de generar nueva evidencia.

## Revalidación de hallazgos de Ronda 1

### PR180-H01 — ARREGLADO en su defecto original, pero aparece H05
El spec ya no usa `page.route(...).fulfill()`, `offerDelivered` ni dos `fetch()` manuales. Ahora autentica un comercio, inserta una oferta real y observa UI real.

Eso corrige el defecto original de Ronda 1. Sin embargo, el nuevo control todavía puede quedar verde por una carrera con el refetch inicial de TanStack; se registra aparte como **PR180-H05**.

### PR180-H02 — ARREGLADO SIN VERIFICAR
La implementación ya separa el formulario offline del refetch y cuenta únicamente:

```text
/api/live/requests/<requestId>/offers
```

No hay `/api/health` manual, `_rsc`, botón Reintentar ni fallback a `navigator.onLine`.

Falta la parte esencial del DoD: **demostrar RED al quitar `refetchOnReconnect` y GREEN al restaurarlo en un ambiente E2E real**. La bitácora reconoce que esa mutación no se ejecutó.

### PR180-H03 — ARREGLADO Y VERIFICADO
La ficha ya no declara el comando completo como verde: los checks se dejaron abiertos y el body/bitácora distinguen la evidencia disponible.

Además, CI del SHA `0a70b681...` fue GREEN (run `36972452441`): typecheck, lint, unit/coverage, workflow tests, ADR, db-tests, build, audit y bundle-budget.

Esto cierra el hallazgo de **evidencia falsa/contradictoria**. El DoD completo debe volver a ejecutarse después de integrar el último `develop`.

### PR180-H04 — ARREGLADO Y VERIFICADO
Los commits del agy de corrección (`062d296...` y `0a70b681...`) no tocaron `docs/revision-pr/pr-180/**`. La autorrevisión sigue preservada aparte y la carpeta volvió a la revisión independiente.

## BLOQUEANTES

### PR180-H05 — El E2E de Realtime todavía puede pasar por el refetch inicial
**Severidad:** alto · **Categoría:** test-coverage · **Patrón:** P08-control-no-cubre-lo-que-dice  
**Archivo:** `e2e/specs/notifications.spec.ts:122-149`

Secuencia actual:

1. `page.goto('/merchant/requests/<id>')`
2. `waitForNoSkeletons(page)`
3. verifica que el courier no se vea
4. inserta la oferta
5. espera que aparezca en UI

Pero `useRequestOffers` tiene `initialDataUpdatedAt: 0` + `staleTime: 0`, por lo que al montar realiza un refetch inicial a `/api/live/requests/<id>/offers`. El spec **no espera que ese request/response haya terminado antes de insertar**.

Si la oferta se inserta mientras ese fetch inicial todavía está en vuelo, ese mismo fetch puede leer la oferta y actualizar la UI aunque Realtime esté completamente roto. El timeout de 15 s descarta el polling de 30 s, pero no descarta este refetch inicial.

**Corrección obligatoria:** instalar el contador del endpoint exacto antes de navegar, esperar la **respuesta inicial 2xx completa**, fijar el baseline, recién después insertar la oferta y exigir tanto:
- una nueva request del endpoint (`count > baseline`) en < 30 s;
- la oferta visible en UI.

Con Realtime bloqueado temporalmente y sin polling dentro de esa ventana, el test debe quedar RED.

### PR180-H02 — Falta la demostración RED/GREEN real
Aunque la forma del control mejoró, todavía no existe evidencia independiente de que falle al mutar:

```ts
refetchOnReconnect: 'always'
```

a:

```ts
refetchOnReconnect: false
```

La frase de la bitácora “limitación local” ya no alcanza como cierre: T-327 creó un entorno Develop separado conectado a Vercel Preview.

## Dependencia de infraestructura — T-327 / issue #205

La infraestructura nueva está en `develop`, pero el workflow trusted `.github/workflows/e2e-preview.yml` ejecuta únicamente:

```text
e2e/specs/smoke.spec.ts
e2e/specs/main-flow.spec.ts
```

No ejecuta `e2e/specs/notifications.spec.ts`.

Como ese workflow se toma deliberadamente de la rama por defecto para impedir que una PR reescriba el job que recibe secretos, PR #180 **no puede modificar el workflow en su propia rama y usar esa modificación como evidencia trusted de sí misma**.

Se registró el follow-up directamente en issue **#205 / T-327**: debe existir una vía trusted para ejecutar `notifications.spec.ts` contra el Vercel Preview del SHA exacto con Supabase Develop. Hasta entonces, un status `e2e-preview` GREEN de smoke + main-flow **no cierra T-307**.

## Evidencia remota disponible

- Vercel deployment del SHA `0a70b681...`: READY.
- `https://cadeapp-develop.vercel.app/api/health`: HTTP 200 / `{"status":"ok"}`.
- No existe workflow run `e2e-preview` asociado al SHA `0a70b681...`; ese deployment ocurrió antes de que T-327 quedara disponible en `develop`.
- CI run `36972452441`: GREEN completo, pero no ejecuta `notifications.spec.ts`.

## Observación de evidencia del autor

La bitácora dice simultáneamente que Tests 1/B estaban bloqueados localmente por fail-closed y que la mutación H01 produjo RED + restauración GREEN. Esa afirmación no tiene una corrida remota asociada ni una salida reproducible en el SHA revisado, por lo que **no se usa como evidencia de cierre**.

## Informe revisar-pr

Informe revisar-pr — T-307 — 2026-10-02 — generado por revisión independiente  
Resultado: CON BLOQUEANTES (2 + dependencia T-327)  
Checks del SHA: CI general ✅ · Vercel Preview READY ✅ · health 200 ✅ · notifications E2E remoto ❌ no ejecutado

BLOQUEANTES:
- [`e2e/specs/notifications.spec.ts:122-149`] **PR180-H05:** la oferta puede entrar por el refetch inicial aún en vuelo y simular Realtime → esperar respuesta inicial, tomar baseline, insertar y exigir una segunda request + UI.
- **PR180-H02:** el control de reconexión está mejor estructurado pero falta demostrar RED con `refetchOnReconnect:false` y GREEN restaurado en Develop Preview.

DEPENDENCIA:
- **T-327/#205:** el gate trusted debe habilitar ejecución de `notifications.spec.ts`; hoy solo corre smoke + main-flow.

CERRADOS:
- PR180-H01 (defecto original mock/fetch manual) ✅
- PR180-H03 (evidencia falsa de DoD) ✅
- PR180-H04 (autorrevisión en carpeta independiente) ✅
- D01=1-A (T-206 en dependencias) ✅

No revisado / decisiones para Lautaro073:
- ninguna decisión pendiente en esta ronda.
