# Lecciones — PR #631 / CC-046

**Fuente:** PR631-H01, H02 y H03. Datos en hallazgos.jsonl.

## Patrón dominante

El arreglo funcional de una primitiva puede ser correcto y sus pruebas unitarias pasar, pero el DoD describe trayectorias visibles adicionales: el cierre debe recuperar el foco, y la geometría debe medirse en mobile y tablet. Un test de clase no equivale a una medición física del panel.

## Patrones existentes, sin nuevo AG esta ronda

- **pr-56/AG-37:** enumerar la clase entera. Aquí los caminos de cierre por Escape y navegación a otra ruta no son equivalentes, así como tampoco son equivalentes 390 y 1023 px.
- **pr-64/AG-63 y pr-82/AG-76:** un test necesita un oráculo que reaccione a una mutación de la propiedad real. La prueba nueva de foco debe fallar si se elimina toFocus.focus(), no solo porque el Sheet esté cerrado.
- **P08-control-no-cubre-lo-que-dice:** la suite nueva verificó la clase justify-end, y el E2E de 1023 pasó. Quedaban sin demostrar dos condiciones expresas del issue #630.
- **Proceso (H03):** CC-046 funciona como ficha, pero el issue pide bitácora propia. Decisión D02=B: log CC-046, no una T-xxx artificial.

No se asigna un AG nuevo sin una demostración RED propia: el entorno de revisión no accedió a un clon GitHub por DNS. Los controles, comandos y resultados faltantes quedan honestamente como pendientes.

## Qué preservar

- No volver a centrar el side=right ni cambiar side=bottom para hacer pasar tests.
- No tocar SheetContent ni lógica de navegación si la cobertura adicional comprueba que ya están bien.
- No asumir que un gate E2E global rojo es causado por este cambio: T-410/T-407 reportaron selectores estrictos duplicados en archivos no modificados por CC-046. Investigarlos por separado, sin declararlos resueltos.
- No exigir CI nuevo exclusivamente por commits documentales de aprobación y de revisión.
