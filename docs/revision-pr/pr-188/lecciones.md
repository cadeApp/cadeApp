# Lecciones de la PR #188 para `AGENTS.md` y las reglas

**Fuente:** 5 hallazgos acumulados.

## Patrón dominante

P06 y P08 siguen explicando la PR: primero faltó el punto de integración y luego faltó enumerar el producto cartesiano de estados relevantes para un ítem UI compuesto.

## Lecciones propuestas

No se propone una nueva regla AG. El caso H05 es una aplicación concreta de P06:

> cuando una fila visual agrega varias entidades (por ejemplo, DNI frente+dorso), no basta probar presencia/ausencia y estados por separado; hay que fijar la **precedencia entre estados** en combinaciones parciales.

## Qué cambiar, en orden de impacto

1. Hacer que `rejected` tenga precedencia sobre “incompleto” en la fila agrupada de DNI.
2. Cubrir front rejected/back missing y back rejected/front missing.
3. Mantener H01–H04 sin regresión.

## Advertencias

- El primer build de CI #853 falló en `next/font`, fuera del diff; el rerun exacto pasó sin cambios.
- H05 no invalida la estrategia latest-by-uploaded_at ni la privacidad de metadata; es exclusivamente una precedencia de presentación.
