# Lecciones — PR #402 / T-369

- **H01 / P08:** una key de idempotencia en memoria de un componente garantiza reintentos dentro del montaje, no recuperación de una operación de pago/crédito con respuesta incierta tras remount/refresh. Probar persistencia de intento pendiente y nuevo intento independiente. Nunca equiparar mismo payload con misma compra para siempre.
- **H02 / P08:** una rama de error de una acción alternativa requiere estado de error propio además de toast. El test del camino exitoso y de otro botón no cubre el error de la alternativa.
- **H03 / P08:** .limit(100) sin cursor no constituye paginación. Probar al menos 151 registros y sort duplicado, tanto en catálogo como en selector de planes.
- **H04 / P10:** anotar «decisión de Lautaro073» en ficha desde una PR no prueba aprobación. La decisión auténtica D01-B reemplaza service role por RPC admin AAL2 con permisos mínimos y nuevas pruebas SQL, sin editar migración mergeada.

Se revisó estructura/CI pero no se ejecutaron tests ni mutaciones localmente. Por tanto se deja cada hallazgo `abierto` y se espera RED→GREEN verificable antes de certificarlo. No asignar numeración global AG-XX sin buscar el máximo en ramas remotas; referencias canónicas PR402-Hxx.

## Ronda 2

- **H02 — P08:** Manejar `ActionResult.ok=false` no equivale a manejar `Promise` rechazada. El caso de error de transporte requiere catch independiente; un diálogo que ofrece recuperación no puede depender de una promesa que siempre resuelve.
- **H04 — P08:** pgTAP verde de autorización y RLS no sustituye un control RED real en SQL mutado. Una mutación estática del texto no certifica que el test DB detecte un bypass. Hacer la mutación en DB efímera y exigir una **aserción de autorización roja**, no error de setup.
- D01-B continúa cerrada: arquitectura SQL correcta por inspección pero completar pruebas de sensibilidad antes de certificar. No elevar la regla de prueba a `arreglado-verificado` sin ejecución de un tercero.


## Ronda 3 — cierre

- **H02 / P08:** una promesa rechazada debe tener captura distinta del error de dominio `{ok:false}`; un test `mockRejectedValue` es necesario además del de estado de rechazo. Evitar toast como única señal de operación sensible.
- **H04 / P08:** los RED SQL que valen son los que corren contra el motor PostgreSQL con los mismos pgTAP y fallan por aserciones del contrato. Verificar baseline GREEN, mutación instalada, nombres y cantidad de fallos, estado restaurado idéntico y GREEN final. Aislarlos en DB efímera del job existente, sin desplegar mutantes.
- Se ejecutó auditoría estática propia del oráculo (14/14, siete negativos en copias) y se cotejaron logs de GitHub Actions (M1 6 RED, M2 4, M3 4, M3b 4, todos GREEN). La verificación local de Postgres NO se realizó; referir métodos y fuentes sin exagerarlos.
- **Gating de despliegue**: `e2e-preview=BLOCKED / REQUIRES DEVELOP MIGRATION` sobre una RPC nueva no equivale a e2e PASS y requiere tratarse explícitamente al merge/paso E2E; no simular ejecución verde para cerrar un proceso.
