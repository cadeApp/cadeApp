# Ronda 1 — PR #179 / T-304

**Fecha:** 2026-10-01  
**SHA funcional:** `4718ce7fcd2714009776b3da2321e553d8ee2c86`  
**Resultado:** **CON BLOQUEANTES (5)**

## Preflight

- Rama `feat/T-304-request-states`, base `develop`.
- HEAD revisado `4718ce7fcd2714009776b3da2321e553d8ee2c86`.
- `develop...head`: ahead 4, behind 0; merge-base = `1457072a7cac1ae9e2a8a92abe9253d45b745082`.
- Diff funcional: `docs/tasks/T-304.md`, `docs/tasks/log/T-304.md`, `e2e/specs/request-states.spec.ts`.
- Comentarios/reviews previos: ninguno.
- El autor no tocó `docs/revision-pr/pr-179/**`.
- CI no consultado porque la ronda tiene bloqueantes.

## H01 · El archivo llamado E2E no atraviesa el sistema real · BLOQUEANTE

`e2e/specs/request-states.spec.ts:1-18` importa `test/expect` del runner, pero toda la lógica bajo prueba viene de `@/domain/states` y `@/domain/rpc-contracts`. Las transiciones se resuelven llamando directamente `transitionRequest()`, `transitionOffer()`, `getEffectiveRequestStatus()`, `isRequestExpired()` y `safeParse()`.

No hay:

- fixture `../fixtures`;
- `stagingContext`;
- usuarios autenticados reales;
- llamada a `publish_request`, `accept_offer`, `cancel_request`, `mark_picked_up`, `mark_delivered`, `report_no_show`, `courier_cancel_match`, `republish_request` o `report_incident`;
- lectura posterior de PostgreSQL para verificar estado persistido;
- browser/server action que atraviese la aplicación.

Playwright está actuando únicamente como runner de una matriz de dominio. Eso no satisface el objetivo “E2E de estados”, `e2e/AGENTS.md` ni la regla de que el E2E use staging/local con seed y cleanup.

**Corrección:** reemplazar estas comprobaciones como fuente principal por escenarios contra staging real. Los helpers puros pueden permanecer solo como pruebas unitarias existentes; no pueden contar para el DoD E2E.

## H02 · La suite declara efectos de §5.1 que nunca verifica en la fuente de verdad · BLOQUEANTE

Aunque la matriz pura fuera aceptada como complemento, faltan comprobaciones reales de los efectos que el propio PR afirma cubrir:

1. `draft → published`: campos obligatorios, elegibilidad real y `expires_at = now + request_ttl_minutes`.
2. `published → matched`: aceptación atómica real; una sola oferta `accepted`, restantes `rejected`, `accepted_offer_id` persistido.
3. `published → cancelled`: ofertas `pending → expired` persistidas.
4. expiración perezosa: una lectura/RPC real debe tratar la solicitud vencida como expirada; no alcanza `getEffectiveRequestStatus()`.
5. `matched → published`: motivo persistido, oferta aceptada cancelada y nuevo `expires_at`.
6. `matched → cancelled`: motivo persistido y efectos asociados.
7. `in_transit → delivered`: `delivered_at` real y ventana de incidentes.
8. `delivered → cancelled`: debe rechazarse por la RPC real, no solo por `canTransitionRequest()`.

Ejemplos: las líneas 121-122 simulan la atomicidad llamando dos veces `transitionOffer()`; las líneas 187-222 prueban expiración con fechas en memoria; las líneas 564-570 prueban la invariante crítica con helpers de dominio.

**Corrección:** cada fila debe observar el resultado persistido de la RPC/acción real y, cuando aplica, sus efectos laterales.

## H03 · La evidencia RED de la bitácora no es reproducible · BLOQUEANTE

`docs/tasks/log/T-304.md:7,12` afirma que las pruebas se escribieron primero y que hubo una fase RED, pero solo registra `expect(received).toBe(expected)`; no identifica:

- qué regla se rompió;
- qué archivo/símbolo se mutó;
- qué test cayó;
- qué comando produjo el rojo;
- salida suficiente para reproducirlo.

Además, el blob de `e2e/specs/request-states.spec.ts` en el primer commit funcional de la tarea y en el HEAD revisado es el mismo (`e6905a834759a24e04c0dd5072e1dcd522725f78`). El historial no muestra una transición de ese spec desde RED a implementación GREEN.

Esto no demuestra que el autor nunca haya hecho una mutación temporal; demuestra que **la evidencia registrada no permite verificarla**.

La misma entrada quedó obsoleta al decir que falta abrir el PR cuando #179 ya está abierto.

**Corrección:** no reescribir la sesión histórica. Agregar una nueva entrada de bitácora con mutaciones concretas y reproducibles sobre la suite E2E real, resultado RED, reversión y GREEN. No crear tests falsos ni modificar expectativas para fabricar el resultado.

## H04 · El cuerpo del PR no usa el template obligatorio ni contiene el informe de revisión del autor · BLOQUEANTE

El cuerpo actual usa “Descripción / Transiciones probadas / Evidencia”, pero `.github/pull_request_template.md` exige:

- Qué cambia;
- DoD copiado de la ficha;
- Evidencia de checks;
- checkbox de RED demostrado;
- bitácora al día;
- **Informe completo de la skill `revisar-pr`**;
- dependencias;
- seguridad cuando corresponda;
- rollback.

También declara “Bitácora al día” aunque la bitácora todavía dice “Falta: Abrir PR”.

**Corrección:** al terminar los arreglos, reemplazar el body por el template real y pegar el informe completo de auto-revisión del autor. No pegar este informe independiente como sustituto de la auto-revisión.

## H05 · §5.1 exige “admin — solo por incidente”, pero `cancel_request` no exige ningún incidente · BLOQUEANTE

La fuente de verdad dice en `docs/master-plan.md:103`:

`in_transit → cancelled | admin | Solo por incidente.`

El backend actual en `supabase/migrations/20260924010124_rpc_requests_v1.sql` permite al admin cancelar `in_transit` cuando cumple rol, AAL2 y motivo (zona aproximada 114-128), pero esa rama no consulta `public.incidents`. Los pgTAP existentes también consideran válida la transición admin directamente.

**Decisión D02 — 2-A, resuelta por Lautaro073:** “solo por incidente” es literal. Debe existir al menos un incidente registrado para esa solicitud antes de que el admin pueda cancelarla.

Esto no debe arreglarse silenciosamente dentro de T-304 porque cambia el contrato/RPC de T-103.

**Corrección:**

1. Crear un contract-change separado. `CC-014` ya está ocupado en una rama remota; al momento de esta revisión el siguiente identificador libre observado es **CC-015**.
2. El CC debe modificar la implementación/contrato y pgTAP correspondiente para que:
   - admin + `in_transit` + AAL2 + motivo + **sin incidente asociado** => rechazo;
   - misma solicitud con al menos un incidente registrado => puede cancelar;
   - `delivered → cancelled` continúa rechazado;
   - no se debilitan AAL2, roles ni motivo obligatorio.
3. Mergear ese CC a `develop`.
4. Recién entonces sincronizar T-304 y dejar en GREEN el E2E de la fila 9.

## 🔵 DECISIONES — RESUELTAS

### D01 — Alcance E2E
**1-A**, decidido por Lautaro073.

Se autoriza ampliar de forma acotada el arnés necesario para que T-304 use staging real, incluyendo los fixtures/seed y sus tests directamente necesarios. El seed solo prepara precondiciones y cleanup; **no puede ejecutar por service-role la transición que el test pretende demostrar**.

### D02 — Cancelación administrativa en tránsito
**2-A**, decidido por Lautaro073.

Debe existir un incidente real registrado antes de `in_transit → cancelled` por admin.

No quedan decisiones funcionales pendientes en esta ronda.

## Criterio para Ronda 2

No pedir nueva revisión hasta que:

- el spec deje de depender de funciones puras como prueba principal;
- cada fila relevante atraviese RPC/acción real y verifique persistencia;
- la evidencia RED sea concreta y reproducible;
- el PR use el template y contenga auto-revisión;
- el contract-change de “solo por incidente” esté integrado en `develop` y T-304 sincronizada;
- la suite real esté GREEN sin falsificar/adulterar pruebas.
