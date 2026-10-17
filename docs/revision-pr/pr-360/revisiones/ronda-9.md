# Informe revisar-pr — T-359 · PR #360 · ronda 9

**Fecha:** 2026-10-17. **SHA revisado:** `c4eb0c4b864c966e5306ff9daa2a0d454cbaea44`. **Resultado: CON BLOQUEANTE PR360-R04 (ALTO). E2E real rojo por dato de medio de pago ausente en la vista merchant.** No aprobar ni mergear.

## Cambio frente a ronda 8
No hay commit de autor nuevo en la rama desde el informe documental `c4eb0c4b`, pero **sí hay evidencia nueva**: el gate confiable E2E por fin ejecutó Playwright sobre ese SHA. Anterior ronda 8 documentó que el run estaba en cola. En el cuarto intento la ejecución encontró defecto real. CI principal siguió en verde; GitHub `mergeable:true` y aprobación vigente **no subsanan E2E failure**.

## PR360-R04 (alto) — E2E auténtico FAIL, regresión con T-361
[Run 38965095162](https://github.com/cadeApp/cadeApp/actions/runs/38965095162) · job `117270529209` · HEAD `c4eb0c4b864c966e5306ff9daa2a0d454cbaea44` · deploy `dpl_Dm5rgpnFSTzUaSSgQJv4yBUM1pZo`.

`e2e/specs/main-flow.spec.ts:257`: `await expect(winnerPage.getByText(/Medio de pago:\s*Efectivo/i)).toBeVisible();` → **Expected visible / Received element(s) not found / timeout 10000 ms**, repetido en retry #1 y retry #2. Resumen **77 passed, 1 failed, 1 flaky** (el flaky es T-360: login timeout inicial y éxito en retry, causa indeterminada). No se ejecutó global-settings con éxito tras fallo; no declararlo verde. Contexto `e2e-preview=failure` publicado para este SHA.

**Causa contrastada en source:** `TripMerchantView` dispone de `trip.recipientPaymentMethod` pero solo lo introduce en `buildTripCoordinationWhatsAppMessage` hacia el repartidor, no como dato visible. El viejo `buildNotifyCustomerWhatsAppMessage` incluía la frase `Medio de pago: Efectivo`, visible en la Card `Avisale a tu cliente`, por lo que el test verde anterior medía accidentalmente esa sección. T-361 modificó legítimamente el mensaje del cliente para **no revelar importe ni medio de pago** y apareció el rojo. El DoD de T-359 exige confirmar visualmente monto, método, estado y permisos para comercio, por lo que eliminar la aserción deja requisito incompleto.

## Alternativas — decisión NUEVA de Lautaro073
- **Opción A — UI global (single-drop):** mostrar `Medio de pago: {formatRecipientPaymentMethod(trip.recipientPaymentMethod)}` en Card del repartidor; simple y visible, pero no generalizable sin cuidado a multi-drop heterogéneo.
- **Opción B — cambiar sólo E2E para leer DB/enlace de coordinación:** minimiza edición de UI y comprueba dato persistido, pero **no demuestra** que el comercio lo pueda ver; no recomendable como sustituto de la obligación visual, podría falsear cierre.
- **Alternativa C (RECOMENDADA) — UI single + medios por entrega:** en single-drop mostrar pago en resumen de viaje/repartidor; en multi-drop mostrar en cada Card de entrega el método propio de `drop.recipientPaymentMethod`. Reusar `formatRecipientPaymentMethod` existente; no alterar los mensajes al destinatario ni la confidencialidad de T-361. Más casos de UI y tests, mejor exactitud de dominio ante pagos mixtos.

**Por qué C:** un multi-drop de fixture contiene cash/transfer distintos. A, si imprime un único método, puede inducir al comercio a cobrar mal. B convierte el contrato visual en implícito y perpetúa el falso positivo que encontró el E2E. C cuesta algo más, sin tocar contratos/DB ni alterar envío de mensajes; evita error operativo. **La recomendación no sustituye la autorización del usuario.** No implementar hasta elección.

## Prompt técnico condicionado a autorización de C
Archivos deseados:
`src/features/trips/components/trip-merchant-view.tsx` y `e2e/specs/main-flow.spec.ts`, autorizados en ficha actual. También `src/features/trips/components.test.tsx` para control unitario **NO está dentro de la lista permitida**: requiere autorización de alcance/actualización de ficha antes de editar ese test. Prohibido tocar `src/lib/whatsapp.ts`, backend, RPC, RLS, Supabase/SQL, `.github/**`, CI, fixtures remotas o secretos.

1. Importar `formatRecipientPaymentMethod` desde `../format` junto a `formatVehicleType`. Cuando `dropsList.length===1`, mostrar en el Card del viaje `Medio de pago: <valor>` desde `dropsList[0].recipientPaymentMethod`. Cuando `dropsList.length>1`, mostrar un `Medio de pago: <valor>` **por Card de destinatario**, desde `drop.recipientPaymentMethod`; nunca usar el método de `trip` como si se aplicara a todos. Reusar labels cash/transfer/to_agree y clases de UI actuales, con un dato accesible visible, sin duplicar valores incidentales fuera de la sección.
2. Conservar test de dos BrowserContexts, oráculo DB, y las dos aserciones de monto en la Card, identidad courier, WhatsApp, Back, 0 Aceptar y T-360. **Fortalecer** la aserción de pago: scope al Card semántico de single-drop y comprobar `Efectivo`; no buscar en texto de WA. También después de reload comprobar método persistido.
3. Unitario (tras ampliación explícita de alcance): crear RED real que demuestre falta del método visible para single cash, transfer y to_agree y multi-drop con cash/transfer heterogéneos; GREEN luego. Usar queries semánticas ancladas por Card de entrega, no sólo `getByText` global. Conservar los tests de T-361 que prohíben cifras y pagos en WhatsApp al cliente; no modificar mocks para pasar.
4. No adulterar tests, expectativas, fixtures, mocks, snapshots, skips, conteos, timeouts, umbrales, jobs ni RED/GREEN. No reemplazar una validación DOM por un test tautológico. Registrar comandos/resultados auténticos en bitácora. No ejecutar mutaciones inseguras de E2E contra Preview fuera del mecanismo `e2e-mutation` aprobado. La revisión ejecutará sus propias mutaciones independientes cuando pueda.
5. Ejecutar `pnpm typecheck && pnpm lint && pnpm test`, tests focalizados, comprobar diff/al alcance y el E2E Preview auténtico en SHA nuevo (Chromium + global-settings); registrar si T-360 vuelve a fallar o flaky sin ocultarlo. `db-tests` de CI, sin correr Docker/Supabase local por la revisión. Merge de develop más reciente sólo si necesario con merge normal; no rebase/force. No aprobar ni mergear.

## Estado de los demás controles
`unit/db-tests/typecheck/lint/build/audit/bundle-budget` SUCCESS en SHA inspeccionado; `approval-policy` SUCCESS con la aprobación auténtica de Lautaro073. H05 `parcial`: el E2E no logró llegar a los asserts posteriores a pago. R03 `arreglado-sin-verificar` según su evidencia previa. No se ejecutaron mutaciones independientes ni pnpm desde el entorno revisor. `develop` actual observado `cf65ce256f8fb45a9d9bc890f4531b1ae03cbea6`; nuevas modificaciones desde último merge requieren revisión posterior, no son la causa demostrada de R04.

**Decisión humana pendiente:** A, B o C; recomiendo C. **No merge.**
