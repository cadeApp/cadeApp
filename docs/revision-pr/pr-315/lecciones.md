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

## Ronda 3 — salidas anticipadas y límite de analizadores estáticos

H01 y H02 se corrigieron sin modificar el spec productivo: el detector liga login, rutas y helper a instrucciones de primer nivel. El revisor comprobó que una sentencia `return` o `throw` inmediatamente después del login invalidaba el test, pero escapaba al detector mientras solo exigía adyacencia entre la declaración `routes` y el bucle. Microfix de 1 condición: si existe login válido, la declaración `routes` debe ser la **segunda** sentencia de primer nivel. Se añadieron dos casos de regresión; se mantienen válidas sentencias inocuas posteriores al bucle.

**Límite documentado:** esto no constituye una prueba semántica general del código TypeScript; no hay análisis AST, y la lista de rutas se valida parcialmente. La garantía final de `RED_CONFIRMED` sigue siendo la mutación E2E real posmerge en T-347. No recomendar un parser grande solo por hipótesis futuras sin casos concretos.

**Disciplina de evidencia:** 13 comprobaciones ejecutadas directamente contra el verificador puro extraído del HEAD, no la suite completa `node --test` ni un Playwright mutado local. Los checks del HEAD de la PR sí provienen de GitHub CI. No confundir los métodos.
