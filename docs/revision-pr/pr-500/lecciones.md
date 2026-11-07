# Lecciones PR #500 — T-390

**Patrón:** `P08-control-no-cubre-lo-que-dice`, reforzado por `AG-37` y `AG-38`. No se crea un número AG nuevo por un único caso.

El rechazo de un UPDATE (`throws_ok(..., '42501')`) no reemplaza la aserción del valor persistido de cada columna. `isnt(message, 'texto intentado')` es un falso control de inmutabilidad: acepta cualquier otro mensaje. Se debe sembrar un original explícito y afirmar igualdad exacta; el mismo criterio se aplica al ETA y al monto.

En `e343f34` el autor hizo una corrección mejor que la alternativa mínima: dio al fixture un mensaje original legible, aseguró `is` exacto y añadió el ETA conservado. La evidencia aquí es inspección y mutación semántica JS, no mutación PostgreSQL independiente.

**Operación E2E:** D01/A permite excepción de la revisión premerge cuando `e2e-preview` falla por *migración*, pero no convierte una prueba no ejecutada en verde ni dispensa `e2e-staging` obligatorio antes de producción. No desactivar gates.
