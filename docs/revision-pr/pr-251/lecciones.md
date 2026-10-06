# Lecciones — PR #251 / T-313

- H05: mover un lookup “antes del assert” no equivale a garantizar cleanup; la reconciliación de recursos creados por UI tiene que vivir en un camino de teardown/finally.
- H06: un RED que muere en una barrera ambiental antes de la aserción objetivo no demuestra sensibilidad del test.
- H07/H08: para convenciones/documentación conviene verificar por enumeración determinista completa, no por muestra.
- No se agrega AG nueva: H05/H06 siguen siendo P08.
