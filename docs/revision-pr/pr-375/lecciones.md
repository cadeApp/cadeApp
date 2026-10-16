# Lecciones de PR #375 — T-358

**Origen:** 8 hallazgos de la ronda 1 sobre `b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91`. Todos en estado **abierto**, ninguno certificado mediante ejecución independiente.

## Lección 1 · Null en el modelo NO implica ausencia de elemento visual
PR375-H01 y H06: `MapPicker` consume `value=null` pero mantiene un `activeCoords` de fallback y renderiza un pin. Refuerza **pr-82/AG-76**: un test que afirma solo una API de superficie no verifica el comportamiento final. La prueba correcta monta el componente REAL y verifica ausencia del marcador.

## Lección 2 · Un PATCH no puede volver a escribir un snapshot
PR375-H02/H03: al enviar todos los valores precargados se produce update ciego y riesgo de perdida concurrente. Refuerza **pr-68/AG-74**: escrituras condicionadas deben afirmar las condiciones/filas realmente actualizadas. Aplíquese actualización por claves presentes, transacción y pruebas con interleaving.

## Lección 3 · Opcional no equivale a nullable y ausencia no equivale a error
PR375-H04/H05: `undefined` significa «no tocar»; `null` significa «borrar explícitamente». Los errores de Auth no son una sesión ausente. Refuerza **pr-56/AG-37** (enumerar la clase completa de variantes), **pr-63/AG-68** (el rojo declarado no demuestra un control) y **pr-64/AG-61** (mutar controles).

## Lección 4 · La evidencia de un SHA no se hereda a otro
PR375-H07/H08: E2E de `42ace275` en verde, run del HEAD posterior `b3ace3eb` cancelado. La bitácora debe citar ambos; un checkbox no reemplaza una corrida. Refuerza **pr-68/AG-73** y **pr-56/AG-36** (autor no firma verificación).

## Recomendaciones para próximas PR
- En tests de mapa, comprobar DOM/marker real y no solo el prop de un mock.
- En updates multitabla, probar fallo parcial, falta de fila, carreras y bypass de RLS; si la tarea no autoriza RPC, abrir CC antes.
- Los comentarios y DoD de la ficha deben corresponder al contenido real de la PR.
- Las mutaciones propuestas por la revisión se vuelven a ejecutar tras cada arreglo; no se confía en la batería del autor.

**Numeración:** deliberadamente no se asigna nuevo AG-xx: no se pudo ejecutar `git grep` sobre **todas** las ramas remotas para calcular máximo global; estos aprendizajes refuerzan lecciones numeradas preexistentes.

## Ronda 2 — casos omitidos que aparecen al editar
- R01: GPS no válido es un dato de entrada rechazado, NO una orden de borrar una ubicación previamente almacenada. Probar con pin existente y guardar otro campo.
- R02: los selectores de edición no pueden suponer que todo valor histórico siga en el catálogo active=true; representar estados retirados sin mostrar IDs técnicos.
- R03: setters múltiples con validación sobre cierres de estado obsoleto dejan errores fantasmas. Validar pares vinculados de forma atómica y probar el mensaje visible.
- No asignar AG-nuevo sin determinar máximo en todas las ramas remotas.

## Ronda 3 — R04: salida local del autor no corresponde al último SHA
El primer commit de ronda 3 introdujo el test R03 sin llave de cierre, con bitácora que afirmaba 32/32 tests y 2414 tests totales. GitHub Actions registró TS1005 y una suite sin cargar. Se corrigió en otro commit durante la revisión. Antes de afirmar verde en la bitácora, ejecutar pruebas DESPUÉS del commit final y esperar CI HEAD, no heredar salida de worktree anterior.
Este caso refuerza P15-entregable-declarado-pero-no-ejecutable y P08-control-no-cubre-lo-que-dice; no asignar nuevo número AG hasta verificar catálogo.

## Ronda 4 — cierre, evidencia y proceso
- Relacionar **siempre** CI y E2E al último SHA funcional: `d25721a` tuvo 2414 unit/2341 DB/79 E2E Chromium + 3 global y Vercel exitosos.
- Distinguir ejecución de suite original por CI de un mutante dinámico; los controles independientes de R4 son de **fuente estática**. La clase de mutante importa en el criterio de `verificado_metodo`.
- R04 demuestra que un test aparentemente pequeño puede bloquear TypeScript, lint, build y unit aunque la bitácora reportara verde local.
- Los históricos de fichas pueden conservar una nota anterior a la implementación. Tratar como deuda documental sin bloquear injustificadamente una feature con CI/E2E verdes si no altera contratos ni scope.
- No asignar AG-xx sin comprobar catálogo global.
