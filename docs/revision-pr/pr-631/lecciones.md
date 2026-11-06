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


## Ronda 2 — corrección de nuestra regla de mutación

**Nuestro error en R1:** pedimos un RED quitando una sola llamada `toFocus.focus()`. El contrato verificable no es «este método se invoca», sino **«al cerrar con Escape, el foco vuelve al Trigger»**. Radix Dialog y `Sheet.setOpen` son caminos redundantes que satisfacen la misma postcondición. Si se muta solo uno, el otro mantiene GREEN. El autor demostró esa redundancia con dos mutaciones individuales supervivientes y una doble roja declarada. Corresponde reconocer que **la mutación propuesta por el revisor fue incompleta**, no exigir alterar producción para que pase.

El nuevo harness propio prueba (1) que side=bottom realmente conserva `justify-center`, atacando el caso opuesto al arreglo original, y (2) que el foco desaparece al quitar ambos mecanismos. No se ejecutó por falta de clon DNS: no asignamos verificación runtime al revisor. **Sin nuevo AG** hasta reproducir la batería.

**Regresión externa a CC-046:** `develop` 6e793e introdujo `docs/tasks/T-424.md` incompatible con `tools/verify-fichas.test.ts`. Su CI ya estaba rojo y GitHub Actions prueba el merge virtual, por lo que bloquea otras PR que no lo tocaron. Issue #637 contiene corrección documental exacta. No adjudicar a los cambios del Sheet un fallo del plan común.

La duplicación de texto en E2E T-410/T-407 se sigue por separado en #585/#636; no se corrige con `.first()` o retries para fabricar GREEN.


## Ronda 3 — cierre y evidencia de comportamiento

El CI sobre el SHA final es el oráculo del comportamiento observable corregido: `sheet.test.tsx` 4/4 y el E2E de navegación `admin-nav-mobile.spec.ts:109` realmente recorrió los cuatro cortes, Escape y el foco; pasó sin retries. El defectuoso script de mutación individual propuesto por el revisor en R1 no justifica rechazar un control de comportamiento con dos implementaciones redundantes. Sigue pendiente sólo la reproducción local de la batería de mutaciones, documentada con transparencia; no se reabre H01 por eso.

Otro aprendizaje de proceso: el CI de un PR evalúa un merge virtual con develop. En R2 una ficha ajena T-424 quebraba `verify-fichas` y detenía trusted E2E. Se reparó en develop por T-425/#635; el mismo CI en el SHA `89c9ed13615d02980f7ff28d3599fecb89b52852` corrió 3659/3659 tests, incluidos los 7 de `verify-fichas`. La PR #638 creada en R2 fue cerrada sin merge como redundante. Los test flakies T-407/T-410 tienen seguimiento externo por #636/#585 y no se silencian. No proponer un AG nuevo por una sola PR ni ocultar los retries en un gate exitoso.
