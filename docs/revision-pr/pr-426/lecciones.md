# Lecciones de la PR #426

## Patrón dominante

Una integración de ramas con historias de promoción puede quedar textual y sintácticamente resuelta pero contener duplicaciones semánticas en archivos auto-mergeados. Comparar sólo los archivos con marcadores no alcanza.

## Recomendación

Después de resolver conflictos, comparar el resultado contra ambos padres y ejecutar typecheck/pruebas focalizadas antes del commit. Para distinguir personalizaciones genuinas de snapshots viejos, comprobar la procedencia de cada blob conflictivo en el historial.


## Ronda 2 — sincronización incremental y gates separados

Una revisión del primer merge no certifica posteriores merges de develop: registrar padres y SHA actual, revisar diff frente a develop, revisar migraciones y pruebas del SHA exacto. El CI GREEN mide el código, no confirma backups ni ambiente hosted. La exclusión deliberada de global-settings de staging tampoco equivale a un PASS de esos tests.

Decisión A: no confundir ficha T-375 ya mergeada con implementación; excluir el arreglo de esta release permite minimizar el riesgo de promoción sin ocultar que sigue siendo deuda de QA en Develop. Mantener separados dictamen técnico, preflight operativo y consentimiento humano para merge.
