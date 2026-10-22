# PR #330 · T-340 Paso 4/4 — revisión independiente Ronda 3

- **Fecha:** 2026-10-14. **SHA revisado:** `014029270f431280fa831ea910d052da9b12fd1d`. **Base develop:** `3a453762445ce866a373eeab4a86365aacaca7e5`.
- **RESULTADO: CON BLOQUEANTES (2): H03 histórico + H07 nuevo.** Mejora documental H08. Los históricos H01, H02, H04, H05, H06 se consideran **arreglados-verificados sobre este mismo SHA**.
- **Cambio desde ronda 2:** solo `docs/tasks/log/T-340.md`, commit de autor `01402927`; ningún cambio nuevo de implementación. **No duplicó funcionalidades, no creó RPC, no tocó carpeta de revisión**.

## Revalidación completa de los hallazgos históricos

- **H01 RESUELTO**: `e2e/specs/multi-drop.spec.ts` usa pickup autorizado antes de marcas; E2E real del SHA revisado Chromium caso escritor #44 PASS.
- **H02 RESUELTO**: `submit_offer` courier + `accept_offer` merchant, sin sembrar oferta como admin en el caso escritor; E2E #44 PASS.
- **H04 RESUELTO (solo para lector/escritor PRE-RPC)**: E2E verifica valores $4500 y $3000/$0 en **UI real** de viaje con courier autenticado, no cálculo del propio test; casos escritor y todas fallidas PASS. **No demostrar con esto rollback ni idempotencia de nueva RPC**.
- **H05 RESUELTO**: eliminadas `!` non-null anteriores; `unit` CI de SHA actual: 129 suites / 2143 tests PASS.
- **H06 RESUELTO**: `getByTestId('drop-card-0')` encuentra el botón GPS; mapa Chromium #36 PASS.

## Bloqueantes

### PR330-H03 — Atomicidad transaccional aún pendiente (ALTO, histórico)
`src/features/requests/actions.ts:54–179` hace HTTP INSERT request/pickup/drops/contactos privados y `publish_request` por separado. Fallo intermedio deja borrador parcial y no hay garantía ACID. **La documentación CC-024 (#332) sí está mergeada, pero la PR separada backend de #331 no fue encontrada como implementada/desplegada**; no afirmar H03 resuelto ni mergear #330. El cambio backend NO corresponde a esta rama.

### PR330-H07 — Reintento con datos editados y UUID viejo (ALTO, NUEVO)
`create-request-form.tsx:643–644,710–734`: la ref conserva UUID ante error; al reintentar se pasa `...data` actualizado y el **mismo** UUID, sin guardar el payload original, normalizarlo/compararlo ni avisar si cambió. Una respuesta incierta seguida de editar el teléfono/dirección/cambio crea reintento con mismo ID y payload distinto. `CC-024.md:78–91` exige explícitamente **aviso de conflicto o nueva intención explícita con otro UUID**. Riesgo de error `VALIDATION_ERROR` posterior a deploy y confusión/duplicación de envíos. **Deducción de flujo por inspección; no se ejecutó React ni mutación propia**. Se detectó en esta ronda y no estaba en las anteriores (laguna de revisión que se reconoce).

**Reparación dentro de CC-024 ya aprobado, sin pedir nueva decisión:** para el estado de intento ambiguo, conservar snapshot normalizado en memoria (NO almacenar PII), UUID y huella; si el payload de nuevo submit difiere, **no** invocar Server Action silenciosamente. Mostrar aviso `role=alert` y permitir `Reintentar solicitud original` (mismo contenido/ID) o `Comenzar otra solicitud` (confirmación explícita, nuevo UUID); tras éxito limpiar snapshot. No generar UUID automáticamente en cada retry ni forzar una segunda solicitud sin confirmación. Prueba RED→GREEN en unidad del formulario con network error, edición intermedia y aserción de no-llamada; test de misma entrada conserva UUID. Todo dentro de componente/test y, si requiere textos, `copy.ts`.

## Mejora

### PR330-H08 — Corregir conteo de DB en bitácora (BAJO)
`docs/tasks/log/T-340.md`, sesión 09:35, transcribe `Files=21, Tests=1980` para job `115846119404`; **log real** de ese job informa `Files=21, Tests=2039, Result: PASS`. Corregir número, sin alterar las afirmaciones sobre resultado. No implica SQL FAIL ni manipulación deliberada de pruebas.

## Evidencia CI independiente de SHA actual
- `CI` [run 38565323486](https://github.com/cadeApp/cadeApp/actions/runs/38565323486), checkout merge `5bc9c37` de `01402927` + develop: `unit`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `db-tests` **SUCCESS**.
- `unit` job `115856413631`: **Test Files 129 passed; Tests 2143 passed**. Los errores console esperados de mocking de lazy import no produjeron fallos de la suite.
- `db-tests` job `115856413342`: **Files=21, Tests=2039, Result: PASS**, con tests y mutaciones SQL preexistentes. **No cubre la futura RPC CC-024**.
- `E2E Preview` [run 38565439461](https://github.com/cadeApp/cadeApp/actions/runs/38565439461), job `115856918592` hizo checkout exacto **01402927**, **74/74 Chromium PASS y 3/3 global-settings PASS**. Mapa #36, escritor #44 y todas fallidas #45 PASS. E2E de ese SHA verde, pero usa escritor aún no transaccional.
- `approval-policy` FAIL sobre `01402927`; es compatible con informe pendiente y bloqueantes, no lo falsear para obtener merge.
- **No ejecutado directamente por revisor:** pnpm local, Docker/Supabase, tests mutados, pgTAP nuevo, pruebas de red incierta ni mutación RED de H07. No atribuir RED→GREEN del nuevo H07 al CI actual.

## Dictamen
PR #330 **Draft, NO MERGEAR**. Resolver H07 (cliente) y H08 (evidencia), mientras H03 espera que Lautaro073 cierre backend CC-024 en PR separada y `migrate-develop` verde. Luego writer una sola RPC, E2E nuevo y otra ronda independiente. No hay decisión adicional del dueño: la UX de aviso/nueva intención está explícitamente autorizada por CC-024.
