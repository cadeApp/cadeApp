# Lecciones — PR #312 / issue #311

La causa inmediata fue el `pnpm.overrides` explícito que congelaba `handlebars` en 4.7.9. Una nueva vulnerabilidad puede poner `audit` rojo **sin modificación de dependencias** entre dos commits, porque la base de advisories cambia. El control funcionó y detuvo la integración.

La solución adecuada es elevar **solo** la resolución transitiva a una versión corregida (4.7.10), conservando la política de audit y las reglas `eslint-plugin-boundaries`. Es inadmisible ocultar las GHSA como exclusiones para conseguir CI verde.

Autorrevisión no equivale a revisión por un tercero; los metadatos de comprobación deben explicitar la limitación aunque GitHub CI haya corrido satisfactoriamente.

No se asigna nueva regla AG por un único incidente.
