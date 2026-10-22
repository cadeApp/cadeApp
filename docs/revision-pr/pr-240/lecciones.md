# Lecciones — PR #240 / T-334

**Fuente:** 5 hallazgos; todos cerrados.

## Patrón dominante

T-334 mostró dos formas de perder un contrato correcto: ampliar demasiado una excepción y resolver correctamente en el productor pero descartar el dato en el consumidor.

No se propone AG nuevo.

## Lecciones finales

- **H01:** una excepción exacta no debe implementarse con matcher de descendientes.
- **H02:** el marcador de completitud se persiste después del último fallo que todavía significa “no enviado”.
- **H04:** una ruta terminal `status` no pertenece a la misma excepción que las etapas editables.
- **H05:** cuando una decisión cruza server→client, hay que probar el dato transportado y el consumidor final, no solo el productor.
- **T-118:** ante conflicto con un control válido existente, se adapta la implementación; no se debilita el control.
- **H03:** la prueba manual fue decisiva: encontró dos contratos incorrectos que los tests iniciales no habían detectado.

## Seguimiento fuera del alcance

#243 sigue abierto para aislar las mutaciones de CC-007.

## Cierre

Ronda 5: 0 hallazgos abiertos. Merge autorizado explícitamente por Lautaro073.
