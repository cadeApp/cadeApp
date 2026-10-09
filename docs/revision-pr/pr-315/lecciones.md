# Lecciones — PR #315 / T-347

**Patrón:** `P08-control-no-cubre-lo-que-dice`; fuente: PR315-H01.

## Aserciones distribuidas entre caso y helper

La prueba `DoD: Un courier no entra a (merchant)` llama a `expectMerchantPanelBlocked`, que contiene el `toHaveURL(expectedUrl)` relevante. Un control basado en `spec.includes('.toHaveURL(')` no verifica que *ese* test llegue a *esa* aserción. Tres mutaciones independientes eliminaron la conexión semántica sin cambiar el resultado del predicado global.

**Lección candidata para una regla global:** todo control estático que afirme que un test cubre un invariante debe verificar el vínculo entre el caso, el camino de ejecución (helper si corresponde) y la expectativa específica. Si la inspección estática no permite demostrarlo, depender del RED real de la ejecución, sin presentar un matcher presente en otra parte del archivo como cobertura.

## Prioridad

1. Reforzar `verify-workflows.test.mjs` en el caso courier usando la decisión 1-A.
2. Mantener siempre mutaciones independientes del revisor contra el *control*, además de las pruebas del autor.
3. Separar control estático (no demuestra RED runtime) del workflow `repository_dispatch` posmerge.

## Numeración

No se reserva un `AG-xx` nuevo: para asignarlo hay que calcular el máximo **en todas las ramas remotas**, no solo `develop`. Reutilizar el patrón existente P08 para análisis transversal. Referencias históricas: `pr-68/AG-75`, `pr-63/AG-68`. Esta PR aporta un caso adicional, no por sí sola un cambio automático a `AGENTS.md`.

## Ronda 2 — la evidencia exige flujo ejecutable e identidad, no apariciones textuales

El arreglo de H01 superó las tres mutaciones originales pero aún acepta como oráculo una **cadena literal**, una aserción dentro de `if (false)` y un bucle inalcanzable. Una prueba de autorización no puede clasificarse como courier si el caso ya no ejecuta `loginAsCourier` (H02). El caso y su helper requieren comprobación de **instrucciones ejecutables** y autenticación, no solo coincidencias de texto.

Los detectores basados en texto tienen límites; no prometer análisis semántico completo. Para este caso estrecho se puede exigir la secuencia de sentencias top-level conocida (decisión 1-A) y demostrar mutaciones independientes. Evitar AST genérico salvo justificación de escala. No crear una nueva regla `AG-xx` sin enumerar el máximo de todas las ramas.
