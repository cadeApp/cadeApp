# Lecciones de la PR #117

R5 añade una lección al patrón P08: **un check verde no significa que su invariante esté cumplido si el propio job es advisory**.

El job `bundle-budget` concluye success aunque reporte rutas por encima de 180 kB. Por eso la revisión debe leer el log y comparar contra `develop`, no limitarse al estado del job.

Caso concreto:
- develop: courier feed/offers = 176 kB;
- PR: courier feed/offers = 244 kB;
- CI: success con warning.

También refuerza la lección de barrels cliente: un nuevo `export *` público puede ampliar el grafo de módulos de rutas que importan solo una parte de una feature.
