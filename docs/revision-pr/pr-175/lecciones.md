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

## Ronda 4

No se agrega número AG nuevo.

- **H05 / P01:** la corrección no se da por válida solo porque compila; el control tiene que ejercer las dos configuraciones runtime válidas (`mapId` presente y ausente) y sus handlers reales.
- **H06 / P11:** una decisión de producto mergeada en una ficha no sustituye un contract-change cuando el repositorio declara `src/ui/**` como contrato. La revisión R2/R3 falló al no cruzar T-323/PR #176 con CC-011 vigente.
- Cuando una tarea cambia un componente compartido ya gobernado por un CC, la revisión debe comparar **ficha vigente + CC vigente + implementación**, no solo ficha + diff.
- La evidencia manual que depende de un deploy estable debe ubicarse en el gate que realmente puede producir ese deploy; no se inventa un preview especial si el flujo de release ya define `develop → staging`.
## Ronda 5

- **H06 / P11:** una tarea que consume un contrato compartido debe volver a la implementación canónica después de que el contract-change mergea; mantener diff cero en los archivos contractuales evita una segunda fuente de verdad.
- **H07 / P10:** permitir merge a develop antes de un gate de staging no equivale a poder cerrar la tarea. El estado de issue/tarea y el estado del PR deben modelarse por separado.
- Los keywords `Closes/Fixes/Resolves` forman parte del comportamiento operativo: pueden violar un release gate aunque el código y CI estén perfectos.
