# Lecciones — PR #113

## Ronda 1

- Una suite DB completamente verde puede estar validando un contrato inseguro si la matriz de casos felices codifica el comportamiento incorrecto. Hay que contrastar los pgTAP con el master plan y las decisiones humanas, no solo mirar PASS.
- Una Server Action que valida rol no reemplaza autorización en una RPC SECURITY DEFINER. Si la RPC es invocable por authenticated, la matriz de roles debe vivir también en Postgres.
- Un identificador sensible enviado por la UI (`courierId`) no debe decidir a quién afecta una operación administrativa cuando el servidor puede derivarlo de `incidentId`.
- Los tests estructurales de wiring deben exigir los datos que gobiernan la regla de negocio. Contar componentes no prueba que reciban `actorRole`, `tripStatus` y `deliveredAt` reales.
- Keyset por timestamp solo no es estable. Para listas operativas se necesita desempate por ID, cursor compuesto y el índice en el mismo orden.
- Una batería de guardas negativas no reemplaza el happy path exacto de una frontera crítica: RPC llamada, payload, output y revalidación.
- Después de T-123, cualquier Dialog nuevo con acción sensible debe blindar también Escape y devolución de foco al disparador.
- El ownership de P2/P3 sirve como trazabilidad, no como aprobación bloqueante de PRs de Lautaro073.

## Ronda 2

- **Una captura que solo existe en la sesión del agente no es evidencia reproducible.** La directiva visual pide enlaces persistentes en PR y bitácora. El patrón ya usado por T-118 es una rama separada de assets que no contamina el PR funcional.
- **Un job verde no implica presupuesto respetado si el workflow degrada el límite a warning.** Hay que leer la salida: `/trips/[id]` termina en 194 kB aunque `bundle-budget` concluya success.
- **Para deuda preexistente se revisa también el delta.** La ruta ya estaba en 187 kB antes del GREEN; T-124 agrega 7 kB. No hace falta ampliar scope para saldar toda la deuda histórica, pero la feature no debería empeorarla.
- H03–H08 muestran una mejora real en calidad de tests: las guardas mutan comportamiento concreto (payload, wiring, keyset, RPC, foco y reset), no solo existencia de archivos.
- El route guard de T-122 protege `/admin/*` para admin+AAL2; por eso las lecturas RLS del detalle no abren un bypass de rol aunque la query no repita el chequeo.
