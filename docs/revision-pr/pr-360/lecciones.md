# Lecciones — PR #360 / T-359

**Patrón:** La implementación básica es coherente con el objetivo, pero la reconciliación de dos sesiones, los estados terminales y la caducidad requieren controles más fuertes que mocks unitarios de navegación.

- **AG-37/P06:** enumerar la clase completa de estados `draft/published/matched/in_transit/delivered/cancelled/expired` y el ciclo de oferta `pending/accepted/rejected/withdrawn`, además del tiempo de vencimiento.
- **P08:** un spy de `router.push` no prueba Back/refresh real ni concurrencia. Usar E2E Preview con contextos aislados y oráculo DB.
- **AG-36/P03:** la bitácora del autor documenta pruebas; sólo revisión independiente escribe `hallazgos.jsonl` y `verificado_en_sha`. Body con SIN BLOQUEANTES no debe coexistir con tests pendientes.

No asignar AG-xx nuevo sin consultar el máximo en todas las ramas remotas; no se alteran reglas globales con evidencia aún no ejecutada.
