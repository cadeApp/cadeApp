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

## Ronda 2 — CC compartido y cobertura geométrica

- **H01:** el arreglo correcto ocurrió una sola vez en la primitiva `Sheet`, mediante CC-046. Se cotejaron por blob el código y la prueba exactos entre el CC aceptado y T-405. El E2E del menú en el CC sí comprobó posición, foco y restauración; el E2E nuevo de T-405 queda pendiente de gate. **No agregar AG nuevo:** refuerza `pr-64/AG-61` y `pr-82/AG-76`, que piden verificar el control real, no un atributo proxy.
- **M01:** el autor eligió una forma concisa y consistente de fecha dinámica: sumar 60 días en UTC, derivar texto de `pilotUntil` y compartirlo en dos expectativas. No está probado por el E2E hasta que corra el gate; no convertir inspección en ejecución.
- **Guardas de proceso:** un CC mergeado y un test de ese CC no equivalen a que el flujo nuevo de T-405 pasó en Preview. `arreglado-verificado` en H01 se refiere a la **causa raíz compartida** (con pruebas del CC y mismos blobs), no a la readiness del PR completo.
- **Seguimiento ajeno:** los textos duplicados del streaming están diagnosticados en T-426 (#639/#640); no modificar tests de T-405 para ocultar esa falla, ni agregar un hallazgo duplicado sin una reproducción específica.
