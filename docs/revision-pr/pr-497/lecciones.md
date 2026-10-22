# Lecciones — PR #497

**Origen:** 3 bloqueantes en documentos de contrato y fichas, sin cambios productivos.

## Patrón recurrente

La sincronía entre contrato, ficha y plan depende de **enumerar todos los casos afectados**, no de describir la operación de manera general. En CC-036 se nombraron 46/50/51 y se omitió el DELETE del caso 49. En paralelo, dos fichas nuevas quedaron sin filas mientras su sección de Fase 4 estaba en otra PR.

## Aplicable a futuras PR

- Antes de cerrar un CC que revoca permisos sobre una tabla, **enumerar con búsqueda textual** todas las apariciones de DML (`insert/update/delete/truncate`) en el catálogo de tests y cotejar qué asserts/ejecuciones sin captura cambiarán tras la migración. Patrón existente P06; no se requiere renumerar AG todavía.
- No crear fichas de una fase nueva que solo existe en otra PR sin integrar su sección y añadir sus filas. El control `verify-fichas` ya detecta este defecto: **conservarlo**, no silenciarlo.
- Si un test exige igualdad literal de DoD, usar el mismo resumen en la celda §8 y primer checkbox, dejando especificaciones más extensas debajo.

## Falsos positivos corregidos

No persistir el supuesto de que `REVOKE UPDATE ON public.offers` deja vigentes los grants por columna. La documentación oficial de PostgreSQL dice que el REVOKE a nivel tabla también revoca los permisos correspondientes de columna: https://www.postgresql.org/docs/current/sql-revoke.html.

## Alcance de evidencia

H01: análisis estático; H02/H03: fallo observado en CI del SHA original. No hubo mutaciones locales ni pruebas propias de PostgreSQL. Ninguna regla nueva en AGENTS.md por esta única PR.
