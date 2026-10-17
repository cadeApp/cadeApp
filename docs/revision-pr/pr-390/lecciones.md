# Lecciones — PR #390, ronda 1
1. **No confundir Draft diagnóstico con fix.** Si el diff es solo bitácora, no atribuir los 341 tests del baseline a la regresión reparada. PR390-H01/H08, patrones P15/P08.
2. **El historial de una asignación no es el estado terminal del pedido.** Una cancelación por cadete puede coexistir con `published` y nueva oferta; UI en detalle con proyección autorizada. PR390-H02/H06, patrones P10/P05.
3. **Filtro de elegibilidad antes de paginar y defensa por capa.** API Live, precarga SSR, caché/modal y RPC final deben manejar la misma clase completa `pending/accepted/rejected/withdrawn/expired/cancelled`. PR390-H03/H04/H05, patrones P06/P08.
4. **No convertir texto libre en evento público.** Motivo normalizado con whitelist para la proyección; SQL/RLS solamente tras CC. PR390-H07, P20.
5. **No inventar numeración AG.** No se asigna AG nueva hasta consultar máximo en TODAS las ramas remotas; próxima ronda documentará mutaciones independientes si se ejecutan.
