# Lecciones — PR #684 / T-409

## Catálogo: sin AG nueva

La ronda trata un inventario documental, no agrega implementación de seguridad. La lección aplicable está cubierta por **P06-enumeracion-incompleta**, **P03-comentario-contradice-codigo** y la exigencia de verificación independiente. No se acuña un número AG por un caso editorial aislado.

- **Enumerar toda la clase:** descomponer cada fila conjunta A-08/B-07 y A-09/C-04 en sus identificadores atómicos al comparar contra la bitácora. El conteo «20 issues» por sí solo no prueba «21 identificadores cubiertos».
- **Separar estado de implementación y estado del issue:** el issue #669 quedó cerrado por board-sync porque su título contenía T-391 (tarea ya mergeada). Al renombrarlo sin ese identificador y reabrirlo, se conservó correctamente pendiente: la CSP completa continúa Report-Only.
- **Etiquetas de dueño no son prioridad:** D1=A separó P1/P2/P3 (personas) de Alta/Media/Baja (urgencia), en ficha y issues.
- **Secuencia CC explícita:** D2=A permite cerrar inventario ahora pero exige contrato aprobado antes de implementar; SEC-12 requiere datos empíricos antes de decidir restricciones SQL.
- **Diferenciar residual y hallazgo original:** el envío push en tandas y el scrubber por patrones son correcciones parciales; sus issues deben describir el residual, no reiterar el diagnóstico original palabra por palabra.

Referencias de proceso ya existentes: pr-56/AG-32 (matriz por operación), pr-62/AG-58 (enumeración por unidad), pr-68/AG-75 (mutaciones propias), pr-63/AG-67 (commitear la evidencia). No atribuir comprobación runtime a una inspección documental.
