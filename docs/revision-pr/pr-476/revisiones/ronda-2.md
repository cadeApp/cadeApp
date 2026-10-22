# Informe de revisión independiente — PR #476 / T-389 — ronda 2

**Fecha:** 2026-10-21  
**PR:** https://github.com/cadeApp/cadeApp/pull/476  
**HEAD evaluado:** `0dd703d81b27eda5ccddf50fd4afda69584bf36f`  
**Código funcional sin cambios desde:** `2fe4935d233a0ade030f8adc1072304571e9a5d2`  
**Base develop:** `214404e0a2baca7ba7e4c87c35ef78c3de3d2109`  
**Decisión del titular:** **C** — aislar la inestabilidad de E2E/login en QA, conservar T-389, **sin eximir el gate oficial previo al merge**.  
**Resultado:** **CON BLOQUEANTES DE VERIFICACIÓN (1 parcial: PR476-H01).** Sin nuevo hallazgo de producto.

## 1. Comprobaciones de la ronda

1. `0dd703d8` tiene como padre `6a52d8fd` y modifica **solo** `docs/tasks/log/T-389.md`: agrega 24 líneas bajo un nuevo encabezado, sin alterar el registro anterior. Se verificó el diff del commit, no únicamente lo que afirma el mensaje.
2. Los archivos de producción y test de T-389 siguen idénticos a los inspeccionados en ronda 1. No hay desvío respecto de «Archivos permitidos» y no hay necesidad de tocar autorización D05-A, componente, selector ETA o test.
3. La nueva bitácora identifica Preview, SHA funcional de la validación local (`6a52d8fd`), selección `CI=true`, retries y resultados. **Son resultados informados por el autor y no acompañados por el log completo o traces adjuntas en GitHub.**
4. Se cotejó con el archivo de prueba: `main-flow.spec.ts` incluye las comprobaciones de T-389 dentro de «Flujo 5» (posición debajo de cancelar y `elementFromPoint` en el centro del botón). `T-360` pertenece a otro test, y `LoginPage.login` es helper compartido.
5. Se consultaron checks en GitHub sobre `0dd703d8`, y estado de `e2e-preview` por commit y logs. El workflow oficial para este SHA [39667810822](https://github.com/cadeApp/cadeApp/actions/runs/39667810822) terminó `cancelled` durante el gate; estado publicado `e2e-preview=error`. No debe presentarse como `failed` por aserción de T-389.
6. GitHub muestra `mergeable=true` a nivel de conflictos, **no es autorización de merge** ni cumplimiento de checks.

## 2. PR476-H01 — seguimiento de ronda 1

**Ruta:** `docs/tasks/log/T-389.md` (entrada append-only del 2026-10-21)  
**Estado:** **PARCIAL** (evidencia focalizada documentada, pero condición DoD del gate pendiente)  
**Detección de la ronda:** inspección de git/GitHub + cotejo con código del E2E; no ejecución independiente del local del autor.

**Qué mejoró:** en lugar de decir «E2E pendiente» sin evidencia, la bitácora agrega una **corrida local contra el Preview** que informa **7 passed, 1 flaky y 1 failed**; indica que pasó el **Flujo 5** con la verificación explícita del botón de T-389. También deja visible y sin esconder que **T-360 falló** tres veces en la suite completa, luego pasó aislado en develop y fue `flaky` aislado en el Preview.

**Qué no está comprobado:** no se recibió evidencia reproducible e independiente de esos resultados locales; además la **suite completa no terminó verde** y el gate oficial del nuevo HEAD **no terminó verde**. Queda incumplida la cláusula específica del DoD: `CI oficial y e2e-preview en verde`.

**T-360:** la localización del error reportada (`e2e/pages/login.page.ts`, antes de navegar al viaje) es compatible con un problema independiente de T-389; el historial #250, #245, #249 registra flakiness de login. **No demuestra raíz de latencia**, ni prueba por sí misma que T-389 no pueda interferir de otra forma. No abrir un hallazgo de aplicación sin un caso causal.

**Cancelaciones oficiales:** los runs `39640417342`, `39642083939`, `39667810822` se cancelaron. Hay corridas posteriores con workflow `success` pero job `e2e-preview: skipped`: **no contar ese success como gate aprobado**. El último estado publicado en el SHA `0dd703d8` durante la revisión fue `e2e-preview=error`.

**Seguimiento separado registrado:** [issue #479 — E2E Preview: T-360/login flaky y gate cancelado](https://github.com/cadeApp/cadeApp/issues/479), con dos líneas de investigación y sin atribuirles causa común. No tocar `src/**`, `e2e/**` ni `.github/**` dentro de esta ronda.

### Criterio objetivo para cerrar H01

Debe existir un log de `e2e-preview` donde el job real ejecutó **Chromium y global-settings** sobre SHA correcto y publicó estado **success**, con la prueba de `Flujo 5` incluida. Si existe falla real en otro test, diagnosticarla sin disimularla ni fabricar PASS. Un run cancelado no cubre el requisito. Revisión independiente actualizará `verificado_en_sha` solo tras confirmación efectiva, no porque lo afirme el agente autor.

## 3. Checks y seguridad

| Check (SHA `0dd703d8` antes del commit de revisión) | Resultado consultado |
|---|---|
| `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget`, `db-tests` | `success` reportado por GitHub Actions |
| Vercel | deployment `success` |
| `e2e-preview` | **`error`**; run cancelado, no aserción Playwright |
| `approval-policy` | **`failure`** — el informe sigue con bloqueo |
| `git merge-tree` ejecutado localmente | **No**: no hay repositorio clonable en este entorno |

No se leyó ningún `.env` ni se ejecutó Supabase remoto, Docker, secretos o workflows manuales.

## 4. Conclusión / disposición

**Implementación T-389: sin defecto nuevo identificado. Evidencia focalizada: favorable pero no verificada independientemente. H01: parcial. Merge: NO.** La decisión C evita cambios grandes en un PR funcionalmente correcto y separa el diagnóstico QA en #479. No se autoriza hacer pasar `approval-policy` por una revisión falsa, eliminar pruebas ni aceptar implícitamente una excepción al gate. No hay nuevas decisiones técnicas para Lautaro073.

## NO TOCAR

No editar la ficha T-389, D05-A, contratos, estilos, `main-flow.spec.ts`, timeouts, assertions, estados del gate ni el histórico `ronda-1.md`. Las correcciones de calidad del E2E necesitan su propia tarea/PR. No se precisa CI nuevo **solo** por el commit documental de esta revisión.

## Metodología / límites

Lectura de la ficha de `develop` ya contrastada en ronda 1, comparación del commit concreto `6a52d8fd..0dd703d8`, inspección de bitácora, fuente `main-flow.spec.ts`, `login.page.ts`, workflow `e2e-preview.yml`, checks y logs remotos. No hay artefactos raw de Playwright local ni clon; por eso las ejecuciones locales informadas se atribuyen expresamente al autor, y no se declara mutación RED→GREEN por cuenta del revisor.
