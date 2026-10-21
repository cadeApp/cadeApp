# Informe revisar-pr — PR #475 · T-388 / T-389 · ronda 1

**Fecha:** 2026-10-21 · **SHA leído:** `967bf1ab02a1b079dd7b3873687b2c1fac6fe9e1` · **Base:** develop @ `33b18573ead16f34ebb07e9e0865c00ce52c0229`.
**Resultado histórico sobre ese SHA: CON BLOQUEANTES (6).** La ronda se registró después de que el autor subiera `bc12c2518b3dc29649529913f5d17b3107254c82`, por lo que las soluciones se comprueban por separado en ronda 2. Las decisiones se conocían antes de cerrar esta ronda; no se reabren.

## Decisiones de Lautaro073
- **1-B:** incluir distancia en «Mis ofertas», diferenciando relación no visible por RLS de distancia de solicitud visible pero NULL.
- **2-B:** mostrar «Menos de 0,5 km» cuando el servidor calculó exactamente 0 m, sin cambiar SQL.
- Solución indicada: formateador y etiqueta únicos en src/lib; controles de proyección `.select()` para todo lector y vía viva; T-389 conserva D05-A y acepta descendiente de `elementFromPoint`.

## Hallazgos por inspección de 967bf1ab
1. **PR475-H01 (ALTO)** — T-388 Archivos permitidos carece de componentes de «Mis ofertas», lista/historial/detalle comercio y tests para un formateador compartido. La vía viva `src/server/live/t204.ts` sí fue agregada correctamente por `967bf1ab` y no es hallazgo pendiente.
2. **PR475-H02 (MEDIO)** — `merchant-requests-list.tsx:240-242` usa «X km» sin prefijo «≈». El DoD ya pedía «≈ X km» sin habilitar modificar esa superficie.
3. **PR475-H03 (MEDIO)** — SQL `route_segment_distance` puede devolver 0 m cuando los puntos son idénticos, pero `formatApproxDistanceKm` devuelve null con `!distanceM`; distancias calculadas se muestran como ausentes.
4. **PR475-H04 (ALTO)** — Los tests propuestos no forzaban a cada consulta (feed normal, live, Mis ofertas y lista/historial/detalle comercio) a solicitar `route_distance_m` en el `.select()`. Mocks demasiado permisivos pueden devolver columnas no seleccionadas.
5. **PR475-H05 (ALTO)** — Cuando la RLS oculta la relación embebida `delivery_requests`, `getMyOffers` ve `null`; una relación visible con distancia NULL también daría null. El DoD no los diferenciaba.
6. **PR475-H06 (MEDIO)** — T-389 no explicitaba que repartidor entregado NO puede reportar según D05-A y que `elementFromPoint` puede devolver descendientes del botón válidos.

## Evidencia
Lectura de contratos, diff y componentes existentes del SHA. No se ejecutó un clon ni la suite del proyecto; los hallazgos son **por inspección**. El script documental independiente reproducido sobre los dos SHAs da **2/14** para 967bf1ab y **14/14** para bc12c251; comprueba el cambio en la ESPECIFICACIÓN, no funcionamiento de la app. Ver [comandos](../evidencia/comandos.md).

## Recomendación en esa ronda
Corregir exclusivamente `docs/tasks/T-388.md`, `docs/tasks/T-389.md` y §8 del plan; no implementar código en esta PR ni modificar `docs/revision-pr/**` como autor. El autor subió `bc12c2518b3dc29649529913f5d17b3107254c82`; resultado de revalidación en [ronda 2](ronda-2.md).
