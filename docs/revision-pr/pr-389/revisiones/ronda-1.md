# Informe de revisión independiente — PR #389 / T-362 — ronda 1

**Fecha:** 2026-10-17  
**SHA inspeccionado:** d872ec9b49a7a7ee0d3a21f7485026545a2ccb49  
**Base de la PR:** develop @ cf65ce256f8fb45a9d9bc890f4531b1ae03cbea6  
**Resultado:** CON BLOQUEANTES (5). Los hallazgos son por inspección; ninguno se presenta como verificado-runtime.

## Método y limitaciones

Se leyeron primero las reglas (COMO-ENTREGAR, README, skill revisar-pr, AGENTS.md, regla 40 y e2e/AGENTS.md), la ficha de T-362 desde develop, la bitácora, la conversación de PR y el diff íntegro. Se contrastaron actions.ts, schemas.ts, contratos RPC, componentes de incidentes, page tests previos y fixtures E2E. Los comentarios de PR eran del bot Vercel y del autor; no había threads de revisión. No existía carpeta pr-389 antes de esta ronda.

GitHub informa head mergeable=true, con dos commits nuevos en develop que solo tocan docs/tasks/T-359.md. No se pudo ejecutar git fetch/merge-tree ni tests porque el runtime local no logra resolver github.com y no contiene un clon. Por lo tanto, los RED y GREEN que el autor reporta quedan **sin reproducción independiente**: ni se acepta el error de referencia como mutación válida ni se inventa una ejecución. El harness de evidencia/comandos.md queda preparado para ejecución posterior en un clon limpio.

## BLOQUEANTES

### PR389-H01 — No se prueba cancelación del comercio en la vista de viaje

**Ubicación:** e2e/specs/request-states.spec.ts:1151–1240. **Severidad:** alta. **Patrón:** P06-enumeracion-incompleta. **Evidencia:** análisis.

El E2E agregado navega a /trips/[id] con cadete en matched, confirma courier_cancel_match y después solo verifica ausencia de botones en in_transit. No ejercita el modal merchant en matched, no ejecuta merchantCancelTripAction desde esa vista ni prueba la persistencia del motivo y actor del comercio para dicha ruta. El caso previo T-364 cubre cancelación rápida desde /merchant/dashboard de una solicitud published; no cubre esta ruta y estado. Las pruebas existentes de RPC sí comprueban algunos actores ajenos, pero no su acceso visual a /trips/[id].

**Arreglo:** añadir en el mismo spec un caso merchant matched con una solicitud propia, loginAsMerchant, apertura de Cancelar envío, matriz exacta de opciones, confirmación en 2 pasos, redirección real y oráculo SQL: cancelled, motivo elegido y actor_id = merchant.id. Añadir intento de acceso a /trips/[id] como actor no participante en un contexto autenticado separado y comprobar que no ve el viaje ni acciona cancelación. Usar fixtures existentes, sin datos reales ni bypass.

**Verificación:** Playwright Preview en el SHA final, comparación de DB y prueba RED con mutación segura por el mecanismo e2e-mutation solo si el target ya es develop. No desplegar código inseguro en una rama abierta.

### PR389-H02 — El negativo de in_transit no demuestra que se visitó el viaje correcto

**Ubicación:** e2e/specs/request-states.spec.ts:1216–1238. **Severidad:** alta. **Patrón:** P08-control-no-cubre-lo-que-dice. **Evidencia:** análisis.

Las dos aserciones not.toBeVisible pueden dar verde en una pantalla de login, error, not-found o carga en vez de la página del viaje. Más grave, el bloque de merchant está dentro de if (merchantBrowserContext): si page.context().browser() devuelve null, se omite silenciosamente la comprobación. No hay aserción positiva de que el actor correcto haya entrado en el detalle ni de que siga visible Reportar un problema en in_transit.

**Arreglo:** pedir la fixture browser de Playwright o fallar explícitamente si no se puede crear el contexto merchant; nunca encerrar la verificación en un if opcional. Tras cada goto, verificar URL exacta, encabezado 'Viaje en curso', código de la solicitud/identidad visible y botón 'Reportar un problema'. Solo entonces afirmar ausencia de cancelación simple. Cerrar el contexto extra siempre en finally.

**Verificación:** comprobar que una navegación a una página sin el viaje o un navegador sin contexto adicional falla por las aserciones positivas (no aprobar un mero not.toBeVisible).

### PR389-H03 — Oráculo de razones unitario dependiente de la implementación

**Ubicación:** src/features/trips/components/trip-cancel-dialog.test.tsx:35–104. **Severidad:** alta. **Patrón:** P08-control-no-cubre-lo-que-dice. **Evidencia:** análisis.

La prueba recorre las mismas MERCHANT_CANCELLATION_REASONS y COURIER_CANCELLATION_REASONS importadas del componente. Si una razón obligatoria cambia o desaparece, el test deja de esperarla y continúa verde; los negativos solo miran razones ajenas. El E2E comprueba expresamente solo dos de las razones positivas del cadete, por lo que no compensa por la enumeración.

**Arreglo:** usar arrays de texto literales independientes como expectativa contractual, verificar nombre y orden/conjunto exacto de radios de ambos roles y ausencia de roles cruzados. En E2E exigir también 'No puedo llegar al punto de retiro', 'Emergencia' y 'Otro', más las cuatro del merchant. No recalcular expected desde las constantes de producción.

**Mutación independiente prevista:** sustituir únicamente 'Emergencia' por otra frase en COURIER_CANCELLATION_REASONS. Actualmente la suite añadida no tiene una expectativa fija de ese texto. El harness especifica el procedimiento para confirmar supervivencia y luego RED tras corregir el test; no se ejecutó aquí.

### PR389-H04 — Falta oráculo de integración actor→diálogo y un RED semántico de Otro

**Ubicación:** src/features/trips/components/trip-cancel-dialog.test.tsx:1–358 y src/features/trips/components/trip-courier-container.tsx:112–121. **Severidad:** alta. **Patrón:** P08-control-no-cubre-lo-que-dice. **Evidencia:** análisis.

Las 15 pruebas nuevas renderizan el diálogo con actor explícito o las vistas aisladas, no el container que transmite actor='courier' a la UI. Cambiar únicamente actor='courier' por actor='merchant' en el container no modifica ninguno de los componentes renderizados por esa suite. El E2E de cadete sí debería capturarlo si corriera; todavía está pendiente. Además la mutación C del autor falló con ReferenceError: isOther is not defined, que prueba un programa roto, no que el control detecte la omisión de validar 'Otro'.

**Arreglo:** sumar una prueba de integración de TripCourierContainer y TripMerchantContainer con sus actions simuladas, abrir el diálogo desde cada vista en matched y afirmar lista fija de radios y motivo entregado a la action apropiada. No hacer mocks que sustituyan la propiedad probada. Para 'Otro', mutar sin generar ReferenceError: cambiar temporalmente la exigencia de longitud > 0 por >= 0 en la expresión de isReasonValid; un caso con '    ' debe fallar por el estado habilitado, restaurar por contenido original y volver a GREEN. Mutar el wiring actor del contenedor y exigir RED real de la prueba nueva.

**Verificación:** suite Vitest contra el SHA real; registrar líneas Test Files/Tests para control sin mutar, RED válido y control restaurado. No crear pruebas falsas o alterar expectativas, snapshots, fixtures, mocks, timeouts ni checks para forzar verde.

### PR389-H05 — Casillas de DoD declaradas completas sin prueba E2E del SHA

**Ubicación:** docs/tasks/T-362.md:45–52; docs/tasks/log/T-362.md:58–65. **Severidad:** media. **Patrón:** P03-comentario-contradice-codigo. **Evidencia:** análisis.

El cambio mecánico sobre la ficha desde develop únicamente marca siete casillas. La de E2E desde cadete y comercio quedó marcada [x] pese a que solo hay caso funcional completo del cadete y la bitácora dice 'Falta: CI en GitHub y E2E Preview'. El cuerpo de la PR deja el E2E Preview pendiente, sin run ni resultado. La marca no es evidencia de ejecución.

**Arreglo:** desmarcar la casilla E2E no satisfecha y cualquier ítem cuyo resultado no esté demostrado; conservar íntegro el alcance de la ficha. Tras completar pruebas y correr E2E Preview en el SHA final, actualizar bitácora con URL de run, SHA, resultado y oráculo, y entonces marcar lo realmente cumplido. No confundir caso escrito con caso ejecutado.

## Reconocimientos precisos / NO TOCAR

- El componente parametrizado evita duplicar el diálogo y distingue correctamente listas, texto de confirmación y motivo real de 'Otro' por inspección.
- Los contenedores usan actions preexistentes: courierCancelTripAction valida rol courier y llama courier_cancel_match; merchantCancelTripAction valida merchant y llama cancel_request. schemas.ts impone trim/min(1)/max(500).
- isMatched oculta la cancelación simple al pasar a in_transit; el sistema ya monta ReportIncidentButton desde /trips/[id], con report_incident autorizado para courier/merchant. No hace falta abrir CC ni crear nueva RPC, ni sustituir el reporte post-retiro.
- La ficha no amplió archivos permitidos ni contratos: el desvío es certificar pruebas prematuramente, no un CC tácito.
- No se atribuyen a T-362 defectos anteriores de navegación, permisos o enrutado no demostrados.

## Checks y qué falta verificar

| Control | Estado independiente en esta ronda | Alcance |
|---|---|---|
| pnpm typecheck, lint, test | No ejecutados; salida en bitácora del autor no reproducida | Calidad básica |
| Mutaciones del autor | No reproducidas; mutación C inválida por ReferenceError | Solo evidencia declarada |
| Mutaciones independientes | Diseño documentado; no ejecutadas | Sensibilidad de la prueba |
| CI / e2e-preview | No inspeccionados mientras haya bloqueantes | Ver tras resolver H01–H05 |
| merge-tree | No disponible localmente; GitHub informa mergeable=true | Revalidar al cerrar |
| Alcance | 9/9 rutas permitidas por inspección | No se tocaron contratos |

## Instrucciones de cierre

Publicar esta ronda y el prompt específico en **un solo comentario** de la PR. En cada arreglo, el agente debe hacer git pull y registrar pruebas sin falsificarlas. Al nuevo SHA: revalidación independiente del conjunto de razones, integración actor→container, flujo merchant matched, E2E negativos no vacíos, logs CI reales y comprobación de divergencia con develop. No aprobar ni mergear en esta ronda.
