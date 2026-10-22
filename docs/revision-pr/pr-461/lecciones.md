# Lecciones — PR #461 / T-379

Esta ronda se cierra con **0 hallazgos confirmados**. El archivo `hallazgos.jsonl` se deja vacío. No se asigna una nueva lección `AG-xx` sin evidencia de un patrón nuevo.

## Decisión reutilizable

Una ficha ampliada durante la implementación exige contraste mecánico con `develop` y ratificación de Lautaro073: **no** basta la firma del agente. En T-379, la ampliación de los dos archivos se ratificó expresamente y quedó documentada sin extender cambios fuera de esos dos ajustes.

## Observación separada

**OBS-01:** el fallback «Centro»/«Aguilares» cuando el embed queda oculto por RLS es anterior a esta PR, ajeno al alcance y no bloqueante. Puede registrarse como posible mejora de comunicación de ausencia de datos; no se le asigna patrón de regresión ni se altera la implementación.

## Calidad y limitaciones

- Los resultados oficiales `unit` (3004/3004), `db-tests` (3019/3019) y demás checks corresponden al SHA inspeccionado.
- Las mutaciones RED→GREEN y el E2E local del autor **no** se reproducen ni se presentan como validación independiente.
- El `e2e-preview` oficial queda como gate final antes de mergear, conforme a la decisión de proceso.
