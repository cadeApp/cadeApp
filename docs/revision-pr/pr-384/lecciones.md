# Lecciones PR #384 — T-357

**Fuente:** 5 hallazgos técnicos por inspección (todos abiertos) + un incidente documental. No emitir `AG-xx` nuevos sin computar máximo en todas las ramas remotas, para evitar números repetidos.

## AG-36, repetición — autor no firma independencia

El agente autor creó `docs/revision-pr/pr-384/revisiones/ronda-1.md` y declaró «SIN BLOQUEANTES» sin una revisión externa. Este informe fue conservado como `autorrevision-agy-r1.md`. La bitácora, no `docs/revision-pr/**`, es el canal del agy. La revisión también encontró problemas de flujo no probados. El autor no puede completar `verificado_en_sha`.

## AG-37 + P08 — enumerar casos de edición, no solo el camino feliz

La matriz obligatoria incluye: alta incompleta / alta terminada; `?mode=edit` malicioso; cambios walk/bike/moto/car; patente válida/inválida; RLS de otro usuario; fila que desaparece entre lectura y update; lectura fallida; documentos vigentes/rechazados; consentimiento pendiente; visualización tras refresh, viaje y comercio. Un único E2E moto→bici no cubre esta clase.

## AG-75 — la mutación del autor no basta

Esta revisión ejecutó cinco mutaciones **estáticas**, todas detectadas por los controles estáticos, pero no confunde esa comprobación con una prueba de integración RED→GREEN. En próxima ronda debe ejecutar mutaciones runtime adicionales sobre lo nuevo, sin usar exclusivamente los tests/mutaciones aportados por el agente.

## Recomendación de contrato y despliegue

No ampliar esta PR con modificaciones de CC-025 (PR #364 todavía abierta) ni hacer desaparecer la protección de documentos por "arreglar" un formulario. Decisión 2-A establece flujos separados. Para edición hay que rechazar datos documentales inesperados; no reconsentimiento de alta. La decisión 1-A preserva `approved`: licencia/seguro opcionales conforme D9.

## Criterio de no-falsificación

Nunca relajar expectativa, fixture, mock, snapshot, timeout, coverage ni check para obtener verde. Los tests de persistencia necesitan respuesta real de actualización; los tests de privilegios deben identificar fila/actor real. Conservar la evidencia rojo y verde íntegra.

## Ronda 3 — progreso probado y residual P08

El job Playwright no es una prueba decorativa: se verificó en sus logs que realmente ejecutó 2 casos T-357 y que los 85 E2E pasaron. La cobertura nueva valida 3 cambios reales, tres reloads, DB persistida y conservación de estado; el agy corrigió adecuadamente la colisión de radio-locators de strict mode.

Sin embargo, el último kilómetro del DoD exige datos actualizados en `TripMerchantView`. Los tests de `queries.test.ts` y `components.test.tsx` ejercitan mapeo y presentación de forma separada; no prueban el recorrido *edición real → nueva consulta de viaje de comercio*. La prueba pendiente es una interfaz integrada, no una queja genérica sobre falta de tests. También debe provocarse una invocación maliciosa real de la Server Action con un courier no terminado; un test solo de `?mode=edit` no alcanza.

**Regla reforzada (P08/AG-37):** al afirmar un DoD de lectura posterior a una mutación, crear un caso en el que la escritura afecte un registro vivo y otra sesión/actor consulte exactamente esa proyección. Los tests aislados de serializer/render de un modelo prefabricado no sustituyen esa aserción. Sin mutación runtime propia, no certificar `verificado_en_sha`.


## R4 — Selector semántico y gate cancelado

El nuevo E2E integra dos sesiones reales, `get_trip_details` pre/post, cambio de vehículo y recarga del comercio. En la ejecución de `25a0a5ea` falló antes del primer oráculo UI porque `getByText('Repartidor asignado')` matcheó también un mensaje de coordinación del viaje. El agy respondió con una corrección correcta y mínima: `getByRole('heading', { name: 'Repartidor asignado' })` en `523b4989`, sin relajar aserciones. **No darlo por verificado**: la corrida Preview del nuevo SHA fue CANCELLED, con status error; se requiere GREEN real posterior. Cuando se hagan assertions sobre tipo/patente, usar ámbito de la tarjeta, no página global que puede contener comentarios de fixtures. El status CI unit verde jamás sustituye Playwright. El E2E cancelado tampoco acredita fallo de producto.


## R5 — los checks de un merge y no exigir CI por documentación

Al integrar develop hubo un build rojo en `next/font` (Montserrat), que pasó al repetir el job en el **mismo SHA** sin cambiar aplicación. La evidencia correcta es el intento fallido y el GREEN del mismo commit; no abrir una corrección especulativa de `layout.tsx` desde T-357. El E2E del SHA combinado demostró de punta a punta el viaje entre sesiones y la lectura de `get_trip_details`. Si después solo se actualiza revisión o bitácora, **no se exige un nuevo CI GREEN por el commit documental**: los checks se atribuyen al SHA de código previamente validado, y el informe registra explícitamente la diferencia. Se conserva el estado `arreglado-sin-verificar` de hallazgos cuyo mutante independiente en runtime no se ejecutó, sin falsificar la prueba.
