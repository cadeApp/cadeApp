# PR #375 / T-358 — Informe de revisión independiente, ronda 4

**Resultado: SIN BLOQUEANTES** para el SHA funcional `d25721a6631151f9957c8efe07e5d857a2c11b28`. **Fecha:** 2026-10-16. Autor de código: Lautaro073/agy. Revisión independiente: ChatGPT.

## Alcance y cambios desde ronda 3

- `compare_commits(118d8560...d25721a6631151f9957c8efe07e5d857a2c11b28)`: 2 commits, ambos modifican **solo** `docs/tasks/log/T-358.md` (36 líneas); sin cambios de código ni tests desde ronda 3. El cuerpo de la PR se actualizó por el autor para reflejar evidencia y pendientes de la revisión.
- Todos los cambios de la PR están en los globs permitidos de la ficha `docs/tasks/T-358.md` leída de `develop`. Diferencia contra `develop`: 21 rutas permitidas; 14 commits ahead y 1 behind; GitHub indica `mergeable=true`. No se corrió `git merge-tree` local por falta de clon.
- CC-027 / PR #380, CC-028 / PR #382 y reconciliación de ficha / PR #383 mergeadas. No hay nuevo cambio de contrato ni decisión de producto pendiente.
- El autor no modificó `docs/revision-pr/pr-375/**` desde el commit de revisión de R3 `118d8560`.

## Verificaciones del HEAD exacto

| Fuente | Run/job | Comprobación REAL |
|---|---|---|
| GitHub CI | [38930136340](https://github.com/cadeApp/cadeApp/actions/runs/38930136340) | `unit` SUCCESS: **135/135 suites, 2414/2414 tests**, incluye **32/32 de onboarding-form.test.tsx**; `lint`, `typecheck`, `build`, `audit`, `bundle-budget` todos SUCCESS |
| db-tests | Mismo CI/job 117071713046 | **Files=26, Tests=2341, Result: PASS**; los `Result: FAIL` intermedios corresponden a mutaciones negativas esperadas de la suite CI, que se restauran; el resultado FINAL es PASS y db:types diff exit-code 0 |
| Playwright E2E | [38930252437](https://github.com/cadeApp/cadeApp/actions/runs/38930252437), job 117072209727 | **79/79 Chromium PASS**; test T-358 `merchant-registration.spec.ts:454` PASS (23 s), más **3/3 global-settings PASS** |
| Vercel | Status del mismo SHA | Deployment SUCCESS y check Vercel SUCCESS |
| approval-policy | Run 38930132309 (antes de esta ronda) | FAILURE con mensaje «Falta el informe completo de revisar-pr sin bloqueantes». Es un bloqueo de **formato documental**, no de código; esta ronda actualizará body con informe requerido. Verificar nueva ejecución después. |

**Checks locales del revisor:** no ejecutados (no existe clon instalable en este entorno; DNS de GitHub falla). Se leyeron y contrastaron logs CI del SHA correcto, más inspección programática y mutacional estática.

## Evidencia independiente de mutaciones: alcance honesto

El revisor ejecutó controles sobre el **texto de código actual devuelto por GitHub** (no sobre mocks ni promesas del autor):
- R01: rama de GPS fuera conserva las coordenadas. Control **GREEN** → reinsertar escritura `setFields({lat:null,lng:null})` **RED** → restaurar **GREEN**.
- R02: guard `inactiveZoneId` y `SelectItem disabled` con etiqueta legible. **GREEN** → borrar item histórico **RED** → restaurar **GREEN**.
- R03: dos controles: `setFields` conjunto para borrar pin, y hook que usa `resolver(nextCombined)`. **GREEN** → reemplazar por dos setters individuales / usar `resolver(values)` **RED** → restaurar **GREEN**.
- H08: el cuerpo PR actual pasa controles de estado e informes. **GREEN** → reinsertar «Draft inicial» **RED** → restaurar **GREEN**.

**Limitación:** estas mutaciones son pruebas **estáticas del texto fuente**, no se ejecutó `vitest` con los mutantes. La prueba de comportamiento sin mutantes sí fue ejecutada por GitHub CI y Playwright en el SHA funcional revisado. Por eso el `verificado_metodo` del JSONL incluye ambas fuentes y nunca dice que las mutaciones de Vitest se ejecutaron por este revisor. En `evidencia/comandos.md` queda el harness y las verificaciones para reproducción local.

## Estado de hallazgos

| ID | Severidad | Estado |
|---|---|---|
| PR375-H01 | alto | arreglado-verificado |
| PR375-H02 | alto | arreglado-verificado |
| PR375-H03 | alto | arreglado-verificado |
| PR375-H04 | alto | arreglado-verificado |
| PR375-H05 | medio | arreglado-verificado |
| PR375-H06 | medio | arreglado-verificado |
| PR375-H07 | alto | arreglado-verificado |
| PR375-H08 | medio | arreglado-verificado |
| PR375-R01 | alto | arreglado-verificado |
| PR375-R02 | medio | arreglado-verificado |
| PR375-R03 | medio | arreglado-verificado |
| PR375-R04 | alto | arreglado-verificado |

**Ningún hallazgo técnico abierto o bloqueante.** El historial de los 12 se conserva; `verificado_en_sha` apunta al SHA funcional `d25721a6631151f9957c8efe07e5d857a2c11b28`, no a este commit documental.

## Mejora no bloqueante (heredada)

En `docs/tasks/T-358.md`, sección «Notas para quien retome», persiste «esta PR solo publica las fichas» porque esa nota provenía de la preparación documental inicial en `develop`. Está desactualizada frente a PR #375 real, aunque NO afecta contratos, código ni pruebas. No se modifica la ficha desde la revisión: la regla de stage limita el commit a `docs/revision-pr/pr-375/**`. Aclarar esa frase en una futura reconciliación documental acotada, manteniendo `develop` como fuente.

## NO TOCAR: hipótesis descartadas y mejoras

- No reabrir H01/H02/H03 como si MapPicker o RPC no existieran; se mergearon en CC propios con pgTAP.
- R02: un barrio histórico inactivo se representa con `SelectItem disabled`; el selector compartido puede ofrecer experiencia imperfecta de navegación por flechas cuando la primera opción está inactiva. Mejora de accesibilidad **no bloqueante** sin cambio de `src/ui/**` ni nuevo CC mientras no se reproduzca impacto real.
- Nunca confundir el check `approval-policy` rojo con problema de implementación: espera el informe final de este revisor **en cuerpo del PR**, no solo comentario.
- El resultado rojo de parseo del primer SHA de R3 `837fc14` fue real, pero R04 fue arreglado en `17330878` y ejecutado en verde en este SHA.

## Cierre de ronda 4

**SIN BLOQUEANTES.** PR técnicamente lista para merge tras publicar el informe en el body y confirmar `approval-policy` verde; no se aprobó ni mergeó por esta revisión. Los checks de un nuevo commit SOLO documental vuelven a correr: su verde no se hereda automáticamente; verificar nuevo SHA y el preview antes de que Lautaro073 mergee.
