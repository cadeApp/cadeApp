# Informe de revisión — PR #359 / T-360 — ronda 1

**Fecha:** 2026-10-15
**SHA de código examinado:** `65997dd27f652cf4d00aa616b1d26c46d16fd3e0`
**Base:** `develop` @ `14c28ed3c41cb2bde92705fc018c7dd0df73245b`
**Resultado:** CON BLOQUEANTES (2) · Draft · NO MERGEAR
**Tipo:** revisión estática de la PR inicial SIN implementación. No es una certificación del comportamiento futuro.

## Decisiones de Lautaro073 (confirmadas)

- **1-A**: `getActiveTripsForCourier()`, sesión y RLS, matching real de `accepted_offer_id`, `offers.courier_id`, `offers.status`, `request_id`, y `delivery_requests.status` activo.
- **2-A**: sección «Mis viajes activos» debajo del toggle y arriba de «Solicitudes abiertas»; oculta cuando éxito con 0, pero error/loading diferenciados, y visible aun con disponibilidad OFF.
- **3-A**: texto compacto «N entregas» sin datos de contacto/direcciones.
- **4-A**: TanStack Query + invalidación Realtime + foco/reconexión/polling.

## Resumen

PR #359 @ `65997dd27f652cf4d00aa616b1d26c46d16fd3e0` incorpora únicamente `docs/tasks/log/T-360.md`. El autor declaró en la bitácora que tests e implementación están pendientes. Por ser Draft, esto **no prueba un defecto de lógica** del código futuro; impide aprobar el DoD hoy.

### PR359-H01 — BLOQUEANTE ALTO — Funcionalidad ausente

**Archivo de inserción:** `src/features/offers/components/courier-feed.tsx`, `src/features/trips/queries.ts`, `src/app/(courier)/courier/feed/page.tsx`.

**Evidencia [ANÁLISIS]:** diff de la PR: un solo archivo, bitácora (+13 líneas). `CourierFeed` actual muestra toggle y solicitudes abiertas sin sección de viajes. No existe proyección activa, SSR, acción de refresco ni hook de viajes.

**Arreglo:** seguir los pasos 1 a 4 del prompt publicado en el mismo comentario de GitHub. Autenticación y matching real, sin usar `getTripDetails` (datos privados). Cuidar `accepted_offer_id`/FK compuesta, `drops_count`, nulos multi-drop.

**Cómo verificar:** unit tests de query y DOM 0/1/N, sesión, rechazos, status, disponibilidad OFF, carga/error, privacidad, integración con refetch.

### PR359-H02 — BLOQUEANTE ALTO — Pruebas/evidencia faltantes

**Archivo de inserción:** `src/features/trips/queries.test.ts`, `src/features/offers/courier-panel.test.tsx`, `src/app/(courier)/courier/feed/page.test.tsx`, `e2e/specs/main-flow.spec.ts`.

**Evidencia [ANÁLISIS]:** bitácora indica typecheck/lint/test y mutaciones RED como pendientes; la PR no contiene test nuevo ni E2E T-360.

**Arreglo:** pasos 5 a 7 del prompt; registrar salidas y SHA auténticos. Las mutaciones del autor **no sustituyen** la batería independiente que deberá crear el revisor sobre la implementación en ronda 2.

**Cómo verificar:** reproducción RED de comportamiento faltante → GREEN implementado; mutaciones concretas deben matar cada test; E2E en Preview + Supabase Develop y enlace de run.

## Seguridad / contratos: elementos leídos, no verificados en ejecución

- `delivery_requests` **NO** tiene `courier_id`; sí `accepted_offer_id`. `offers` tiene `courier_id`, `request_id`, `amount_ars`, `status`.
- Migración CC-023 otorga SELECT por columna sobre `delivery_requests`, incluida `accepted_offer_id`; T-340 agrega `drops_count` con SELECT.
- RLS `delivery_requests_select_courier` filtra asignación real por `accepted_offer_id`.
- `src/lib/hooks/use-realtime-invalidation.ts` ya soporta `delivery_requests` y `offers`, invalidación en reconexión.
- La ficha en develop incluye una nota «esta PR solo publica fichas», contradictoria con la PR de implementación. Se registra la autorización explícita de Lautaro073 para implementar T-360 en #359, **sin** modificar contratos ni ficha.

## NO TOCAR

- No hacer cambios en RLS, RPC, tipos generados, `src/domain/**`, `src/ui/**`, migraciones ni CI.
- No consultar `delivery_request_contacts` ni `delivery_request_drop_contacts` para crear feed resumido.
- No atribuir pruebas no corridas al autor o al revisor.
- No usar el campo `offers.status='accepted'` como único criterio de viaje vigente.

## Checks y metodología

| Comprobación | Resultado |
|---|---|
| Diff PR y SHA | [INSPECCIÓN REMOTA] solo bitácora |
| Ficha desde develop | [LECTURA] |
| Código cliente/server, RLS y grants | [LECTURA] |
| `pnpm typecheck` | NO EJECUTADO; no hay clon ejecutable en esta sesión |
| `pnpm lint` | NO EJECUTADO |
| `pnpm test` | NO EJECUTADO |
| `pnpm test:db` | n.a. (sin CC/migraciones) |
| E2E Preview | NO EJECUTADO sobre la funcionalidad inexistente |
| Mutaciones independientes | NO APLICAN todavía; se crearán al recibir implementación |

**No afirmar `verificado_en_sha`**: solo observación documental y arquitectónica. El informe completo y prompt detallado se publican **juntos en un único comentario** de la PR. Esta revisión no aprueba ni mergea.
