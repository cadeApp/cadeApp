# Ronda 2 — PR #501 / T-391 (SEC-05)

**Fecha:** 2026-10-21, hora de Argentina  
**Resultado: SIN BLOQUEANTES DE CÓDIGO O EVIDENCIA DOCUMENTAL. CI OFICIAL AÚN PENDIENTE.**  
**HEAD revisado:** `7c5aee2b0a9e53770cad20641cd451af818cee54`. **Último SHA de código:** `bbc4b4f1423efc3b14795c24a3fc374d95547`.  
**No se aprobó ni mergeó**; Lautaro073 decide la integración.

## Revalidación del alcance y procedencia

La comparación desde `bbc4b4f1` a `7c5aee2b` arroja cinco archivos de la revisión `docs/revision-pr/pr-501/**` y adiciones a `docs/tasks/log/T-391.md`, **sin cambios de aplicación**. La revisión leyó la ficha T-391 desde `develop` (ronda anterior), más bitácora y E2E actuales. Se compararon mecánicamente **SHA de blob** de `next.config.ts`, `src/security/headers.ts`, `src/security/headers.test.ts` y `e2e/specs/security-headers.spec.ts` entre `bbc4b4f1` y HEAD: **4/4 idénticos**. Sin archivos nuevos fuera del alcance ni modificación de contratos o SQL. GitHub informa `mergeable=true`; `git merge-tree` local no disponible por falta de clon.

## PR501-H01 — resuelto documentalmente, ejecución independiente pendiente

**Ronda 1:** faltaban pruebas de ejecución del E2E corregido que realmente abre Google Maps, una mutación negativa RED→GREEN y resultados CSP del flujo completo.

**Ronda 2:** la entrada nueva de `docs/tasks/log/T-391.md` registra para el SHA de código `bbc4b4f1` y su Preview:
- GREEN del spec `security-headers.spec.ts` con `--retries=0`: `7 passed (23.5s)`.
- Flujo del mapa: `Fijar en mapa interactivo`, respuesta OK de `maps.googleapis.com`, `map-container` y región `Map`.
- Violaciones `Content-Security-Policy-Report-Only`: dos en feed del repartidor y dos en nueva solicitud, las cuatro de Vercel Live `feedback.js` (`script-src`); cero declaradas de Maps/Supabase/app y cero enforced.
- RED del caso `-g "mapa real"`: `merchantContext.route(/maps\.(googleapis|gstatic)\.com/, route => route.abort())`, `1 failed` por `page.waitForResponse: Timeout 30000ms exceeded`.
- Restauración de la mutación (sin commit), `git status` limpio según la bitácora, misma prueba `1 passed (23.6s)`.

La condición de fallo y el camino de ejecución **coinciden con el código del E2E no modificado**: hay `waitForResponse()` con `response.ok()`, click de apertura y aserciones funcionales sin mock exitoso. La mutación evita la respuesta positiva, por lo que el timeout es un rojo relacionado directamente con la propiedad controlada. No se encontraron contradicciones entre la documentación y el código leído.

**Verificación del revisor:** ejecuté un comprobador mecánico de nueve propiedades de código/bitácora (9/9), y comparé los cuatro blob SHA (4/4 idénticos), mediante las herramientas de GitHub. **No ejecuté Playwright, el RED del autor ni una batería de mutación independiente en un navegador**: el contenedor carece del checkout y `github.com` no resuelve por DNS. Por esa diferencia, el estado estructurado es **`arreglado-sin-verificar`**, con `verificado_en_sha=null`. Esta limitación no significa que falte la evidencia documental que originó el hallazgo.

## CI y E2E oficial

- Para `bbc4b4f1`, el workflow CI #39706714620 terminó como **cancelled**, no `success`; `unit`, `typecheck`, `build`, `lint`, `audit` y `bundle-budget` marcaron éxito; `db-tests` quedó cancelado pese a incluir `Result: PASS` en el log.
- El E2E Preview #39706848472 para ese SHA quedó **cancelled**, no una falla funcional confirmada.
- Para `7c5aee2b`, al consultar CI #39707608956 seguía `in_progress`: `typecheck`, `build`, `lint`, `audit` y `bundle-budget` en `success`; `unit` y `db-tests` estaban ejecutándose. `e2e-preview` #39707734808 seguía pendiente. Vercel ya reportaba éxito.
- No llamar «verde» a checks pendientes/cancelados. **No exigir CI repetido exclusivamente por el commit documental de esta revisión**: la regla décima del proyecto aplica. Para merge, comprobar el estado final de los gates oficiales requeridos en un SHA con ese código, y resolver solo fallos reales si aparecen.

## Decisiones

D01=A permanece vigente y satisfecha por el flujo E2E: Maps real, no mocks de éxito. No se abre una decisión nueva; no hay mejoras de código exigidas en esta ronda.

## Cierre

**Resultado técnico/documental: SIN BLOQUEANTES en ronda 2**, con la distinción expresa entre verificación documental independiente y ejecución de Playwright pendiente. Ver hallazgo estructurado y harness completo en `../hallazgos.jsonl` y `../evidencia/comandos.md`. El comentario en la PR contiene el informe y el prompt de cierre juntos. No aprobar ni mergear.
