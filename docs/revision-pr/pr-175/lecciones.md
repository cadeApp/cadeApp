# Lecciones — PR #175 / T-323

## Ronda 1

No se agrega número AG nuevo en esta ronda.

- **H01 refuerza P05 y AG-37:** un string de presentación como `coordsError` no debe convertirse en la fuente de verdad del invariante de bloqueo. Hay que enumerar todos los productores/limpiadores y derivar el bloqueo desde el dato canónico actual.
- **H02 refuerza P08 y AG-37:** un test de “preservar/restaurar handler global” con una sola instancia no cubre ownership concurrente. Para un callback global de slot único hay que probar montaje/desmontaje no-LIFO o usar una capa de subscripción.
- **H03:** la cobertura heredada puede y debe seguir verde; no se etiqueta como RED nuevo. La evidencia de TDD separa “regresión que ya existía” de “caso nuevo que falló antes del arreglo”.

## Ronda 2

No se agrega número AG nuevo.

- **H01/H02:** las mutaciones independientes confirman que los arreglos responden a la causa raíz y no solo a las pruebas del autor.
- **H04:** no se atribuye al agente un requisito que nació después de su último commit funcional. La decisión de staging se formalizó primero en develop mediante PR #176 y recién entonces se convirtió en DoD de revisión.
- Para controles globales de terceros, ownership concurrente y lifecycle no-LIFO forman parte de la clase que debe enumerarse.

## Ronda 3

- **H04:** la mutación independiente confirmó el contrato de eventos discretos; no alcanza con que el código “se vea” distinto al crosshair anterior.
- **H05 / P01:** al incorporar un componente de framework/SDK hay que verificar sus precondiciones runtime contra las configuraciones que el proyecto declara válidas. Los mocks que ignoran esa precondición pueden dar un verde falso.
- El requisito de `AdvancedMarker` y el contrato opcional de `mapId` deben probarse juntos; ninguno por separado alcanza.
