# PR #113 · T-124 — Ronda 1

- **SHA:** `3ef389de515f01b03a7aff88982b0b32b5f91c4d`
- **Base:** `47d65c41dc22e1f6b5bebbfb5473c3e89b2d820a`
- **Estado:** Draft · fase RED
- **Resultado:** **CON BLOQUEANTES (8)**
- **Decisiones:** D05-A · D06-A · D07-A · D08 sin aprobación P2 obligatoria

## Preflight y validez RED

La rama estaba al día con develop al comenzar la revisión. El autor no había escrito `docs/revision-pr/pr-113/**`.

CI `36306937968`:
- typecheck/lint/build/audit/db-tests/bundle-budget ✅;
- unit ❌ intencional: 7 archivos / 94 tests rojos; 73 archivos / 897 tests verdes;
- DB: 12 archivos / 1529 tests PASS.

Los rojos corresponden a stubs/rutas ausentes de T-124. La fase RED es real, pero incompleta: hay implementaciones incorrectas que todavía podrían llegar a GREEN.

## H01 — CRÍTICO · report_incident tiene matriz de autorización incorrecta

El dispatcher SQL no rechaza `admin` para `report_incident`, y los pgTAP actuales incluso lo declaran válido. También permiten al courier reportar sobre `delivered`.

**D05-A obligatorio:**
- merchant dueño: `matched`, `in_transit`, `delivered` hasta 24 h;
- courier asignado: `matched`, `in_transit`;
- admin: nunca.

El contract-change debe actualizar SQL, contrato/fake si aplica y pgTAP; `UNAUTHORIZED_ACTOR` debe ser el error de rol/participación.

## H02 — CRÍTICO · RLS permite saltarse la RPC

La RLS actual permite INSERT directo a `incidents` por participantes y `FOR ALL` por admin. Eso permite evitar ventana, rate limit y validaciones de `report_incident`.

**D07-A:** incidentes se escriben/resuelven solo mediante RPCs. El CC debe negar INSERT/UPDATE/DELETE directos a usuarios autenticados y conservar únicamente SELECT según rol necesario.

El mismo CC debe endurecer `report_incident` para:
- aceptar solo los `INCIDENT_KINDS` canónicos;
- rechazar datos de contacto en el relato con `VALIDATION_ERROR`;
- seguir aceptando montos como `$ 2.000`.

## H03 — CRÍTICO · courierId manipulable en suspensión

La fase RED manda `incidentId + courierId + reason` pero `admin_suspend_courier` solo recibe courierId.

**D06-A reemplaza ese diseño:** eliminar la mutación separada como camino de A05. `admin_resolve_incident({incidentId,decision,reason})` deriva la solicitud/oferta/courier dentro de Postgres.

Para `preventive_suspension`, una única transacción:
1. valida admin + AAL2;
2. bloquea incidente/solicitud/oferta/courier;
3. suspende courier;
4. retira ofertas pending;
5. resuelve incidente;
6. inserta audit_log;
7. devuelve resultado tipado.

Mapeo:
- `no_action → dismissed`;
- `warning → resolved`;
- `preventive_suspension → resolved`.

La UI nunca decide el courier afectado.

## H04 — ALTO · schemas manuales en vez de Zod

`schemas.ts` contiene interfaces duplicadas y no usa Zod.

Agregar schemas fuente de verdad y derivar tipos con `z.infer`:
- report;
- resolve;
- search params/cursor.

Server Actions vuelven a validar con el mismo schema. Evitar casts como mecanismo de validación.

## H05 — ALTO · wiring C06/R07 no prueba la regla real

El test de `trips/[id]/page.tsx` solo cuenta dos componentes y `requestId`.

Debe exigir datos reales y actor:
- `actorRole="merchant"` / `actorRole="courier"`;
- `tripStatus={trip.status}`;
- `deliveredAt={trip.deliveredAt}`.

El componente debe reflejar D05-A:
- merchant: visible matched/in_transit y delivered <=24 h;
- courier: visible matched/in_transit, nunca delivered.

Mutar cualquiera de esos props/hardcodearlos debe volver rojo.

## H06 — ALTO · keyset inestable

No usar timestamp-only.

Contract-change D07-A:
- índice `incidents(status, created_at DESC, id DESC)`;
- orden por `created_at DESC`, luego `id DESC`;
- cursor compuesto validado por Zod;
- filtro siguiente: `created_at < c.createdAt OR (created_at = c.createdAt AND id < c.id)`;
- fixture con empate exacto de timestamp y prueba de no perder/duplicar filas.

## H07 — ALTO · falta happy path de admin_resolve_incident

Después del CC, `actions.test.ts` debe exigir:
- admin AAL2;
- llamada exactamente una vez a `adminResolveIncidentRpc(client,{incidentId,decision,reason})`;
- resultado exacto;
- revalidación de `/admin/incidents` y detalle si corresponde;
- error de RPC no revalida;
- merchant/courier/AAL1 no llaman la RPC;
- cero escrituras directas/service role.

## H08 — ALTO · Dialog/loading/error con cobertura insuficiente

Agregar antes de GREEN:
- Escape cierra el Dialog de decisión y devuelve foco al mismo botón que lo abrió;
- mutación `event.currentTarget.blur()` debe romper ese test;
- `loading.tsx` usa `Skeleton` y conserva forma aproximada de bandeja/detalle;
- `error.tsx` es error boundary cliente, muestra error seguro y botón que llama `reset()`.

## D08 — ownership

`src/app/trips/[id]/page.tsx` sigue registrado como cruce de zona histórica de P2, pero **no se exige visto bueno/aprobación de P2** para una PR de Lautaro073. No es un blocker.

## Orden de trabajo

1. Crear contract-change de D07-A y llevarlo hasta merge.
2. Volver a T-124 y sincronizar con develop mediante merge, nunca rebase/force/amend.
3. Actualizar ficha/bitácora con D05–D08.
4. Corregir la fase RED H03–H08 y demostrar mutaciones.
5. Solo entonces implementar GREEN.
6. Checks completos y navegador/capturas al cierre.

No aprobar ni mergear PR #113 en esta ronda.
