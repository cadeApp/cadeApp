# Ronda 4 — PR #253 (T-309) — Revisión independiente

- SHA funcional revisado: `f3d783ba44c5cbe15f8b5c2485a18d91a93d202d`
- develop al revisar: `a773c05cc488a1fc60bfb36512cdca35d12d1271`
- Fecha: 2026-10-07
- PR: Draft · mergeable.
- Rama al revisar: ahead 30 / behind 6 respecto de develop.
- Decisiones pendientes: ninguna.

## Resultado

**BLOQUEADA POR DEFECTOS EXTERNOS (2).**

La implementación de T-309 ya no tiene hallazgos internos abiertos: **H01-H12 están arreglados-verificados**.  
El DoD todavía no puede cerrarse porque axe detecta dos defectos reales y preexistentes del producto:

1. **#296 — Viaje/mapa:** `aria-hidden-focus` y contraste insuficiente.
2. **#297 — Onboarding:** contraste insuficiente en las tarjetas de carga de documentos.

No se autoriza a silenciar, excluir ni debilitar estas reglas en T-309.

## H07 — cerrado

### M1
Commit temporal:
`c8a90db0dc1573894461030f8ce4ea876cfdad09`

Run:
`37548183777` · job `112557207995` · `e2e-preview = failure`.

El log demuestra **7 fallos independientes**:
- retry con corte persistente → timeout esperando path de `dni_front`;
- MIME mutado a JPEG permitido → falla la expectativa de rechazo;
- login → `image-alt`;
- crear solicitud → `image-alt`;
- feed → `image-alt`;
- viaje → `image-alt`;
- onboarding → `image-alt`.

La mutación fue revertida con:
`76c086bb7f638aa7bd0989e6efbe6a162fa19fff`.

### M2
Commit temporal:
`ee571ff71a37485f17f149443723676960edce3a`

Run:
`37550262717` · job `112563834547` · `e2e-preview = failure`.

El test de upload falla exactamente en:
~~~text
Locator: getByLabel(/selector-inexistente-t309/i)
expect(locator).toBeAttached() failed
~~~

La mutación fue revertida con:
`8cd5eb33cfd485078c30582db566870651a9e050`.

El head funcional final vuelve a usar `getByLabel(/DNI frente/i)` y no conserva ninguna mutación RED.

## H08 — cerrado

La bitácora registra el comando exacto:
~~~text
pnpm test
exit 0
121/121 test files
1921/1921 tests
57 workflow tests
6 ADR tests
~~~

CI exact-head `37554842296` confirma:
- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- db-tests ✅
- audit ✅
- bundle-budget ✅

## Gate E2E exact-head

Run `37554952589`, job `112578994444`:
~~~text
43 passed
2 failed
DoD: axe AA en viaje
DoD: axe AA en onboarding
exit 1
~~~

### #296 — Viaje

axe reporta:
- `aria-hidden-focus`, impact serious:
  ~~~html
  <div tabindex="0" aria-hidden="true"></div>
  ~~~
  con mensaje `Focusable content should have tabindex="-1" or be removed from the DOM`;
- `color-contrast`, impact serious:
  - foreground `#09babd`;
  - background `#f1f9f8`;
  - ratio `2.24:1`;
  - esperado `4.5:1`;
  - texto 14px bold.

Blobs idénticos rama/develop:
- `trip-courier-view.tsx` → `32e189c15cac0f5d2dbfb3cec533d77c5806ebce`;
- `trip-route-map.tsx` → `b98cf080172c60db5633b0d41d2c07b186480b3a`.

### #297 — Onboarding

axe reporta `color-contrast`, impact serious:
- `#09babd` sobre `#f3fcfc` → `2.29:1`;
- `#09babd` sobre `#ffffff` → `2.39:1`;
- esperado `4.5:1`.

Elemento representativo:
~~~html
<span class="text-sm font-semibold text-primary">Subir</span>
~~~

Blob idéntico rama/develop:
`document-upload-card.tsx` → `26ca248d2898a4e363ed687129617d14c32828de`.

Por lo tanto estos fallos **no son regresiones de PR #253**.

## Coordinación

No existían issues específicos para estos dos defectos. La revisión abrió:
- #296 — viaje/mapa;
- #297 — onboarding.

Ambos encajan en el alcance funcional de **T-205 / #32**, cuya ficha exige axe AA sin violaciones en onboarding y viaje.

## Prompt de continuación

~~~text
Tarea: T-309, PR #253, rama feat/T-309-uploads-a11y.

Ronda 4:
- H01-H12 de T-309 están cerrados.
- T-309 queda BLOQUEADA EXTERNAMENTE por #296 y #297.
- NO hay cambios funcionales que hacer ahora dentro de T-309.

NO TOCAR / PROHIBIDO:
- no deshabilites reglas axe;
- no uses disableRules, exclusions, tags reducidos ni waivers;
- no agregues .skip/.only;
- no cambies expectativas para aceptar violaciones;
- no edites src/** desde T-309;
- no edites docs/revision-pr/**;
- no crees tests falsos/adulterados para volver verde el gate;
- no rebase, amend ni force-push.

Estado externo:
- #296: viaje/mapa — aria-hidden-focus + color-contrast.
- #297: onboarding — color-contrast.
- Ambos defectos están también en develop; no son regresiones de T-309.
- Pueden resolverse como fixes separados o dentro del alcance de T-205 / #32, pero deben mergearse a develop antes del cierre de T-309.

Hasta que #296 y #297 estén mergeados:
1. No hagas cambios funcionales en T-309.
2. Mantené PR #253 en Draft.
3. No rerunees/retries para buscar un verde accidental.

Cuando AMBOS fixes estén mergeados en develop:
1. git pull
2. git fetch origin
3. git merge origin/develop
   - sin rebase/amend/force;
   - resolver conflictos conservando el spec final de T-309 y la decisión D01.
4. Confirmá que el diff contra develop sigue limitado al alcance de T-309 + docs/revision-pr/pr-253/**.
5. Corré:
   pnpm typecheck
   pnpm lint
   pnpm test
   Los tres deben terminar exit 0.
6. Ejecutá:
   pnpm exec playwright test e2e/specs/uploads-a11y.spec.ts --project=chromium
   Si local queda fail-closed por entorno, documentalo; no cuenta como fallo funcional ni como RED.
7. Push.
8. Esperá el e2e-preview del HEAD limpio.
   - Los 8 tests de T-309 deben quedar GREEN.
   - No aceptar flaky/retry como sustituto: inspeccioná la causa si alguno falla.
9. Solo con e2e-preview GREEN:
   - marcá el primer DoD [x];
   - actualizá docs/tasks/log/T-309.md con SHA + run/job + 8/8 GREEN;
   - actualizá el body de la PR;
   - no escribas “verificado por revisión”.
10. Mantené Draft y pedí Ronda 5.

No hace falta repetir las mutaciones RED M1/M2: ya quedaron demostradas y revertidas en Ronda 4.
~~~
