# Lecciones de la PR #237 para `AGENTS.md` y las reglas

**Fuente:** 3 hallazgos, todos cerrados en Ronda 3. No hubo hallazgos nuevos en R2/R3.

## Patrón dominante

No hace falta una AG nueva:

- H01 fue una aplicación directa de pr-56/AG-37 / P06: enumerar la clase completa, incluyendo estado previo exitoso.
- H02 ya está cubierta por P13 y la directiva visual: label + target no equivalen a foco visible.
- H03 confirma que una tarea visual no se cierra solo con tests unitarios cuando la ficha exige navegador real.

## Qué funcionó

1. La matriz documento × etapa de fallo × estado previo hizo visible la regresión de persistencia que el primer test no cubría.
2. Separar asociación label/input, target y foco evitó tratar accesibilidad como una sola aserción barata.
3. La evidencia real contra Develop detectó que una cuenta vieja `pending` no servía para Storage; crear un courier por el flujo normal resolvió el entorno sin tocar RLS.
4. El E2E Preview final corrió sobre el SHA exacto y cerró la validación del ambiente compartido.

## No convertir en regla nueva

La ausencia del token `success` y el truncado del título largo son observaciones preexistentes del patrón compartido. No son evidencia de que T-325 haya fallado ni justifican ampliar AGENTS.md desde esta PR.

## Advertencia de método

R2 no tuvo worktree ejecutable y por eso dejó H01/H02 como `arreglado-sin-verificar`. R3 los cierra únicamente después de inspeccionar el SHA final, abrir la evidencia real y auditar CI/E2E exact-head; no se atribuye al revisor una mutación RED que no ejecutó.
