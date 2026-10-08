# Lecciones — PR #304 / T-349

## Patrón detectado

**P08 — control-no-cubre-lo-que-dice**, H01. El control es correcto para el instante que observa, pero el invariante prometido describe un intervalo mayor. Los checks en verde no prueban ausencia de regresiones en momentos no instrumentados.

## Recomendación de proceso (sin AG nuevo)

Antes de afirmar que un control detecta regresiones de aislamiento, enumerar sus ventanas de observación: antes del hijo, después del hijo y al terminar la batería. Construir una mutación independiente dentro de la ventana no cubierta, restaurarla siempre, y exigir RED por la regla real. Mantener separado lo que confirma el test de lo que requeriría instrumentación continua.

No se asigna número AG sin examinar el máximo global de todas las ramas remotas; la norma existente P08 ya describe el defecto. No modificar `AGENTS.md` por un único caso.

## Qué conservar

El autor documentó el fallo focal intermitente, evitó aumentar los timeouts y mantuvo las mutaciones A-D con sus expectations originales. El cierre del issue #243 permanece manual tras verificar su DoD.
