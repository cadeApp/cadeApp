# Informe de revisión independiente — PR #631 / CC-046 · Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/631  
**Código revisado:** 83deda5662462550816c579d49dfe9dfbccb9d7c  
**Base del diff funcional:** develop en fbd751aace5bcd476400ddad6ec40b29864c610f  
**Aprobación documental posterior:** a7eb631573010f05984703ae1d4040287d24255f  
**Fecha:** 2026-11-06  
**Resultado:** CON BLOQUEANTES (3). No aprobar ni mergear.

## Alcance y diagnóstico funcional

CC-046 es un contract-change para src/ui/sheet.tsx con issue propio #630. No existe ficha nueva T-xxx en develop para este CC; el contrato y el issue definen el alcance, con dependencia T-405. Los cuatro archivos tocados en el SHA funcional coinciden con el alcance exacto descrito en CC-046. La ficha T-405 se leyó desde develop, sin usar como fuente la versión del PR #629.

La propiedad de alineación está implementada en la primitiva: el wrapper conserva fixed, inset-0, z-50, flex, items-end, sm:items-center, y selecciona justify-end si side=right o justify-center si side=bottom. No se modifican las clases del contenido, el control open ni el foco. El test de clase comprueba los dos lados y el E2E de 1023 px comprueba el borde físico. Esto resuelve el problema geométrico original de PR629-H01 en la implementación inspeccionada, aunque no cierra todavía el conjunto de pruebas exigido por issue #630.

## Hallazgos

### PR631-H01 — Falta comprobar restitución de foco después de Escape (bloqueante, medio)
**Archivo:** e2e/specs/admin-nav-mobile.spec.ts:147-152; src/ui/sheet.test.tsx:7-45  
**Evidencia:** [ANÁLISIS del SHA funcional]. El test nuevo abre el menú, presiona Escape y afirma que el diálogo desaparece, pero no afirma que el botón «Menú» recupere el foco. El test unitario nuevo monta Sheet defaultOpen sin SheetTrigger y tampoco cubre Escape/foco. El E2E de navegación a 390 px sí verifica el foco después de seguir un enlace, que es otro recorrido: no demuestra el caso Escape solicitado por issue #630.  
**Arreglo:** luego de Escape, agregar await expect(admin.menuButton).toBeFocused() en ambos recorridos E2E donde corresponde. Agregar prueba unitaria controlada con SheetTrigger, apertura real, Escape y aserción de document.activeElement igual al trigger, sin mocks que puenteen Radix. Conservar la lógica original de Sheet.  
**RED requerido:** mutación temporal independiente de toFocus.focus() para que la aserción de foco falle con el diálogo cerrado; restablecer desde bytes guardados en memoria, sin adulterar el test ni registrar rojos inventados. Sin reproducir, no declarar verificado.

### PR631-H02 — La geometría a 390 px no se mide (bloqueante, medio)
**Archivo:** e2e/specs/admin-nav-mobile.spec.ts:116-152  
**Evidencia:** [ANÁLISIS]. El bucle geométrico usa [1023, 1024, 1280]. La suite separada con viewport de 390 comprueba navegación, no boundingBox del diálogo. A 390 px el Sheet right usa w-full, así que el borde derecho coincide con el viewport y x=0: NO se debe exigir x>0 a ese ancho.  
**Arreglo:** extender el caso geométrico para ejecutar también 390 px; medir boundingBox y el ancho real del viewport, afirmar diferencia de borde <= 1 px; a 1023 mantener x>0 y a 390 exigir x≈0 / ancho completo. Preservar cortes 1023/1024/1280 y las aserciones existentes. Añadir aserción de foco tras Escape.  
**RED requerido:** demostrar que el control de clase falla al centrar intencionalmente side=right; para el propio E2E móvil registrar green real del gate, sin falsear el RED si la infraestructura no permite ejecutarlo sobre mutación.

### PR631-H03 — No existe bitácora propia para CC-046 (bloqueante, medio)
**Archivo pendiente:** docs/tasks/log/CC-046.md  
**Evidencia:** [ANÁLISIS]. El issue #630 pide ficha/bitácora propias; el contrato CC-046 cumple la función de ficha, pero ese archivo de log no existe en el SHA. El cuerpo de la PR relata mutación local (1 failed, 2 passed), pero no hay bitácora de implementación persistida.  
**Decisión:** D02=B (Lautaro073, 2026-11-06). Crear docs/tasks/log/CC-046.md con hecho / pruebas con comandos y resúmenes reales / pendiente; documentar el baseline, la mutación exacta, rojo, reversión y verde; consignar SHA y corrida oficial. No afirmar evidencia ejecutada si solo se copió del cuerpo de PR. Los datos de CI observados por el revisor pueden citarse, no atribuirse a comandos locales del autor.

## Autorización P2 ya resuelta

D01: Lautaro073 actúa en calidad de P2 y aprobó el CC el 2026-11-06, sin excepción ni delegación. Registrado por revisión como cambio documental mínimo en el commit a7eb631573010f05984703ae1d4040287d24255f. No queda decisión de aprobación P2 pendiente. Esto no es aprobación ni merge del PR.

## Evidencia de CI y límites de verificación

- CI 42182058746 para SHA 83deda56: success. Pasaron build/typecheck/lint/audit/bundle-budget/db-tests/unit. El log unit muestra 194 archivos y 3657 tests passed.
- E2E gate 42183187374 para SHA de PR 83deda56, job 127777368393: los dos casos admin-nav-mobile.spec.ts:72 y :109 pasaron. Resumen: 117 passed, 1 failed, 1 flaky.
- El fallido es T-410/admin-trips.spec.ts:167 (fallo en :202 al usar getByText('Entrega 1 entregada') con dos coincidencias, tres intentos). El flaky es T-407/admin-audit-filters.spec.ts:69 (getByText('Mostrando los eventos de una sola entidad.') encuentra dos elementos antes de reintento exitoso). Son archivos fuera del diff; **no se demostró causalidad con CC-046**. No afirmar gate verde. Lautaro073 se responsabilizó de investigarlos antes de ronda 2.
- La revisión NO corrió typecheck, lint, Vitest, E2E ni la mutación del autor por falta de acceso al clon (git ls-remote no resuelve github.com); sí leyó código, logs de los jobs y API de GitHub. Por tanto no hay RED independiente verificado ni verificado_en_sha. El harness propuesto está en evidencia/comandos.md y no se presenta como ejecutado.
- GitHub indicó mergeable=true después de que develop avanzara; no hubo git merge-tree local. No confundir esto con prueba mecánica de merge limpio.
- No se levantó Supabase/Docker, ni se usaron credenciales/secretos.

## NO TOCAR — descartado o pendiente en otro lugar

| Hipótesis | Resultado |
|---|---|
| justify-end no alinea a 1023 px | Falso en CI del SHA: E2E geométrico 1023 pasó |
| side=bottom quedó afectado | No se encontró cambio funcional; unidad afirma justify-center |
| Es necesaria la aprobación de otra persona como P2 | No: Lautaro073 ejerce P2 y ya aprobó |
| El gate rojo prueba un fallo del cambio Sheet | No está demostrado: las fallas identificadas pertenecen a selectores de T-410 y T-407 |
| Debe editarse src/ui desde T-405 | No: el CC cambia la primitiva primero; la prueba geométrica del plan a 1280/390 corresponde después a PR #629 |

## Checklist antes de ronda 2

- [ ] PR631-H01 foco real tras Escape (unidad y E2E) con mutación RED de foco.
- [ ] PR631-H02 borde 390 px con x≈0, conservar 1023 px con x>0 y resto de cortes.
- [ ] PR631-H03 log auténtico en docs/tasks/log/CC-046.md.
- [ ] Autor no toca docs/revision-pr/**, no fabrica tests/RED/GREEN, ni debilita aserciones.
- [ ] CI oficial del SHA funcional actualizado, revisar E2E completo y documentar situación externa T-410/T-407.
- [ ] Confirmar HEAD remoto, comentarios y develop; realizar merge-tree limpio cuando se disponga de Git.
- [ ] Nueva revisión independiente tras push y git pull de la ronda.

**Conclusión:** tres faltas de cobertura/proceso subsanables, sin defecto nuevo demostrado de geometría de 1023. NO APROBAR NI MERGEAR.
