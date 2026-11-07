# Informe de revisión independiente — PR #508 / T-393 — Ronda 1

**Fecha:** 2026-10-22
**Rama:** \`feat/T-393-partial-delivery\` → \`develop\`
**SHA revisado:** \`e234ad0955b262f1cb2ce29ed06a50859ba9935f\`
**Base observada:** \`c24927c0598905a37ce48bd1e77f9f1383f4a24d\`
**Resultado:** **CON BLOQUEANTES (2)**; **MEJORA (1)**.
**Autorización:** Lautaro073 resolvió las decisiones 1A, 2B, 3C antes de cerrar esta ronda.

## Control de entrada
- GitHub: rama 2 commits por delante de develop y 0 por detrás al comprobarla; PR mergeable sin conflictos reportados.
- 12 archivos cambiados; sin migraciones, SQL, cambios de RPC ni dependencias.
- Archivos contra ficha en \`develop\`: \`src/features/trips/index.ts\` estaba fuera de la lista original. **Decisión 1A** autoriza el export exclusivamente; la ficha de la rama y la fila del plan registran esa ampliación. No se señala como infracción pendiente.
- Bitácora \`docs/tasks/log/T-393.md\` revisada; el autor declara \`pnpm test\`: 158 archivos y 3196 tests, \`typecheck\`/ \`lint\` OK y E2E local 5 passed sobre el Preview de \`b18eff20\`. **No se han reproducido por el revisor; no equivalen a evidencia independiente**.
- Comentarios de la PR: solo bot Vercel en el momento de inspección; sin hilos de revisión previos.
- El cuerpo de la PR carecía de la plantilla obligatoria; la revisión corrigió la **metadata** preservando descripción, declaraciones del autor, DoD pendiente e informe CON BLOQUEANTES. Esta corrección de metadata no cambia código ni constituye aprobación.
- CI no inspeccionado aún porque hay bloqueantes, según protocolo. Sin Supabase, Docker ni claves remotas.

## Hallazgos

### PR508-H01 — BLOQUEANTE ALTO · Única entrega fallida: datos y WhatsApp falsos
**Archivo:** \`src/features/trips/components/trip-merchant-view.tsx:278,298,317\`
**Patrón:** P06-enumeracion-incompleta. **Evidencia:** [ANÁLISIS], SHA \`e234ad0955b262f1cb2ce29ed06a50859ba9935f\`.

**Enumeración de la clase:** solicitud con dos o más drops (todos entregados / parcial / ninguno); solicitud de un drop (entregado / fallido / pendiente); legacy sin drops (global); recorrido en curso. En la implementación nueva, \`summarizeDropOutcome([{status:'failed'}], 'delivered')\` ya devuelve correctamente \`none_delivered\`. Sin embargo, cuando hay exactamente un drop:
- la vista usa \`isMultiDrop\` para ocultar el Badge de la tarjeta y \`Motivo: …\` (líneas 298 y 317);
- \`buildNotifyCustomerWhatsAppMessage\` recibe \`dropStatus: undefined\` (línea 278), y con \`tripStatus: 'delivered'\` genera \`Tu pedido ya fue entregado...\`, pese al drop fallido;
- \`src/lib/whatsapp.ts\` **ya maneja \`dropStatus:'failed'\` correctamente**. No hay que tocar el helper.

**Consecuencia:** una pantalla puede indicar "No entregado" en encabezado y, simultáneamente, ofrecer al comercio un texto falso de WhatsApp y ocultar la causa. La regla nueva 2B exige estado real siempre que exista una entrega materializada.

**Arreglo autorizado y concreto:** en \`trip-merchant-view.tsx\` calcular \`hasActualDrops = Boolean(trip.drops?.length)\`; enviar \`dropStatus: hasActualDrops ? drop.status : undefined\` para preservar fallback legacy; mostrar el badge si hay drop real, incluso uno; mostrar motivo cuando \`drop.status === 'failed' && drop.failedReason\`, sin condicionar a \`isMultiDrop\`. Mantener resumen "N de M" reservado a multientrega.
Actualizar \`docs/tasks/T-393.md\`: solo sin \`drops\` el resumen depende de status global. Añadir tests en \`drop-outcome.test.ts\`, \`components.test.tsx\` y, para historial de una fallida, \`merchant-history-view.test.tsx\`. No tocar \`src/lib/whatsapp.ts\`.

**RED real:** añadir antes del arreglo un test con \`closedTrip(['failed'])\` que exija \`No entregada\`, \`Motivo: El destinatario no responde\` y texto de WhatsApp que **no** incluya \`ya fue entregado\`; comprobar test rojo en el código actual y verde tras arreglo. Testear single delivered, legacy sin drops y multi-drop para evitar regresiones. Mutación adicional luego del arreglo: volver a \`dropStatus: isMultiDrop ? drop.status : undefined\` y comprobar que el nuevo test falla; restaurar en memoria/sin commitear.

### PR508-H02 — BLOQUEANTE MEDIO · E2E elude publish_request
**Archivo:** \`e2e/specs/merchant-partial-delivery.spec.ts:43-49\`
**Patrón:** P08-control-no-cubre-lo-que-dice. **Evidencia:** [ANÁLISIS], SHA \`e234ad0955b262f1cb2ce29ed06a50859ba9935f\`.

El DoD exige "un comercio publica 2 entregas". El E2E crea la solicitud con \`createAdminClient().from('delivery_requests').insert({status:'published', ...})\`, luego transita las RPC reales \`submit_offer\`, \`accept_offer\`, \`mark_picked_up\`, \`mark_drop_delivered\` y \`mark_drop_failed\`. La prueba de detalle/historial es valiosa, pero omite la transición de publicación desde credenciales del comercio.

**Decisión 3C:** conservar el fixture administrativo exclusivamente para preparar \`draft\`, contactos y drops \`pending\`, después crear \`merchantClient = await createAuthenticatedClient(merchant)\` y llamar \`merchantClient.rpc('publish_request', {p_request_id: requestId})\`; afirmar \`error === null\`, respuesta \`status:'published'\`, \`dropsCount:2\`, y estado materializado antes de que el repartidor oferte. Mantener RPC reales posteriores y aserciones de UI/historial; ninguna inserción directa en \`published\`. Completar los campos que el RPC valide con fixtures genuinos; sin bypass administrativo y sin alterar expectativas para hacer verde.

**RED real:** con la preparación en \`draft\`, omitir temporalmente el llamado \`publish_request\`: \`submit_offer\` debe fallar por estado inválido y el spec quedar rojo; restaurar la llamada y documentar RED→GREEN. Ejecutar E2E contra el Preview del SHA nuevo. Se permite E2E local sin esperar todo CI por decisión ya registrada, pero **debe verificarse independientemente antes del merge**.

### PR508-H03 — MEJORA BAJA · El test solo comprueba el texto del último paso
**Archivo:** \`src/features/trips/components.test.tsx:338-345\`
**Patrón:** P08-control-no-cubre-lo-que-dice. **Evidencia:** [ANÁLISIS].

El test de "ninguna entregada" comprueba \`No entregado\`, ausencia del texto \`Entregado\` y dos badges; no detectaría reemplazar \`XCircle\` por un ícono de check manteniendo el texto. El DoD pide expresamente el último paso sin check de éxito. Agregar aserción del icono SVG relevante, acotada al último paso del progreso y no al resto de checks legítimos; para comprobar sensibilidad sustituir temporalmente \`XCircle\` por \`CheckCircle2\` en ese único lugar y exigir RED, luego revertir y exigir GREEN. No usar snapshots tautológicos ni tests sobre implementación que eludan el componente real.

## NO TOCAR — descartados y decisiones
- **Export del index:** permitido por decisión 1A; cumple límite de feature y es la única exposición adicional aprobada.
- **CC-022 §6:** el estado general \`delivered\` con alguna \`failed\` es intencional, **no** se debe añadir un estado \`partially_delivered\`.
- **Helper de WhatsApp:** ya distingue \`dropStatus:'failed'\`; arreglar el argumento del componente, no duplicar lógica.
- **Badge partial:** reutiliza token \`badge-warning\` existente, sin crear un token nuevo.
- **Resumidor puro:** 10 comprobaciones independientes verdes con 5 mutaciones detectadas; mantener implementado (no justificar refactor).
- **Vista del repartidor y admin:** fuera de T-393; no ampliar alcance.

## Evidencia independiente, por alcance
| Control | Observado | Limitación |
|---|---|---|
| Comparación de ramas | ahead 2 / behind 0, mergeable true | Datos GitHub, no \`git merge-tree\` local |
| Inspección completa de cambios | 12 archivos y contratos de T-393 | Sin tests React ejecutados |
| \`summarizeDropOutcome\` puro | 10 casos verdes; 5 mutaciones detectadas RED | Fuente TS del SHA transformada quitando tipado para ejecutarla como JS; **no** Vitest |
| Tests de componente / E2E | Declaraciones de bitácora del autor | No reproducidos por el revisor |
| \`pnpm typecheck && pnpm lint && pnpm test\` | Reportados como verde en bitácora | No ejecutados; sin clon de GitHub por DNS del entorno |
| CI, e2e-preview, db-tests | No inspeccionados | Aplazados mientras existan bloqueantes |

## Checklist para la ronda 2
- [ ] H01: caso single failed + motivo y WhatsApp; preservar legacy, single delivered, multi.
- [ ] H02: publication por RPC autenticada en E2E, confirmar transición real.
- [ ] H03: mutación de ícono de último paso detectada.
- [ ] Ficha y bitácora reflejan decisiones, tests RED→GREEN sin fabricarlos.
- [ ] Verificar el HEAD actualizado y comentarios de PR antes de revisar.
- [ ] Ejecutar checks disponibles y E2E sobre preview correspondiente al SHA que se va a aprobar.
- [ ] Registrar \`verificado_en_sha\` **solo** tras comprobar independientemente ese SHA.
- [ ] Mantener informe de ronda 1 sin editar; la siguiente es \`ronda-2.md\`.
