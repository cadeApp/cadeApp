# Lecciones — PR #388 / T-369

## Origen y patrón

**Cuatro inconsistencias de especificación detectadas antes de código.** El defecto compartido fue la mezcla entre `reserva`, `consumo` y `reintegro` cuando hay un match fallido, y la equivalencia falsa entre primera acreditación y primera compra.

- H01/H03 reutilizan **P06-enumeracion-incompleta**: un vencimiento con ofertas pendientes también es «sin match», y `report_no_show(false)` entra en `cancelled` sin otra oportunidad de liberar su reserva.
- H02/H04 reutilizan **P05-semantica-invertida-vs-dod**: si un crédito se reintegra al saldo y además republicar es gratis, la contabilidad queda descubierta; descuento de primera compra no debe consumirse con una acreditación administrativa gratuita.
- El riesgo de `no_show(false)` fue localizado inspeccionando `app_private.request_cycle` real; es un ejemplo de **AG-37** (enumerar todos los caminos de una clase) y **AG-74** (transiciones/guardas contra el estado actualizado).

## Recomendación de mejora del proceso

Antes de aprobar un cambio contractual financiero, representar una tabla por evento: **estado anterior → evento → nuevo estado → movimiento en lote/reserva → derecho a republicar**. No basta que la prosa enumere acciones en una sola oración. Probar una mutación que convierta «vuelve a reserva» por «reintegra al saldo»: el control debe detectar la contradicción.

No se asigna número `AG-` nuevo desde este entorno: el máximo de todas las ramas remotas no pudo enumerarse y no corresponde arriesgar colisiones. Puede retomarse cuando la implementación T-369 aporte evidencia runtime.

## Límites

Es una PR de **ficha**, no de monetización implementada; los futuros pgTAP/E2E deben demostrar los invariantes. El validador textual no afirma que PostgreSQL vaya a cumplirlos.
