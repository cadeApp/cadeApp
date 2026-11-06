# Lecciones — PR #629 · ronda 1

**Fuente:** [hallazgos.jsonl](hallazgos.jsonl), dos observaciones por inspección, de las cuales una bloquea.

## Patrón dominante

`PR629-H01` repite **P08-control-no-cubre-lo-que-dice**: comprobar `data-sheet-side` no prueba que el Sheet esté en la posición correcta. La propiedad observable solicitada es el borde derecho real y debe quedar respaldada por una prueba geométrica Playwright. La corrección arquitectónica va en `src/ui/sheet.tsx`, no en un parche exclusivo del consumidor T-405.

## Lecciones reforzadas (sin AG nuevo en esta ronda)

- **pr-56/AG-37:** enumerar consumidores de la primitiva cuando aparece una falla estructural. Al menos T-405 y el menú de `admin-nav.tsx` usan `Sheet side="right"`. El CC #630 debe enumerar todos los usos actuales antes de cerrar.
- **pr-62/AG-58 / pr-64/AG-61:** una aserción por atributo es un proxy, no la garantía geométrica. Mutar `justify-end` a `justify-center` debe poner rojo el control, sin editar expectations.
- **pr-82/AG-76:** una prueba de propiedad indirecta puede quedarse verde aunque el comportamiento importante siga siendo incorrecto.

## Mejora preventiva

`M01/PR629-H02`: E2E con fecha fija futura tiene un vencimiento silencioso. Calcular la fecha futura al ejecutar, y derivar de ella los textos esperados. Probar ambos lados del flujo (escritura y auditoría), no solo que el input acepte un string.

## Por qué no agregar una regla AG nueva

Los patrones anteriores ya tienen precedentes catalogados; la evidencia de esta ronda es **estática**, y no se reprodujeron RED/GREEN. Evitamos asignar un número AG desde una visión incompleta de ramas remotas.

## Advertencias

- La falta de navegador/clon impide asegurar que H01 se observa en una instancia real: la explicación de CSS y JSX es inequívoca, pero debe verificarse en el CC.
- M01 es una mejora futura, no un error funcional demostrado el 6/11/2026.
- Las decisiones D01–D04 ya fueron tomadas por Lautaro073; no volver a preguntarlas ni resolverlas de otra manera.
