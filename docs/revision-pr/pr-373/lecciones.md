# Lecciones — PR #373 · CC-026 (ronda 1)

**Hallazgos:** 4, todos abiertos, por análisis del HEAD `eadaf54581b1c1cd3875e4a039ba66ffe70f0548`. Esta revisión es preliminar sobre una PR Draft WIP; no se infieren defectos de una migración aún inexistente.

## pr-373/AG-78 — Los schemas de RPC son contratos entre valores, no solamente listas de tipos

**Origen:** H01, H02 · `P11`/`P08`

Declarar errorCodes y usar `.strict()` da apariencia de contrato cerrado, pero dos propiedades básicas quedan fuera de la prueba: que **cada código de error emitido por el wrapper sea declarable** y que **el conteo coincida con la lista que lo justifica**.

> **Regla propuesta:** para cada RPC nueva, enumerar respuestas negativas de validación y autorización por todas las fronteras (fake, wrapper, SQL). En outputs con `count` y `ids`, afirmar relaciones estructurales con `.refine`/`.superRefine` y romper esas relaciones a propósito en pruebas de contrato.

## pr-373/AG-79 — El camino feliz del fake no verifica la frontera real ni toda la clase de estados

**Origen:** H03, H04 · `P06`

La prueba agregada pasa por un único comercio y dos solicitudes, mientras la implementación tiene guardas para consentimiento, estado previo, ofertas asignadas y lotes. La ausencia de casos negativos impide observar una regresión en cualquiera de las guardas.

> **Regla propuesta:** en RPC que altera estados por lotes, tests por actor (incluidos rechazos), transición vigente, borde exacto del reloj, 50/51/>100 filas y reintento sin side effects. El fake nunca sustituye pgTAP real de seguridad/atomicidad ni la revisión de fuentes de verdad.

## Advertencia

No promover reglas a `AGENTS.md` automáticamente por una sola PR. La demostración runtime y los mutantes independientes quedan pendientes de entorno con clon y suites disponibles; no escribir `verificado_en_sha` hasta ejecutarlos.
