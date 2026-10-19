# Ronda 2 — T-365 / PR #390 — 2026-10-17
**Revisor:** independiente, distinto del autor KiraK72. **SHA revisado:** `6356f994457954b5ff0a5c7c27bb01098697d6fb`.
**Resultado:** **CON BLOQUEANTES**. Frente I mayormente implementado, no mergear hasta corregir guarda stale y pruebas; Frente II permanece pendiente de CC, por decisiones anteriores.

## Verificación técnica
- Patch de PR: + filtros `.eq('status','pending')` en `src/server/live/t204.ts:314` y `src/features/requests/queries.ts:967`, colocados antes de `.order`/`.limit`. Buena solución concreta, sin refactor ni SQL.
- `RequestOffersList` agrega validaciones en CTA y botón confirmar; conserva `current = currentInOffers ?? currentInInitial` en su effect. En React Query `initialOffers` sigue siendo prop mientras `offers` se actualiza tras fetch. Si `offers=[]`, `initialOffers=[pendiente anterior]`, `request.status='published'`, el efecto NO cierra modal. `selectedOffer.status` sigue pending y confirma o vuelve a fallar. **PR390-H05 sigue parcial.**
- El test de cierre solamente cambia `initialOffers` por rerender; eso no simula refetch real. Test «refetchea» comprueba texto, no cuenta invocaciones. PR390-H10.
- Test `queries.test.ts` introduce `const builder: any` y devuelve oferta prefabricada independientemente de los filtros. PR390-H11.
- La prueba de estados terminales dice cubrir `cancelled,rejected,expired,withdrawn,ausente`; solo usa `cancelled,rejected,ausente`. Falta `accepted` además de `expired`/`withdrawn`.
- Body de PR no tiene `Closes #353`, correcto. Pero marca [x] para concurrencia/idempotencia y offline sin pruebas nuevas suficientes. PR390-H12.
- Frente II: historial mediante CC + RPC segura + cronología en detalle + motivo normalizado, **sigue pendiente**; no modificar SQL antes de CC. H02/H06/H07 se anotan como dependencia externa, NO regresión de Frente I.

## Matriz de hallazgos anteriores
| Hallazgo R1 | R2 | Fundamento |
|---|---|---|
| H01 implementación incompleta | parcial | Frente I sí, Frente II aún CC |
| H02 historial/CC | abierto - externo | pendiente CC, autorizado por Lautaro073 |
| H03 Live no filtra | arreglado-sin-verificar | filtro presente, CI verde, mutación solo estática |
| H04 SSR no filtra | arreglado-sin-verificar | filtro presente, CI verde, mutación solo estática |
| H05 modal/caché stale | parcial, bloqueante | fallback de `initialOffers` |
| H06 historial de `published` | abierto - externo | falta cronología según 2-A |
| H07 motivo libre | abierto - externo | falta proyección normalizada según 3-A |
| H08 evidencias/DoD | parcial | CI sí, tests del caso incompletos |
| H09 sincronización develop | abierto, mejora | ahead 5 / behind 2, mergeable true pero `merge-tree` no ejecutado |

## Hallazgos nuevos R2
- **H10 / ALTO / src/features/requests/components/request-offers.test.tsx:534-648:** tests no ejercen clase entera, desaparición tras refetch real ni refetch declarado. Bloqueante por insuficiencia de guardia de regresión.
- **H11 / MEDIO / src/features/requests/queries.test.ts:1157:** `any` explícito y mock que no modela filtros; quitar `any` y probar comportamiento filtrado real.
- **H12 / MEDIO / body PR / docs/tasks/log/T-365.md:** DoD marcado completado sin evidencia para concurrencia/offline y E2E real pendiente.

## CI observada del mismo SHA
- `unit`: 135 suites / 2.498 tests PASSED; workflows 79 y ADR 6; inspeccionado log de job `117312028603`.
- `db-tests`: 26 archivos / 2.341 tests PASS al final, `git diff --exit-code` presente; inspeccionado log de job `117312028537`. Aparecen FAIL intermedios dentro de pruebas de mutación y luego PASS de restauración; no atribuirlos a falla final.
- Checks `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `Vercel`: success. `approval-policy`: final success tras comentarios, **no demuestra** cierre técnico.
- `e2e-preview` tiene status success, pero **no hay spec nuevo T-365 ni E2E multiusuario demostrada**. CI no prueba la secuencia de T-365 por sí sola.
- **Independiente:** revisión del código y simulación de la condición del effect; mutaciones estáticas de filtros, GREEN→RED en memoria. **NO se ejecutó Vitest, Playwright ni pgTAP localmente**, porque no hay checkout accesible (git ls-remote falla por DNS). No falsificar resultados.

## Decisiones
1-A, 2-A, 3-A vigentes, sin nuevas decisiones. Prioridad: resolver bug stale de Frente I en esta PR, mantener historial en CC separada.

## Prompt para KiraK72 (idéntico al comentario GitHub)
Tarea T-365, PR #390, rama `feat/T-365-cancelacion-cadete-ofertas-historial`; revisión independiente ronda 2 sobre SHA `6356f994457954b5ff0a5c7c27bb01098697d6fb`. **Primero: `git pull` para traer el nuevo commit de revisión** y compará HEAD/remoto. Sin rebase, force-push, amend ni merge a develop/staging/main. **No tocar `docs/revision-pr/**` ni firmar verificación independiente.**

Decisiones de Lautaro073 YA CERRADAS: 1-A CC separado de RPC segura sobre `request_cancellation_reasons`, 2-A cronología dentro del detalle del pedido, 3-A motivo normalizado permitido. No solicitar repetirlas. No implementar SQL/RLS ni historial en esta rama hasta CC aprobado y ficha reconciliada.

**Podés modificar SOLO** `src/features/requests/components/request-offers-list.tsx`, `src/features/requests/components/request-offers.test.tsx`, `src/features/requests/hooks/use-request-offers.ts` y `.test.tsx` únicamente si el caso offline/estado del hook realmente lo exige, `src/features/requests/queries.test.ts`, `src/server/live/t204.test.ts`, `docs/tasks/log/T-365.md`, y descripción de PR. `src/server/live/t204.ts` y `src/features/requests/queries.ts` se conservan salvo defecto reproducido en filtros. Para E2E de Frente I, si se implementa, solo `e2e/specs/request-states.spec.ts` o `main-flow.spec.ts`. No cambios `src/domain/**`, `src/ui/**`, `src/lib/live-contracts.ts`, SQL/migraciones, secrets, `.github/**`, dependencias, ficha o timeouts.

**Paso 1 — PR390-H05, arreglar modal que retiene oferta desaparecida:**
En `RequestOffersList`, el effect actual usa `const current = currentInOffers ?? currentInInitial`. **Eliminar por completo ese fallback a `initialOffers`**: una vez que el hook entrega lista actual, la fuente de verdad de elegibilidad es `offers` (la query del cliente). Calcular `currentOffer = offers.find(o => o.id === selectedOffer.id)`; cerrar modal si `!currentOffer || currentOffer.status !== 'pending' || !canAccept`. **Validar también en `handleConfirmAccept`** la oferta vigente buscándola en `offers` por id (no confiar en el `selectedOffer.status` capturado en el pasado) y no llamar a `acceptOfferAction` cuando desapareció. Si `OFFER_NOT_PENDING`/ `ALREADY_MATCHED`, invalidar/refetch y comunicar error accesible aun si modal desaparece; conservar al servidor/RPC como última autoridad. Para condición offline, usar el estado de conectividad ya provisto por `onlineManager` en el hook, sin store global nuevo: UI no debe habilitar aceptación de instantáneas cuando la app está offline o sincronización no confiable. Mantener limpieza de listeners.
**Test RED real:** con `initialOffers=[old pending]` inmutable, renderizar y abrir modal; entregar por `fetch`/QueryClient la respuesta posterior `{data:[],nextCursor:null}` y comprobar que el modal desaparece y que no se llama `acceptOfferAction`. Repetir con respuesta que sustituye la oferta por estado terminal y request que deja de ser published; online→offline→reconnect con respuesta tardía, evitando falsos GREEN. No usar rerender de `initialOffers` para simular Realtime. **Mutación independiente:** restaurar en memoria `currentInOffers ?? currentInInitial` y ver el test RED; volver a implementación correcta y GREEN. Otra: quitar verificación de membresía en `handleConfirmAccept`, el test debe volver a RED.

**Paso 2 — PR390-H10/H11, pruebas reales y sin any:**
- En `request-offers.test.tsx`, usar tabla de casos `accepted, rejected, withdrawn, expired, cancelled, undefined` (además de `pending` válido), y comprobar botón, modal y que NO se llama a action. No titular casos que no ejercitás.
- Caso `OFFER_NOT_PENDING`: afirmar que `refetch/fetch` se invoca, que la respuesta actualizada elimina la oferta y que el error se anuncia al usuario. **Mutación quitar `void refetch()` -> RED**. El test actual solo busca el texto y por eso no detecta esa mutación.
- `src/features/requests/queries.test.ts`: reemplazar `const builder: any` por builder tipado con `vi.fn().mockReturnThis()` y `eq: vi.fn(function(this: ReturnType<...> | ...){ ...; return this; })` o estructura tipada análoga, SIN `any`, `@ts-ignore`, casts evasivos ni silenciar lints. Testar 51+ ofertas mixtas con mock que **aplica** restricciones `eq` antes de `order/limit`, y verifica `nextOffersCursor` conforme solo pending. Agregar test equivalente para Live, junto al existente, preservando CC-016. Testar que retirar filtro pending de CADA consulta produce RED funcional, no solo que `_calls.eq` contenga un string.
- No fabricar resultados, no adulterar mocks/expectations/snapshots ni modificar código productivo solo para que el test pase.

**Paso 3 — PR390-H12, CI/DoD y evidencia:** el body hoy pone [x] para concurrencia/idempotencia, offline y RED/GREEN que la suite nueva no comprueba completamente. Marcar esos puntos pendientes mientras no haya tests reales, o aportar los tests correspondientes y resultados. Mantener `Ref #353`, NO `Closes #353` porque Frente II sigue abierto. Corregir backslashes mal escapados del body. E2E Preview del escenario pertinente `match→courier_cancel→no falso error→vieja no aceptable→nueva pendiente→rematch` si los fixtures existentes lo permiten en Supabase Develop, sin prod, y registrar SHA/run real. El histórico completo queda en CC separado; NO simularlo con toast.

**Comprobaciones y cierre:** capturar evidencia original GREEN, mutación RED, restauración GREEN de cada propiedad; incluir comandos y resúmenes de salida reales en `docs/tasks/log/T-365.md`. Ejecutar `pnpm vitest run src/features/requests/components/request-offers.test.tsx src/features/requests/queries.test.ts src/server/live/t204.test.ts src/features/requests/hooks/use-request-offers.test.tsx`, `pnpm typecheck`, `pnpm lint`, `pnpm test`. En CI revisar SHA y totals de unit + db-tests; no Supabase/Docker local. Sin edición de `docs/revision-pr/**`. Commit `fix(requests): cerrar oferta obsoleta tras refetch [T-365]`, push normal; entregar `git ls-remote origin feat/T-365-cancelacion-cadete-ofertas-historial`. No afirmar «verificado»; solicitar ronda 3. No aprobar ni mergear.
