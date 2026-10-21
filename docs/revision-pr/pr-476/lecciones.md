# Lecciones — PR #476 / T-389

**Fuente:** PR476-H01, pendiente de evidencia operativa; no se demostró un defecto de código de T-389 en las rondas 1 y 2.

## Lección candidata (sin número AG)

**Nunca declarar en el body que un E2E ya tiene evidencia cuando la última bitácora todavía dice «pendiente».** En especial cuando varios Preview disparan ejecuciones en paralelo: `cancelled` es un resultado distinto de `failed` y de `success`. Para certificar una tarea visual, exigir run, SHA y prueba efectivamente ejercida.

### Ronda 2 — Separar verificación focalizada de gate general

La bitácora agrega la ejecución local del autor donde «Flujo 5» pasó con `elementFromPoint`, pero el total de su `main-flow.spec.ts` tuvo un T-360 fallido y `e2e-preview` oficial permanece cancelado. El revisor debe:
- reconocer la evidencia específica sin inventarle la condición de gate global en verde;
- evitar culpar el código nuevo por un timeout de login que ocurre antes de abrir la página modificada;
- registrar ambos síntomas de QA en issue separado (#479) **sin dar por probado que comparten causa**;
- conservar el DoD y la independencia de aprobación de la PR.

No se propone cambiar `AGENTS.md` ni debilitar el workflow en T-389; cualquier cambio debe ser revisado como tarea QA aparte y fundado en reproducción.

## Limitaciones

Sin clon local ni traces originales del autor, la inspección y los logs GitHub no reemplazan ejecución independiente de mutaciones RED→GREEN. Se conserva un harness propuesto en `evidencia/comandos.md` desde ronda 1, **sin declararlo corrido**. `verificado_en_sha` permanece nulo para H01.
