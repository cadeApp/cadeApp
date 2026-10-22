# Informe de revisión — PR #295 / T-338 — ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/295  
**HEAD funcional inspeccionado:** `43e5945f1d2519db37e260c114df51071bb3fe94`  
**Base registrada en PR:** `a773c05cc488a1fc60bfb36512cdca35d12d1271`  
**HEAD de develop al revisar:** `cd023e3453ead76983d54982df1548cb97aa57eb` (3 commits posteriores a la base)  
**Decisiones P1:** 0-A y 1-A, 2026-10-07; regularizadas en la ficha de la rama mediante `f5d1393f0391a9f5ff03741a9bec1728b2cb2fd7`.  
**Fecha:** 2026-10-07

## Resultado: CON BLOQUEANTES (2)

- **PR295-R01 (alto):** cuatro rutas públicas exceden el presupuesto de 180 kB por la regresión de First Load JS.
- **PR295-H07 (alto, gate):** E2E Preview se canceló sin ejecutar. No es evidencia de fallo funcional, pero impide cumplir DoD/CI GREEN.

**Manual requerido:** Android real instalado antes/después; no acreditado.  
**No se aprobó ni mergeó.** La PR sigue Draft y GitHub indica mergeable, sin embargo mergeable no implica lista para merge. No se ejecutó `git merge-tree` local; develop avanzó y debe revalidarse antes de mergear.

## Qué corrigió el autor respecto de la Ronda 1

| ID | Inspección exact-head | Estado estructurado |
|---|---|---|
| H01 | manifest `start_url='/login'`, ID '/', SW v2 sin caché '/', fallback 503 HTML, click /login, cuatro páginas cableadas, helper real | arreglado-sin-verificar |
| H02 | `standalone-navigation.test.tsx` importa/renderiza Home/Login/Register/Legal; casos normal/standalone | arreglado-sin-verificar |
| H03 | nueva sesión de bitácora nombra casos de consumidores concretos y sus fallos; entrada anterior histórica preservada | arreglado-sin-verificar |
| H04 | `is-ios.ts` llama `isStandalone()`, test mock discriminante contradice navigator.standalone | arreglado-sin-verificar |
| H05 | SW devuelve HTML propio 503 `Content-Type: text/html; charset=utf-8`; test ahora afirma estructura | arreglado-sin-verificar |
| H06 | E2E incorpora sonda rAF de visibilidad y flag `landing_was_visible` previo al redirect; **E2E no llegó a ejecutarse** | parcial |

El autor registró mutaciones RED específicas y tests GREEN en `docs/tasks/log/T-338.md` (sesión 19:55). No confundimos esas declaraciones con una reproducción independiente. En este entorno de revisión se leyeron código y logs remotos, pero no se ejecutó el harness independiente. Por eso H01–H05 no se marcan `arreglado-verificado`.

## PR295-R01 — Regresión de First Load JS superior a presupuesto (BLOQUEANTE)

**Severidad:** alta · **categoría:** efficiency · **patrón:** P08-control-no-cubre-lo-que-dice.  
**Área:** `src/features/notifications/index.ts`, wrappers `install/standalone-*.tsx`, imports de las cuatro páginas.

Se compararon salidas reales de `next build` en el CI original de `develop` (job `112665469344`, SHA `a773c05`) y del HEAD funcional (job `113057721190`, SHA `43e5945`):

| Ruta | develop baseline | PR HEAD | Delta |
|---|---:|---:|---:|
| `/` | 107 kB | 194 kB | +87 kB |
| `/legal` | 107 kB | 194 kB | +87 kB |
| `/login` | 162 kB | 224 kB | +62 kB |
| `/register` | 162 kB | 224 kB | +62 kB |

El job `bundle-budget` `113058233763` imprime "Supera el límite" para las cuatro rutas pero concluye `success` porque es advisory. El control de CI verde no sustituye cumplir 180 kB. No está identificada con certeza la dependencia exacta que infla el chunk; se debe perfilar el grafo client y los reexports, no atribuir la causa a ciegas a un archivo.

**Decisión 1-A:** P1 exige mitigación: cada ruta de la clase `/`, `/legal`, `/login`, `/register` <=180 kB, sin quitar el guard ni alterar SSR/hidratación ni desactivar el check. Autorizar el entrypoint en 0-A no autoriza el sobrecosto.

**RED→GREEN exigido:** reproducir los tamaños del commit `43e5945` en build real; después, en el nuevo HEAD, ejecutar `pnpm build` y un verificador cerrado sobre las cuatro rutas que falle si falta una o supera 180. El script copiable figura en `evidencia/comandos.md`.

## PR295-H07 — Falta ejecución del E2E Preview del HEAD (BLOQUEANTE de aceptación)

El run del Preview `37699126807` resolvió destino correctamente, pero el job `113058120541` terminó `cancelled`, por lo que `report-preview-status` publicó `e2e-preview=error` para `43e5945f1d2519db37e260c114df51071bb3fe94`. `Vercel=success` y `CI=success` no ejecutan ni reemplazan estos tests.

**Corrección exigida:** con el siguiente push funcional, verificar un run real y completo del SHA correspondiente, incluyendo `pwa-standalone.spec.ts` en proyecto `chromium`, sin disparar workflows manualmente ni reportar el gate como verde hasta ver el resultado. Si se vuelve a cancelar, dejarlo pendiente y diagnosticar causa operativa.

## PR295-A01 — Entry point fuera del alcance original: DECISIÓN ACEPTADA

La implementación modificó `src/features/notifications/index.ts` para reexportar los componentes standalone; inicialmente la ficha permitía únicamente `install/**`. La solución evita importar directamente los módulos profundos desde app y satisface la frontera de lint.

**Decisión 0-A:** P1 autoriza la modificación **solo** para reexports de standalone. Se regularizó en `docs/tasks/T-338.md` en commit `f5d1393f0391a9f5ff03741a9bec1728b2cb2fd7`. A01 queda `aceptado`, no `arreglado-verificado`.

## Verificaciones obtenidas de los logs

- CI run `37699020056` para `43e5945f1d2519db37e260c114df51071bb3fe94`: `unit`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` y `db-tests` concluyeron success.
- `unit` job `113057721008`: **125/125 archivos, 1961/1961 tests**; ver resumen real en logs del job. Esto prueba GREEN general del commit, no la eficacia de cada mutación.
- `bundle-budget` advisory: warning por rutas por encima del presupuesto; ver R01.
- Status de commit: `Vercel=success`, `e2e-preview=error`; el E2E se canceló antes de correr (ver H07).
- PR mergeable=true, Draft=true. `develop` avanzó tres commits desde la base y no se ejecutó un merge-tree local.

**Alcance de esta comprobación:** lectura exact-head + logs GitHub Actions. No se corrieron comandos localmente, mutaciones independientes ni pruebas Android reales; no se consultaron secretos ni se levantó Supabase/Docker.

## Gate manual human-only pendiente

Antes del cierre final, una persona con un Android real debe confirmar (y dejar en bitácora) que la PWA instalada con start_url anterior llega a /login sin landing, que la app reinstalada/actualizada abre /login, y que el navegador común conserva la landing. Ningún test de emulación sustituye esta validación.

## Ronda siguiente

El agy debe primero pullear el commit de revisión, perfilar y corregir R01 en archivos permitidos, producir build numérico RED→GREEN, preservar pruebas anteriores y disparar el Preview naturalmente mediante push. H07 se comprueba solo contra un run ejecutado con éxito; hasta entonces sigue bloqueante de gate. El informe de esta ronda y el prompt viven en un único comentario de la PR.
