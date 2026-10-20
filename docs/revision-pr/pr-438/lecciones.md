# Lecciones — PR #438 / T-377

Esta ronda revisa una **ficha documental**, no código de implementación. No se adjudica un número AG nuevo sin consultar el máximo entre todas las ramas remotas, para evitar colisiones.

## Reutilizables

1. **Fallback por causa (H01):** un fallo de API con coordenadas completas no equivale a coordenadas incompletas. La ficha debe separar los estados sin reabrir un comportamiento explícito y testeado (T-363).
2. **Contratos externos reproducibles (H02):** «usar API X» no basta si hay campos obligatorios, ordenamiento, asincronía y límite de cuota. La ficha debe dar llamada mínima y pruebas que distinguirían la funcionalidad real de un mock tautológico.
3. **Costos condicionales (H03):** no declarar «gratuito» sin SKU, volumen y medición. Dejar explícito el supuesto y el paso humano de configuración.

Sin modificación sugerida de `AGENTS.md` en esta ronda por no alcanzar evidencia inter-PR para una nueva regla general.

