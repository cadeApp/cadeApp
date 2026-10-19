# Lecciones de la PR #426

## Patrón dominante

Una integración de ramas con historias de promoción puede quedar textual y sintácticamente resuelta pero contener duplicaciones semánticas en archivos auto-mergeados. Comparar sólo los archivos con marcadores no alcanza.

## Recomendación

Después de resolver conflictos, comparar el resultado contra ambos padres y ejecutar typecheck/pruebas focalizadas antes del commit. Para distinguir personalizaciones genuinas de snapshots viejos, comprobar la procedencia de cada blob conflictivo en el historial.
