# Lecciones — PR #390, ronda 1
1. **No confundir Draft diagnóstico con fix.** Si el diff es solo bitácora, no atribuir los 341 tests del baseline a la regresión reparada. PR390-H01/H08, patrones P15/P08.
2. **El historial de una asignación no es el estado terminal del pedido.** Una cancelación por cadete puede coexistir con `published` y nueva oferta; UI en detalle con proyección autorizada. PR390-H02/H06, patrones P10/P05.
3. **Filtro de elegibilidad antes de paginar y defensa por capa.** API Live, precarga SSR, caché/modal y RPC final deben manejar la misma clase completa `pending/accepted/rejected/withdrawn/expired/cancelled`. PR390-H03/H04/H05, patrones P06/P08.
4. **No convertir texto libre en evento público.** Motivo normalizado con whitelist para la proyección; SQL/RLS solamente tras CC. PR390-H07, P20.
5. **No inventar numeración AG.** No se asigna AG nueva hasta consultar máximo en TODAS las ramas remotas; próxima ronda documentará mutaciones independientes si se ejecutan.

## Ronda 2 — 2026-10-17
- PR390-H05: `initialOffers` no es fuente autoritativa DESPUÉS del refetch. Un fallback parece resiliente pero puede reactivar una decisión sobre una fila que desapareció; se prueba con props estables y respuesta real de query.
- PR390-H10: un test de «refetch» que solo afirma un mensaje es un proxy falso. Exigir spy de fetch y pérdida de ítem; mutación quitando refetch debe RED.
- PR390-H11: mocks que siempre retornan `pending` aunque se quite filtro no demuestran filtrado, y los `any` nuevos incumplen reglas. Ejercer clase completa y 51+ elementos.
- PR390-H12: separar CI verde general de DoD concretas. No contar E2E-preview genérica como evidencia del caso.

## Ronda 3 — 2026-10-17
- **PR390-H13:** Conectividad no demuestra frescura; reconectar no puede convertir datos cached pending en elegibles antes de terminar una lectura iniciada tras el reconnect. Un test de `deferred Promise` debe comprobar el intervalo intermedio, no solo antes y después.
- **PR390-H14:** Un builder mock que respeta `eq` pero ignora `order` entrega cursor de la entrada y aparenta probar keyset. La prueba debe simular exactamente `order(desc created_at,desc id) -> limit(51)` y un empate.
- **PR390-H09:** GitHub `mergeable_state: dirty` impide afirmar merge-ready aun con approval-policy success; mergear develop sin rebase/force y revisar conflictos.
- **CI y bitácora:** Enforce regla del usuario: no exigir re-correr CI SOLO por informe o bitácora. Con código nuevo faltante de CI (d156e12), la evidencia de pipeline del SHA del cambio funcional sí importa; no confundir casos.

## Ronda 4 — 2026-10-18
- **Tracking de generación para sincronización post-reconexión:** Validar la frescura de datos tras reconexión requiere vincular cada petición a un contador de generación iniciado estrictamente después del cambio a online, evitando que respuestas rezagadas de peticiones previas habiliten acciones sobre caché obsoleta.
- **Mocks con semántica real de BD:** Cuando una consulta utiliza claves compuestas de ordenamiento (`created_at` DESC, `id` DESC) y paginación keyset, el mock del builder debe reproducir fielmente esa ordenación y desempates; de lo contrario, los tests de cursor calculan expectativas erróneas sobre el array crudo.

## Ronda 5 — 2026-10-18
- **H15 / puerta externa:** no confundir éxito en CI de GitHub unit/db con estado del gate confiable `e2e-preview` publicado vía commit status externo; R4 informó apta para merge sin mirar el contexto RED. El fallo concreto era T-306 y ya tenía issue #405 + fix PR #407 mergeado en develop, así que integrar ese fix por merge y evitar duplicar tarea.
- **H16 / carrera multipágina:** un resultado exitoso de `queryFn` de página 1 NO certifica `useInfiniteQuery` entera. Sin test de 2+ páginas, el setter de frescura reabre UI con cache de página 2 mientras el fetch general sigue en curso; mover la habilitación al settle global de consulta después de epoch de reconexión.
- **Distinguir certeza:** H15 es hecho comprobado en status/logs; H16 es riesgo causal fundado en estructura y semántica documentada, aún exige test React/TanStack real para confirmar regresión.
