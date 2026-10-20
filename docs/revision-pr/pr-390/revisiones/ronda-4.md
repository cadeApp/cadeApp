# Ronda 4 — PR #390 / T-365 — 2026-10-18

**Revisor independiente:** asako669 (agy); autor: KiraK72.  
**SHA técnico inspeccionado:** `368a9d2b7f23570ea0a956696c1b13afa4281f68`.  
**Base de comparación:** `origin/develop` (`fec1e7e1...`).  
**Resultado:** **SIN BLOQUEANTES** (para el alcance de Frente I de PR #390). **No se aprobó ni mergeó en esta sesión.**

## Resumen de la revisión

En esta Ronda 4 se verificó la resolución exhaustiva de las observaciones planteadas en la Ronda 3 (H09, H13 y H14) sobre el SHA `368a9d2b`, confirmándose la integridad técnica de Frente I (Ofertas elegibles y sincronización tras reconexión) tanto por inspección como por ejecución local de las suites de prueba y validación de la CI de GitHub.

### 1. Resolución de hallazgos de Ronda 3
- **PR390-H09 (Merge conflict con develop — Resuelto):**
  - Se realizó merge `--no-ff` de `origin/develop` en el commit `bc7afcd5`, incorporando los cambios recientes de `develop`.
  - Conflictos resueltos limpiamente en `request-offers-list.tsx` y `request-offers.test.tsx`, preservando contratos y la carpeta de revisiones `docs/revision-pr/**`.
  - Comprobación independiente con `git merge-tree`: 0 conflictos, rama limpia y sincronizada.
- **PR390-H13 (Señal de frescura post-reconexión y defensa de caché obsoleta — Resuelto):**
  - En `src/features/requests/hooks/use-request-offers.ts`: se introdujo `offersSyncedAfterReconnect: boolean`, inicializado en `onlineManager.isOnline()`. Al pasar a offline cambia inmediatamente a `false`. Al reconectar a online permanece en `false` hasta que una consulta fetch iniciada estrictamente después de la reconexión finalice con éxito (rastreado mediante generación `syncRequiredGenerationRef` y contador de fetches).
  - En `src/features/requests/components/request-offers-list.tsx`: `canAccept = request.status === 'published' && isOnline && offersSyncedAfterReconnect`. Si la red cae o se reconecta pero el fetch fresco aún está pendiente, el botón «Aceptar» no se expone y el modal de confirmación se cierra automáticamente.
  - Batería de pruebas: 7 tests exhaustivos en `request-offers.test.tsx` y 6 tests en `use-request-offers.test.tsx` cubriendo desconexión, reconexión tardía con promesa diferida, fallos HTTP 500, respuestas vacías, peticiones desordenadas y limpieza de listeners.
  - Verificación RED/GREEN: comprobado que remover `offersSyncedAfterReconnect` de `canAccept` rompe inmediatamente el test correspondiente.
- **PR390-H14 (Mock builders con orden DESC compuesto y cursor keyset real — Resuelto):**
  - En `src/features/requests/queries.test.ts` y `src/server/live/t204.test.ts`: los mock builders implementan ordenamiento compuesto real (`created_at` DESC, `id` DESC) acumulado y filtrado keyset por cursor (`or(...)`).
  - Se testearon 55 ofertas pending con timestamps no monótonos y empate de fecha deliberado (índices 40 y 2) para validar el desempate por `id` DESC, además de 10 ofertas no pending que aseguran falla funcional si se omite el filtro.
  - Se validó la paginación completa de Página 1 (50 ofertas) y Página 2 (5 ofertas restantes, sin duplicados ni solapamiento).
  - Estricto tipado sin `any` ni `@ts-ignore`.

### 2. Estado de Frente II y dependencias contractuales
- Conforme a las decisiones cerradas de Lautaro073 (1-A: RPC segura con CC aparte; 2-A: cronología en detalle del pedido; 3-A: motivo normalizado permitido), Frente II (historial persistido con actor cadete) permanece diferido al Contract Change correspondiente.
- El PR #390 mantiene la referencia `Ref #353` y no utiliza `Closes #353`, respetando que el issue solo se cerrará cuando ambos frentes estén completados.

## Checks locales independientes
- `pnpm.cmd typecheck`: ✅ (código de salida 0, 0 errores).
- `pnpm.cmd lint`: ✅ (código de salida 0, 0 warnings, 0 errores).
- `pnpm.cmd vitest run src/features/requests/components/request-offers.test.tsx src/features/requests/queries.test.ts src/server/live/t204.test.ts src/features/requests/hooks/use-request-offers.test.tsx`: ✅ (4 suites, 158 tests pasados).
- `pnpm.cmd test`: ✅ (suite completa de Vitest, workflows y ADR pasando con código de salida 0).
- `pnpm.cmd test:db`: n.a. (Docker / Supabase local no iniciado; Frente I no incluye migraciones ni cambios de base de datos).

## Evidencia CI GitHub
- Run CI `39063665319` sobre el commit `368a9d2b7f23570ea0a956696c1b13afa4281f68`: **SUCCESS** (duración 9m2s).
  - `db-tests`: SUCCESS (8m59s)
  - `audit`: SUCCESS (24s)
  - `typecheck`: SUCCESS (27s)
  - `build`: SUCCESS (59s)
  - `unit`: SUCCESS (1m35s)
  - `lint`: SUCCESS (49s)
  - `bundle-budget`: SUCCESS (11s)

## Hallazgos de la ronda

### Bloqueantes
*Ninguno.* Todos los hallazgos de Frente I (H03, H04, H05, H09, H10, H11, H12, H13, H14) están resueltos y verificados.

### Mejoras (no bloqueantes)
- **PR390-M01:** En `src/features/requests/components/request-offers.test.tsx`, en el test `(1) offline: no CTA, no action`, la transición asíncrona de `onlineManager.setOnline(false)` emite una advertencia de React sobre `act(...)` en stderr a pesar de pasar la aserción. Puede envolverse en un `waitFor` o `flushMicrotasks` adicional para evitar ruido en consola en futuras corridas.

## Conclusión
Frente I de PR #390 cumple con todos los criterios de aceptación, contratos, invariantes de seguridad y estándares de pruebas del repositorio. No hay bloqueantes técnicos para su integración.
