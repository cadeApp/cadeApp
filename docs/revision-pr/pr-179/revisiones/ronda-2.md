# Ronda 2 — PR #179 / T-304

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `08426ca79bd81e97208a209eff9e81843e7fee66`  
**develop actual:** `169b60bb3771fb794184b5a2da5714107391ecd0`  
**Resultado:** **CON BLOQUEANTES (6)**

## Preflight

- PR abierta y Draft.
- GitHub reporta mergeable, pero la rama está **ahead 9 / behind 26** respecto de develop.
- merge-base: `640bc4cd6f86a85f8a7fb235f123a182ac6c2163`.
- Desde el merge-base, develop modificó `src/server/e2e/staging-seed.ts` y `src/server/e2e/staging-seed.test.ts`, además de incorporar el gate `e2e-preview`.
- El autor no modificó `docs/revision-pr/pr-179/**`.
- CI general del SHA `08426ca79bd81e97208a209eff9e81843e7fee66`: GREEN.
- Vercel desplegó el Preview del SHA.
- El status del commit contiene Vercel pero **no** `e2e-preview`.
- La Ronda 2 no aprueba ni mergea.

## Estado de hallazgos R1

### H01 — mejora estructural confirmada
El spec ya importa `../fixtures`, autentica merchant/courier/admin, invoca RPCs reales y relee PostgreSQL mediante `getRequestInspectionData`.

**Estado:** arreglado estructuralmente; su ejecución real queda bloqueada por H06/H07/H08.

### H02 — mejora parcial
Ya existen asserts persistidos para estados, ofertas y timestamps. Quedan huecos contractuales agrupados en H09.

### H03 — SIGUE BLOQUEANTE
La nueva bitácora registra cuatro mutaciones, pero todas ejecutan:

`pnpm vitest run src/domain/domain.test.ts`

y rompen `src/domain/states/index.ts` o `src/domain/testing/rpc-fake.ts`.

Eso demuestra unitarios de dominio/fake, **no** que `e2e/specs/request-states.spec.ts` detecte una regresión en auth/RPC/persistencia real.

Ahora existe Supabase Develop + Vercel Preview para correr ese spec. La evidencia RED debe incluir una corrida del **Playwright real**.

### H04 — formato arreglado
El body usa la estructura requerida y contiene auto-revisión. Debe actualizarse al final porque hoy todavía marca como cumplidos DoD que esta ronda reabre.

### H05 — VERIFICADO
CC-015 fue mergeada por PR #181 y la rama contiene la regla 2-A.

---

## H06 · El seed inserta la offer antes del request que exige la FK · BLOQUEANTE

En `src/server/e2e/staging-seed.ts`:

- línea ~1472 detecta estados post-match;
- línea ~1486 ejecuta `admin.from('offers').insert(... request_id: requestId ...)`;
- recién en línea ~1511 inserta `delivery_requests`.

El esquema vigente define:

`offers.request_id uuid not null references public.delivery_requests(id)`

con FK inmediata.

Por lo tanto, cualquier `seedDeliveryRequestInState` para `matched`, `in_transit` o `delivered` intenta crear una oferta huérfana y debe fallar en Supabase real. Los tests unitarios no lo detectan porque sus mocks aceptan el insert sin aplicar FKs.

**Corrección requerida:** request primero con `accepted_offer_id = null`; luego offer; luego update acotado del request para enlazar `accepted_offer_id`. Comprobar errores de las tres operaciones y agregar unit test que verifique el orden.

## H07 · El spec nuevo no está conectado al gate E2E de Preview ni Staging · BLOQUEANTE

La fuente de verdad E2E actual dice que las PR internas corren contra su Vercel Preview con Supabase Develop.

Sin embargo, `.github/workflows/e2e-preview.yml` ejecuta únicamente:

- `e2e/specs/smoke.spec.ts`
- `e2e/specs/main-flow.spec.ts`

y `e2e-staging.yml` tampoco ejecuta `request-states.spec.ts`.

En el SHA revisado Vercel está GREEN, pero no existe status `e2e-preview` para ese SHA. El body dice que espera `e2e-staging`, pero el entorno correcto para una PR interna es ahora **Preview + Supabase Develop**.

**Resolución de infraestructura:** el revisor abrió PR #207 (`fix/e2e-request-states-gate`) para integrar el spec en los gates confiables sin mezclar ese cambio compartido dentro de la PR funcional de asako. El SHA final de #207 (`5180fd43409b2b7c07f7a4b29eb61bbd1a3da749`) tiene CI completo GREEN. Queda pendiente únicamente el merge explícito de P1.

**El autor de T-304 no debe tocar workflows.** H07 es una dependencia externa de R3 hasta que #207 esté mergeada.

## H08 · Fila 4 espera un error distinto al contrato vigente · BLOQUEANTE

`request-states.spec.ts` línea ~247 espera:

`cancel_request` sobre una request `published` vencida → `INVALID_STATE_TRANSITION`.

Pero CC-015/request_cycle vigente valida explícitamente antes:

`published && expires_at <= now() && cancel_request → REQUEST_EXPIRED`.

Por lo tanto, aun arreglando el seed, el E2E real de Fila 4 debe quedar rojo.

**Corrección:** esperar `REQUEST_EXPIRED` y documentar que esa es la precedencia contractual real. No cambiar la RPC para acomodarla al test.

## H09 · “Cubre cada fila de §5.1” todavía tiene huecos observables · BLOQUEANTE

La suite mejoró, pero el checkbox de cobertura total todavía no está sustentado:

1. **draft → published:** §5.1 exige `expires_at = now + request_ttl_minutes`, pero el test hardcodea 40–50 minutos. Debe leer `request_ttl_minutes` real y comparar contra ese valor. También falta el negativo de piloto/suscripción inactiva.
2. **matched → published:** §5.1 exige registrar el motivo y contarlo para admin. La suite verifica estado/offer/TTL, pero no inspecciona `request_cancellation_reasons` o la fuente persistida equivalente.
3. **matched → cancelled:** §5.1 dice que se notifica al repartidor. El test verifica estado/motivo/offer, no el efecto de notificación. Si ese efecto aún no existe en backend, reportarlo como gap contractual; no fingirlo.
4. **in_transit → delivered:** solo prueba un incidente dentro de 24 h. Falta una request con `delivered_at` >24 h que demuestre `INCIDENT_WINDOW_EXPIRED`.
5. **admin in_transit → cancelled:** después de elevar AAL2 falta demostrar la precedencia `REASON_REQUIRED` con motivo vacío.

Hasta cubrir estas precondiciones/efectos, no marcar “cubre cada fila” como terminado.

## H10 · La rama está 26 commits detrás de develop y hay overlap en el arnés E2E · BLOQUEANTE

`develop...head` al revisar:

- ahead: 9
- behind: 26
- merge-base: `640bc4cd6f86a85f8a7fb235f123a182ac6c2163`

Los commits faltantes incluyen el nuevo `e2e-preview` y cambios en:
- `src/server/e2e/staging-seed.ts`
- `src/server/e2e/staging-seed.test.ts`

Por eso no alcanza revalidar sobre el SHA viejo.

**Corrección:** merge normal de `origin/develop`, sin rebase/force, resolver preservando ambas ramas y repetir toda la evidencia sobre el nuevo HEAD.

## RED/GREEN requerido para R3

Primero corregir H06/H08/H09 y sincronizar `origin/develop`. Cuando P1 haya mergeado #207, empujar el nuevo HEAD de T-304 para que el trusted gate de Preview ejecute automáticamente `request-states.spec.ts` contra Supabase Develop. La evidencia RED/GREEN debe provenir de ese Playwright real; los mutation tests unitarios quedan solo como complemento.

Después:
- corregir H06/H08/H09;
- volver a desplegar Preview;
- exigir status `e2e-preview = success` del HEAD exacto;
- conservar los unit mutation tests como evidencia complementaria, no como sustituto del Playwright real.

No tocar expectativas para fabricar el RED y no usar `.skip`/`.only`.

## Criterio para Ronda 3

- behind = 0;
- seed FK correcto;
- Fila 4 alineada con `REQUEST_EXPIRED`;
- huecos de H09 cubiertos o gap de backend explícitamente reportado;
- PR #207 mergeada por P1 y presente en `develop`;
- Preview gate ejecuta `request-states.spec.ts` sobre el SHA exacto de T-304;
- Staging gate preparado por #207 para ejecutar el mismo spec cuando exista en el SHA;
- RED real del Playwright documentado;
- GREEN exact-head de `e2e-preview`;
- DoD/body/bitácora actualizados sin falsos verdes.
