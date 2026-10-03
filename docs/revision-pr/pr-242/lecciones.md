# Lecciones — PR #242 (T-325 hotfix)

**Fuente:** 3 bloqueantes en Ronda 1.

## Sin AG nueva en esta ronda

Los hallazgos repiten controles ya conocidos:

- **PR242-H01** es `P08-control-no-cubre-lo-que-dice` y la misma familia de pr-82/AG-88: demostrar el comportamiento con un dato inyectado no demuestra que el consumidor productivo tenga una fuente viva/real.
- **PR242-H02** es enumeración incompleta (`P06`): al reutilizar una vista no alcanza con enumerar sus datos; también hay que enumerar las acciones contextuales que hereda.
- **PR242-H03** vuelve a `P08`: una frontera de error que no está en la prueba permite que una falla de infraestructura se convierta en un estado de dominio aparentemente válido.

No conviene agregar prosa nueva a AGENTS.md todavía; la mejora concreta es cerrar estos huecos con tests ejecutables.

## Decisión de alcance ya existente

La ficha de `develop` no contenía el hotfix al abrir la PR, pero el issue #241 fue creado por Lautaro073 y registra explícitamente la decisión de resolverlo dentro de T-325. Por eso no se genera un hallazgo de alcance por tocar `offers/feed`.

La expansión adicional que pide la revisión (`page.test.tsx`, `status-view.tsx`, `components.test.tsx`) es consecuencia técnica de cerrar los hallazgos; debe quedar escrita en la sección Hotfix de la ficha antes del cierre.

## Advertencia de método

La sesión de revisión no tuvo checkout ejecutable: DNS del contenedor no resolvió `github.com`. La carpeta registra inspección y mutaciones a reproducir, pero no inventa resultados RED/GREEN. La Ronda 2 debe ejecutar la batería independiente sobre el SHA remoto nuevo.
