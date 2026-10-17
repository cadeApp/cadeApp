# Ronda 1 — T-365 / PR #390 — 2026-10-17

**Resultado:** CON BLOQUEANTES PARA MERGE. Draft inicial, aún sin código de producto.
**SHA revisado:** `6f8ff6d81862e21c622c0e5d88a803867d68f403`. No atribuir verificación posterior a este SHA.
**Alcance confirmado:** único archivo de diff `docs/tasks/log/T-365.md` (+32/-0), autorizado por la ficha. Sin cambios contractuales ni productivos.
**Branch:** `develop` avanzó dos commits después del punto de bifurcación; GitHub informa mergeable=true, **no se ejecutó** `git merge-tree`.

## Decisiones ya tomadas (no pendientes)
- **1-A:** CC separado y luego RPC `SECURITY DEFINER` de solo lectura, autorizada por comercio dueño o cadete actor, que proyecta `request_cancellation_reasons`, sin abrir SELECT general.
- **2-A:** cronología de cancelación de ASIGNACIÓN dentro del detalle del pedido, incluso mientras `delivery_requests.status='published'`; no contaminar historial terminal.
- **3-A:** categoría de motivo con lista permitida y fallback seguro; no exponer texto arbitrario `reason`.

## Hallazgos para resolver ANTES de mergear

- **PR390-H01 / BLOQUEANTE / implementación ausente:** `docs/tasks/log/T-365.md:7`. La rama contiene solo diagnóstico. Es coherente con un Draft de inicio, pero NO cumple DoD, no es mergeable como arreglo. Ningún test o código del caso fue incorporado.
- **PR390-H02 / BLOQUEANTE contractual:** `docs/tasks/log/T-365.md:26`. El registro de cancelación existe, pero `request_cancellation_reasons` está cerrado a actores no admin (migración `20260924010124_rpc_requests_v1.sql:2-19`). El evento almacena `request_id,offer_id,actor_id,action,reason,created_at`. Hace falta CC aprobado, no atajo RLS ni service-role para cliente. Evitar invenciones de tabla `trips`.
- **PR390-H03 / BLOQUEANTE funcional (baseline):** `src/server/live/t204.ts:313`: `getRequestOffersLiveServer` consulta todas las ofertas; el contrato `src/lib/live-contracts.ts` rechaza `status='cancelled'` y `'expired'`, y `use-request-offers.ts` parsea la respuesta. Filtrar `pending` *antes* de paginar, con tests que detecten la ausencia de filtro.
- **PR390-H04 / BLOQUEANTE funcional (baseline):** `src/features/requests/queries.ts:966`: la precarga SSR `getMerchantRequestWithOffers` tampoco filtra; no basta con corregir solo la API live. Mantener el orden/cursor y proyección CC-016.
- **PR390-H05 / BLOQUEANTE stale (baseline):** `src/features/requests/components/request-offers-list.tsx:380` dibuja CTA Aceptar incondicional para filas; `selectedOffer` puede persistir tras invalidación. Exigir `offer.status==='pending'` y estado de solicitud elegible, protección de modal/confirmación, invalidación/refetch; SQL `accept_offer` ya valida `pending`, no sustituirlo por UI.
- **PR390-H06 / BLOQUEANTE de UX/semántica (baseline):** `src/features/requests/components/merchant-history-view.tsx:78` y `getMerchantHistoryRequests` filtran estados terminales `delivered,cancelled,expired`, por lo que la cancelación del cadete seguida de `published` desaparece de ese historial. Conforme decisión 2-A, añadir cronología de eventos al detalle, no relajar filtro terminal.
- **PR390-H07 / BLOQUEANTE de privacidad del contrato a crear:** `src/features/trips/schemas.ts:8-11` admite texto libre hasta 500 caracteres; una RPC que devolviera el texto a otros usuarios podría exponer datos arbitrarios. Proyectar solo categoría permitida con fallback y actor autorizado. Es una precaución de diseño pendiente, no una filtración actual demostrada.
- **PR390-H08 / BLOQUEANTE de evidencia:** `docs/tasks/log/T-365.md:29` lista 341 tests del baseline y reconoce RED/GREEN, E2E pendientes. Requeridos: tests de consulta ambos caminos, estado terminal, modal stale, rematch, concurrentes/idempotencia (y pgTAP/E2E para CC). No afirmar GREEN del fix por baseline.
- **PR390-H09 / MEJORA operativa:** la rama `6f8ff6d` está 2 commits detrás del `develop` actual `50c99b00`. Integrar con `git merge origin/develop`, nunca rebase ni force, y conservar ficha `develop`.

## Mejora editorial
El cuerpo actual de la PR usa barras invertidas/símbolos de control donde deberían ir backticks, y contiene `Closes #353` antes de implementar el bug. Reparar Markdown y no cerrar el issue anticipadamente. Marcar DoD no completado sin falsos `[x]`.

## Análisis estático de SQL ya existente
En `supabase/migrations/20261013140000_t340_clean_legacy.sql:514-544` (version vigente inspeccionada), al cancelar se cambia la oferta aceptada a `cancelled`, las ofertas pendientes a `expired`, se inserta registro en `request_cancellation_reasons` y el request vuelve a `published`. `supabase/migrations/20260923170000_rpc_accept_offer_v1.sql:133-136` exige `pending` para aceptar. Lo anterior fundamenta la clasificación **por inspección**, NO equivale a ejecución pgTAP ni seguridad probada.

## Chequeos, evidencia y límites
- Lectura independiente de PR patch, bitácora, ficha desde develop, comentarios, fuentes TS y migraciones.
- `pnpm typecheck`: **NO EJECUTADO**. `pnpm lint`: **NO EJECUTADO**. `pnpm test`: **NO EJECUTADO**. `test:db`: **NO EJECUTADO**. `E2E Preview`: **NO EJECUTADO**.
- GitHub connector confirmó diferencia de 1 archivo, rama diverged (2 behind / 2 ahead), y condición draft. No clon local accesible por DNS; no fabricar logs.
- Mutaciones RED/GREEN **PENDIENTES** hasta que exista código corregido y se disponga de checkout ejecutable; `evidencia/comandos.md` documenta un checker estático opcional, sin atribuirle semántica de prueba funcional.
- El prompt acotado para KiraK72 está reproducido abajo y también en el comentario de la PR; no se duplican hallazgos de rondas posteriores.
## Prompt de corrección para el agy
Tarea: T-365, PR #390, rama feat/T-365-cancelacion-cadete-ofertas-historial. Autor: KiraK72.

0. `git pull` (trae el commit de revisión; usar HEAD remoto verificado). NO rebase, NO force-push, NO amend, NO merge a develop/staging/main. La carpeta `docs/revision-pr/**` es EXCLUSIVA del revisor: no la toques. La PR está en Draft y NO está lista para merge.

DECISIONES DE LAUTARO073, YA TOMADAS (NO VOLVER A CONSULTAR):
1-A: historial mediante una RPC segura de solo lectura sobre `request_cancellation_reasons`; CC independiente y reconciliación documental antes de SQL/RLS/RPC nuevos.
2-A: cronología dentro del detalle del pedido, visible también cuando el pedido vuelve a `published`. No convertir el pedido en `cancelled`; historial de cadete según permisos.
3-A: mostrar únicamente motivo normalizado permitido; si es libre/desconocido/privado, mostrar categoría genérica; no enviar texto arbitrario a la UI.

SECUENCIA OBLIGATORIA, DOS FRENTES:
I. ARREGLO DE OFERTAS, sin cambios contractuales, en ESTA PR:
Archivos editables únicamente para este frente:
- `src/server/live/t204.ts` y `src/server/live/t204.test.ts`.
- `src/features/requests/queries.ts` y `src/features/requests/queries.test.ts`.
- `src/features/requests/components/request-offers-list.tsx` y `src/features/requests/components/request-offers.test.tsx`.
- `src/features/requests/hooks/use-request-offers.ts` y su `.test.tsx` SOLO si se demuestra necesidad por caché/reconexión, sin alterar la política existente de T-333.
- `e2e/specs/request-states.spec.ts` o `e2e/specs/main-flow.spec.ts`, lo estrictamente necesario.
- `docs/tasks/log/T-365.md` (bitácora del agente), cuerpo de PR.

1. En `getRequestOffersLiveServer`, agregar al builder `offersQuery` el filtro DB `.eq('status', 'pending')` inmediatamente después de `.eq('request_id', parsedId.data)`, ANTES de orden/cursor/limit. Asegurar que `nextCursor` y `hasMore` se calculen solo sobre ofertas elegibles. Conservar orden (`created_at` desc, `id` desc), cursor keyset, límite +1, autorización del comercio y proyección CC-016.
2. En `getMerchantRequestWithOffers`, agregar `.eq('status', 'pending')` a la lectura de `offers` dentro de `Promise.all` después de `.eq('request_id', requestId)` y antes de orden/`limit(51)`. NO filtrar después de paginar. No cambiar consulta de solicitudes ni la RPC de datos privados.
3. En `RequestOffersList` aplicar defensa adicional: solo mostrar oferta como elegible y permitir abrir/confirmar modal cuando `offer.status === 'pending'` Y la solicitud siga en estado que permite aceptar. Si desaparece de la lista actual o cambia a terminal, cerrar/inutilizar la selección; evitar aceptación con caché vieja, incluyendo lista inicial, páginas viejas, Realtime, offline/reconnect y respuesta tardía. Tras `OFFER_NOT_PENDING`/`ALREADY_MATCHED`, invalidar/refetch y presentar error apropiado; no dejar botón ni modal engañosos. La RPC `accept_offer` sigue siendo autoridad final (ya exige `pending`): no modificar SQL para esta guarda. Si tipos/tests antiguos omiten `status`, corregir fixtures a estados reales, nunca suponer `pending` como default inseguro.
4. En los tests existentes usar mocks de builder que registren la cadena REAL y afirmen `eq('status','pending')` antes de paginación; fixture mezclada `cancelled/rejected/expired/pending` con >50 filas y cursor para detectar filtros tardíos. Test de la UI que impida botón/modal/acción para cada estado terminal y para `status` ausente. Test de cambio de estado durante un modal y de respuesta vieja durante reconexión. Las pruebas de integración deben usar una fuente que efectivamente respete filtros, no un mock que devuelve `pending` aunque falte `eq`.
5. RED→GREEN REAL: arrancar con tests contra implementación actual y registrar fallos reales; después arreglo GREEN; mutación independiente local (sin commit): QUITAR `.eq('status','pending')` de UNA de las dos consultas por vez, y luego QUITAR la guarda de estado del modal/CTA: CADA mutación debe volver a poner en rojo el test correspondiente; restaurar en memoria y comprobar GREEN. Ninguna prueba puede ser tautológica o basada solo en cadenas/mocks complacientes. Registrar comandos íntegros, aserciones, salida y SHA en bitácora.

II. HISTORIAL: DEPENDENCIA CONTRACTUAL, NO IMPLEMENTAR SQL EN ESTA RAMA TODAVÍA.
6. Crear un CC propio con issue/PR independiente (seguir skill `contract-change` y numeración libre REAL, sin inventar CC ni reutilizar numeración reservada solo de una rama); definir exclusivamente RPC autenticada de proyección de filas de `request_cancellation_reasons`. Unión por `request_id` a `delivery_requests.merchant_id` para autorizar al comercio y por `actor_id = auth.uid()` para el cadete; validar actor, requestId, rol y privilegios, `SECURITY DEFINER` con `search_path` fijo y `EXECUTE` restringido. Retornar solo `requestId, offerId`, actor autorizado/etiqueta segura, `action` permitida, `createdAt` y `reasonCategory` en whitelist; jamás PII del destinatario, datos pre-match ni `reason` libre. Orden estable por fecha e id, paginación y límites. Garantizar múltiples cancelaciones por pedido y no inventar tabla `trips`. Separar `cancel_request` definitivo de `courier_cancel_match` republicado. Definir índice si justificable, rollout de clientes antiguos y cadete. Crear/ejecutar pgTAP de permisos: dueño sí; comercio ajeno no; cadete autor solo su evento; otro cadete no; anónimo no; payload solo whitelist; múltiples eventos ordenados, idempotencia y concurrencia.
7. En PR DOCUMENTAL del CC, reconciliar `docs/tasks/T-365.md` con las rutas autorizadas, los contratos, migraciones, tipos, pruebas y rollout. SOLO luego del CC aprobado+mergeado y nueva base en `develop`, integrar la lectura RPC en `src/features/requests/**` y la cronología dentro del detalle existente. No usar `merchant-history-view.tsx` como fuente de solicitudes activas ni fabricar eventos desde toast, `cancel_reason` del request o caché; no reinterpretar `published` como cancelado. Si el contrato afecta `src/app/**`, primero autorizarlo expresamente por ficha.
8. Tests: cronología con dos cancelaciones de distintos cadetes y reoferta/rematch; actor, fecha, categoría permitida; fecha/categoría faltante segura; estado `published` al mismo tiempo; roles ajenos sin acceso. E2E Preview contra Supabase Develop y dos cuentas de prueba: match→courier_cancel→'Ver ofertas' sin error→oferta vieja no aceptable→evento cronológico→oferta nueva→rematch; registrar SHA, run y resultado. NO tocar prod, no crear .env ni leer secrets.

PROHIBIDO: editar `docs/revision-pr/**`; tocar `src/domain/**`, `src/ui/**`, `src/lib/live-contracts.ts` o migraciones, RLS, RPC SQL en PR #390 sin CC aprobado; añadir dependencias; editar workflows, reglas, ficha en esta rama sin PR documental previo; fabricar historial o datos de prueba irreales, pruebas falsas, adulterar expectations/mocks/aserciones/timeout o silenciar tests para obtener verde. NO levantes Docker ni Supabase local; `test:db` se acredita solo con job CI del SHA y sus totales, cuando corresponda al CC. No ejecutes E2E contra prod.

Cierre del trabajo: actualizar bitácora (HECHO/PRUEBAS/FALTA, nunca 'verificado' por el autor), corregir el body del PR quitando `Closes #353` mientras falte el DoD y arreglando los backslashes/controles de formato, correr `pnpm typecheck && pnpm lint && pnpm test` y tests focalizados; documentar las limitaciones E2E de forma honesta; hacer commit Conventional Commits [T-365] y push normales; pegar salida de `git ls-remote origin feat/T-365-cancelacion-cadete-ofertas-historial`. Pedir ronda 2 al revisor; no aprobar ni mergear.
