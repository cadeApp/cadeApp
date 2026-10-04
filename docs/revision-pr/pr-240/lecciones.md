# Lecciones — PR #240 / T-334

**Fuente:** 5 hallazgos; H01/H02/H04/H05 cerrados, H03 manual pendiente.

## Patrón dominante

T-334 mostró dos formas de perder un contrato correcto: ampliar demasiado una excepción y **resolver correctamente en el productor pero descartar el dato en el consumidor**.

No se propone AG nuevo; H05 refuerza la regla de enumerar productores y consumidores de una decisión de navegación.

## Lecciones

- **H01:** una excepción exacta no debe implementarse con matcher de descendientes.
- **H02:** el marcador de completitud se persiste después del último fallo que todavía significa “no enviado”.
- **H04:** una ruta terminal `status` no pertenece a la misma excepción que las etapas editables.
- **H05:** probar el Server Action no alcanza si el componente cliente vuelve a calcular el destino con menos información. Cuando una decisión cruza una frontera server→client, el test debe cubrir el dato transportado y el consumidor final.
- **T-118:** un control existente puede rechazar una corrección funcional válida por violar otro contrato. La respuesta es adaptar la implementación, no debilitar el test.

## Infra fuera del alcance

#243 sigue abierto para aislar las mutaciones de CC-007.

## Pendiente

Solo queda repetir el flujo courier manual sobre `db42f52` o posterior. Si pasa, H03 puede cerrarse.
