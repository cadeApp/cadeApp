# Lecciones — PR #747 / T-437

**Hallazgos nuevos:** 0. No corresponde consumir un identificador `AG-xx` sin defecto comprobado.

## Criterio de trazabilidad reafirmado

Una bitácora que cierra un trabajo por E2E y mutaciones debe distinguir **tres coordenadas**: (1) commit exacto probado por Playwright; (2) entorno de datos usado; (3) commit exacto probado por `e2e-mutation`. En este caso, E2E de #746 sobre `3da9a12e` con Develop y mutación de aprobación sobre el merge `abb122c6`.

El flake T-376 está registrado como **1 flaky, luego verde en retry**; no se oculta bajo el total de 132 PASS. Cada mutación de UI tiene ID de corrida y, cuando corresponde, intento. No confundir `RED_CONFIRMED` (control GREEN y mutante rojo esperado) con el viejo `CONTROL_NOT_GREEN` de aprobación.

## Separación de tareas

`#670` está completado. `#743` permanece abierto para los repartidores aprobados preexistentes (D4-C); la ficha T-437 lo excluye expresamente. «T-437 terminado» no equivale a «sin deuda operativa en el área».

## Límite

Esta PR solo documenta resultados ya registrados en CI y GitHub; no ofrece nueva evidencia independiente de comportamiento funcional ni una corrección de código. No se propone una regla adicional en `AGENTS.md` por un caso documental sin defecto nuevo.
