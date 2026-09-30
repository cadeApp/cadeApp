# Lecciones — PR #143 / T-318

## Ronda 1

- **La anti-enumeración es una propiedad de todos los resultados observables, no solo del copy.** La ficha corrigió el caso `identities: []` pero dejó dos códigos explícitos de existencia en un camino de error.
- **Una ficha puede ser internamente contradictoria aunque `verify-fichas` pase.** El control actual garantiza que el primer DoD coincide con el plan, no que los ítems posteriores no lo contradigan.
- **La PR documental separada fue la decisión correcta.** El alcance propio quedó en dos archivos y #142 puede esperar a que la tarea sea oficial en develop.

## Ronda 2

- H02 confirma que la protección anti-enumeración debe especificarse por propiedad observable completa, no por códigos de error aislados.
- H01 muestra un riesgo operativo de ramas documentales cortas en un develop muy activo: una sincronización puede quedar obsoleta entre corrección y revisión.

## Ronda 3

- **No todo avance de develop invalida automáticamente una revisión.** Lo relevante es si los commits nuevos cambian la superficie revisada, contratos, controles o workflows. En R3 los 7 commits posteriores eran exclusivamente T-301/E2E y no tocaban T-318, el plan ni CI.
- Exigir `behind=0` de forma absoluta en un develop muy activo puede generar un bucle de sincronizaciones sin mejorar la evidencia. La regla práctica debe ser: resincronizar cuando la deriva sea material para el PR; si es ajena, documentarla y verificar mergeabilidad + CI exact-head.

### AG-01 · Evaluar materialidad de la deriva antes de bloquear

> **Regla propuesta.** Si una PR queda detrás de `develop`, comparar los commits nuevos. Bloquear por sincronización cuando cambien archivos/contratos/checks relevantes o exista conflicto; si la deriva es ajena, documentarla y validar mergeabilidad y CI del head en lugar de exigir `behind=0` mecánicamente.
