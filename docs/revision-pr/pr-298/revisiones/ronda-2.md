# Informe de revisión — PR #298 / T-314 — Ronda 2

**Head SHA revisado:** `e72a45795b1fa165586a58d709b9faeb3a5bba99`  
**Base:** `develop@a773c05cc488a1fc60bfb36512cdca35d12d1271`  
**Fecha:** 2026-10-07  
**Resultado:** **CON BLOQUEANTES (3)**

Se revisó únicamente el commit de subsanación `0c143ac..e72a457`: modifica `e2e/specs/map-privacy.spec.ts` y `docs/tasks/log/T-314.md`, ambos dentro del alcance permitido.

## Resumen

| Hallazgo | R2 | Resultado |
|---|---|---|
| H01 | parcial | **abierto** |
| H02 | parcial | **abierto** |
| H03 | corregido | **cerrado** |
| H04 | corregido | **cerrado** |
| H05 | parcial | **abierto** |

## H01 · La auditoría de red puede quedar verde sin observar el fetch vivo — BLOQUEANTE

**Archivo:** `e2e/specs/map-privacy.spec.ts:156-208`  
**Estado:** [ANÁLISIS]

La mejora agrega un colector real de `document|fetch|xhr`, pero el test no exige que haya observado el endpoint que refresca el feed.

El producto usa `initialData` y `initialDataUpdatedAt: 0` en `useAvailableRequests`; la tarjeta sembrada puede renderizarse inmediatamente y el refetch de `/api/live/available-requests` ocurrir después. El test hace:

1. espera que la tarjeta sea visible;
2. ejecuta `Promise.all(pendingResponseReads)` sobre el array existente en ese instante;
3. exige `leakedResponses=[]`.

Si el response del fetch llega después del snapshot de `Promise.all`, no se espera ni se audita. Tampoco existe una aserción del tipo “vi al menos una respuesta de `/api/live/available-requests`”.

**Arreglo:** antes de `page.goto('/courier/feed')`, crear una espera explícita para la respuesta del endpoint vivo (o registrar URLs observadas y usar `expect.poll`). Después exigir:
- endpoint vivo observado exactamente/al menos una vez;
- cuerpo del endpoint sin los 4 centinelas;
- documento/RSC también sin centinelas;
- DOM sin coordenadas.

La ausencia no puede ser verde si el canal bajo prueba nunca fue observado.

**Mutation proof:** retrasar temporalmente la respuesta de `/api/live/available-requests` hasta después de que la tarjeta inicial ya sea visible y devolver un centinela. El test corregido debe seguir esperando esa respuesta y ponerse rojo.

## H02 · El GPS de entrega usa un locator ambiguo — BLOQUEANTE

**Archivo:** `e2e/specs/map-privacy.spec.ts:334-336`  
**Estado:** [ANÁLISIS]

En `/merchant/requests/new` existen dos botones con el nombre accesible **“Usar mi ubicación”**:
- retiro: `create-request-form.tsx:298` usa `copy.useMyLocation`;
- entrega: `create-request-form.tsx:392` usa el mismo texto;
- `copy.ts:16` define `useMyLocation: 'Usar mi ubicación'`.

Por eso `page.getByRole('button', { name: /usar mi ubicación/i })` devuelve 2 elementos. `toBeVisible()`/ `click()` sobre ese locator entra en strict mode y no identifica el GPS de entrega.

**Arreglo:** acotar semánticamente al bloque de destino/entrega o, como mínimo, afirmar que existen 2 botones y seleccionar explícitamente el segundo para entrega. No usar `.first()` sin demostrar qué sección representa.

**Mutation proof:** invertir el orden visual de retiro/entrega o insertar un tercer botón homónimo no debe hacer que el test pruebe el control equivocado; el scope debe seguir encontrando el de entrega.

## H03 · El caso feliz ya distingue mapa real de fallback — CERRADO

**Archivo:** `e2e/specs/map-privacy.spec.ts:376-402`  
**Verificado en:** `e72a45795b1fa165586a58d709b9faeb3a5bba99` [ANÁLISIS]

Ahora exige:
- `route-map-fallback` count 0;
- `map-pin-pickup` y `map-pin-dropoff` visibles;
- enlace externo seguro;
- URL parseada con origin/path/query canónicos.

La debilidad original del wrapper quedó corregida.

## H04 · El control “0 llamadas a Google” dejó de ser tautológico — CERRADO

**Archivo:** `e2e/specs/map-privacy.spec.ts:456-467` y helper superior  
**Verificado en:** `e72a45795b1fa165586a58d709b9faeb3a5bba99` [ANÁLISIS]

El helper registra `interceptedUrls` y `unexpectedGoogleUrls`, aborta fail-closed lo no contemplado y el caso exige:
- `interceptedUrls.length > 0`;
- `unexpectedGoogleUrls === []`.

Ya no puede quedar verde simplemente con cero tráfico.

## H05 · La evidencia de mutaciones y el body siguen siendo inconsistentes — BLOQUEANTE

**Archivo:** `docs/tasks/log/T-314.md:44-64` + cuerpo de PR  
**Estado:** [ANÁLISIS]

La bitácora afirma RED/GREEN funcional para H01–H03, pero la misma evidencia declara que la ejecución local integral deja **5 tests retenidos por el fail-closed de `stagingContext`**. Esos son precisamente los casos que usan fixtures reales; solo H04 corre sin staging. No se registra qué comando/entorno permitió que H01–H03 llegaran a sus aserciones mutadas.

Además el body dice:
- `pnpm test: ✅`;
- en la misma línea, “1984 tests pasando; **2 fallos** ...”.

CI del SHA sí muestra `unit`, `typecheck`, `lint`, `build`, `db-tests`, `audit` y `bundle-budget` en success, por lo que el problema es evidencia/redacción, no un fallo unitario confirmado de la rama.

**Arreglo:**
1. No afirmar GREEN de H01/H02/H03 sin dejar el comando y entorno autorizado que realmente llegó a la aserción.
2. La próxima entrada debe distinguir:
   - mutation RED reproducida;
   - GREEN del mismo caso;
   - E2E Preview del SHA final.
3. Corregir el body: si el `pnpm test` local tuvo dos fallos, no marcarlo ✅; indicar que el árbol comprometido queda respaldado por el job `unit` verde, o reejecutar `pnpm test` sobre un worktree limpio y registrar el resultado real.

## CI observado

Run CI `37694152798` sobre `e72a457`:
- db-tests ✅
- audit ✅
- typecheck ✅
- build ✅
- unit ✅
- lint ✅
- bundle-budget ✅

El run trusted `e2e-preview` `37694273759` estaba **in progress** al cerrar esta ronda. No hace falta esperar su conclusión para declarar estos bloqueantes estáticos.

## Para Ronda 3

- [ ] H01 exige explícitamente el fetch vivo.
- [ ] H02 locator de entrega único/scoped.
- [ ] H05 evidencia y body coherentes.
- [ ] E2E Preview del nuevo SHA inspeccionado.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` sobre árbol limpio, o evidencia CI equivalente explicada sin marcar fallos como éxito.
