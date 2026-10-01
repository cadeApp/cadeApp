# Revisión PR #175 — T-323

- **PR:** #175
- **Rama:** `feat/T-323-merchant-map-hardening`
- **SHA funcional R2:** `04133f01d6a1b42142336ce3bd97db20a2bbd98e`
- **develop vigente:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- **Ronda:** 2
- **Resultado:** **CON BLOQUEANTE (1)**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR175-H01 | alto | arreglado-verificado |
| PR175-H02 | medio | arreglado-verificado |
| PR175-H03 | medio | arreglado-verificado |
| PR175-H04 | alto | abierto |

## Resumen

Los tres hallazgos de Ronda 1 quedaron corregidos y revalidados de forma independiente. El HEAD funcional `04133f01d6a1b42142336ce3bd97db20a2bbd98e` tiene CI exact-head completamente verde: 1593/1593 unit tests y 1614/1614 db-tests.

Después de ese HEAD, P1 decidió incorporar a T-323 la mejora de UX observada en staging. La ampliación quedó formalizada y mergeada mediante PR #176 en `develop@1457072a7cac1ae9e2a8a92abe9253d45b745082`.

El HEAD actual de #175 todavía conserva el mapa de cámara controlada con crosshair fijo, D-pad y badge de coordenadas, por lo que no satisface el DoD vigente.

La rama quedó divergida respecto de develop (6 ahead / 3 behind) y debe sincronizar `origin/develop` antes de implementar H04.
