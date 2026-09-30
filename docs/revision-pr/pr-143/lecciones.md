# Lecciones — PR #143 / T-318

## Ronda 1

- **La anti-enumeración es una propiedad de todos los resultados observables, no solo del copy.** La ficha corrigió el caso `identities: []` pero dejó dos códigos explícitos de existencia en un camino de error.
- **Una ficha puede ser internamente contradictoria aunque `verify-fichas` pase.** El control actual garantiza que el primer DoD coincide con el plan, no que los ítems posteriores no lo contradigan.
- **La PR documental separada fue la decisión correcta.** El alcance propio quedó en dos archivos y #142 puede esperar a que la tarea sea oficial en develop.

No se propone todavía una nueva regla AG: la anti-enumeración ya es una decisión explícita y el problema está en completar correctamente su DoD.

## Ronda 2

- H02 confirma que la protección anti-enumeración debe especificarse por propiedad observable completa, no por códigos de error aislados.
- H01 muestra un riesgo operativo de ramas documentales cortas en un develop muy activo: la sincronización puede quedar obsoleta entre corrección y revisión. No cambia la regla; el cierre debe comprobar siempre el develop vigente, no el SHA que estaba vigente cuando el autor terminó.
