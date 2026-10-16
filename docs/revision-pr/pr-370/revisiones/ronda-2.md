# Revisión independiente PR #370 — T-366 — ronda 2

**Fecha:** 2026-10-15. **HEAD de implementación revisado:** `3903388ef6869c218cd405ca0ccc164541ca22e6`. **Base PR:** `develop` @ `d947031a13ee19a725a1a024ef3eeb5f70ba4682`. **Responsable:** @KiraK72. **Estado:** PR abierta lista para review, NO mergeada.

**Dictamen: CON BLOQUEANTES (H01–H04); 1 mejora H05. NO APROBAR NI MERGEAR.** El CC-026 fue mergeado a develop y migrado con éxito (#373), pero la nueva integración no garantiza frescura en un caso legítimo de SKIP LOCKED.

## Fuentes y restricciones
- Se leyó la ficha autoritativa `docs/tasks/T-366.md` desde `develop`, junto con `docs/contracts/CC-026.md`, `AGENTS.md`, `docs/revision-pr/COMO-ENTREGAR.md`, catálogo, skill `revisar-pr`, comentario anterior de PR #370 y bitácora de Kira.
- Se leyó diff GitHub completo de PR #370: 10 archivos cambiados, 5 de revisión preexistente y 5 de documentación/código/test. Comparación `a76a84f...3903388e` indica que los múltiples commits de develop integrados en rama no son todos cambios propios de Kira; se evaluó el diff PR frente a base, no se imputaron al autor los cambios previos del CC.
- **No hay clon local accesible** (git ls-remote falla: DNS github.com) y por regla no se levantó Docker/Supabase. No se ejecutó pnpm/Vitest ni mutaciones independientes del repositorio. Se corrió una reproducción aislada Node **de la rama exacta 0/true**, no una prueba end-to-end del repo. Toda evidencia de CI se atribuye a GitHub Actions.
- La carpeta `docs/revision-pr/pr-370/**` ya contenía revisión independiente R1 y **no fue alterada por Kira** desde R1 según diff de commits; esta R2 es nuevo archivo, sin sobreescribir R1.

## H01 — CRÍTICO — locks salteados permiten lectura incorrecta
**`src/features/requests/queries.ts:25–40`**. La RPC SQL calcula `hasMore` sobre filas aún elegibles aunque `SKIP LOCKED` no haya cambiado ninguna. La nueva función retorna éxito si `expiredCount===0` sin atender `hasMore===true`. En consecuencia `getMerchantHistoryRequests` o `getMerchantRequests` ejecutan el SELECT con solicitudes vencidas aún `published`. En ese caso historial/Vencidas puede aparecer vacío y Activas contener solicitudes caducadas: el defecto que T-366 intenta eliminar.
**Arreglo:** semántica de completitud obligatoria `hasMore===false`. Para `0/true` definir reintento corto y **acotado por presupuesto/tiempo** (sin sleeps arbitrarios ni busy-loop), con error explícito al agotarse. Conservar mismo cliente/sesión, filtros, orden y cursor. No cambiar RPC SQL ni correr un cron administrativo. Puede devolver error inmediatamente en este caso como corrección mínima segura si no hay política de retry acordada; preferir reintento acotado que permita completar cuando se libere un lock. Jamás devolver éxito en 0/true.
**Test obligatorio:** mock 0/true con una `published` realmente vencida, comprobar `rejects` tras presupuesto o éxito solo cuando un batch posterior cambia filas y cierra con `hasMore=false`; comprobar `delivery_requests` SELECT no se ejecuta en error. Mutante RED: restaurar el `return` original en ese branch, la prueba nueva debe fallar por resultado observable, no por excepción de import/fixture.

## H02 — ALTO — prueba de locks refuerza el bug
**`src/features/requests/queries.test.ts:2483–2512`**. El test actual dice `No debe ... arrojar excepción` y llama a `await getMerchantHistoryRequests` sobre un mock 0/true, después solo exige `callCount===1`. Tal test pasa precisamente cuando la lectura omite reconciliación pendiente. Cambiar la expectativa para **prohibir SELECT y exigir resultado fail-closed**; también añadir caso `0/true → 1/false` para comprobar reintento auténtico. Sin `ok(true)`, mocks inertes, `it.skip` ni manipular expectativas para verde; la mutación debe ser independiente del test.

## H03 — ALTO — falta prueba E2E completa y E2E real
**`e2e/specs/request-states.spec.ts:948–994`**. El test nuevo navega historial `Todas` y `Vencidas` de **una sesión**, luego inspecciona DB. No comprueba que la misma solicitud desaparezca de `Mis solicitudes`, que Ver ofertas/propuesta quede no aceptable, el otro lector concurrente, ni la paginación de >50 casos. La prueba antigua de expiración hace RPC directa y no sustituye la navegación/orden de operaciones de T-366.
**Ejecución real:** status del commit `3903388e` indica `e2e-preview=error`, explicación `E2E no corrió (cancelled)`, [run #38793046464](https://github.com/cadeApp/cadeApp/actions/runs/38793046464). No hay evidencia de E2E PASS para este SHA y no se puede marcar DoD completo. Completar tests con fixtures autorizadas en Supabase Develop y dos sesiones/rol ajeno, estados persistidos y paginación, y conseguir ejecución E2E Preview PASS en el nuevo HEAD. No alterar workflow ni inventar ejecución.

## H04 — ALTO de coordinación — ficha no está reconciliada en develop
**`docs/tasks/T-366.md:4,14`**: la rama PR corrige esa ficha, pero al momento de la inspección `origin/develop` sigue con el texto anterior que requería abrir CC si faltaba RPC. La ronda 1 y el CC indicaron reconciliar la ficha **en develop antes** de seguir implementación. Tener la ficha correcta sólo en la PR de implementación no satisface ese gate. Además la redacción de la rama afirma `las consultas ... invocan` como si ya estuvieran mergeadas, antes del merge de T-366.
**Arreglo mínimo propuesto:** PR documental separada que lleve solamente la ficha T-366 reconciliada a develop, registrando CC-026 #371, RPC merchant sin args, output, semántica `hasMore`, rollout y lenguaje de trabajo pendiente. El responsable autorizado revisa/mergea esa PR antes de cerrar T-366; después Kira hace merge normal de `origin/develop` en rama PR #370 y conserva el código funcional, sin rebase/force. No confundir cambios documentales dentro de PR #370 con cambios efectivos en develop.

## H05 — MEJORA, no seguridad — backlog de 501+
`src/features/requests/queries.ts:10–40` limita a 10×50 filas y después arroja excepción si sigue `hasMore=true`. **Es una falla cerrada y por eso no se clasifica como pérdida de integridad**, pero tras acumulación >500 solicita error incluso si todos los lotes anteriores fueron aplicados. Hay pruebas de 60 y de bucle sintético, no una prueba real de 500/501 con costes medidos. Proponer límite por tiempo/operación y plan de continuación seguro, midiendo latencia en CI. No resolver a costa de entregar datos inconsistentes.

## CI y evidencia
- [CI #38792912853](https://github.com/cadeApp/cadeApp/actions/runs/38792912853) para SHA `3903388e`: **SUCCESS** en lint, typecheck, build, unit, db-tests, audit y bundle-budget. Son hechos de Actions, no tests propios. Los controles no cubren el invariante omitido H01/H02.
- `approval-policy` en FAILURE (PR de Kira requiere aprobación válida de Lautaro073, que no se concede mientras haya bloqueantes). Vercel deploy SUCCESS.
- `e2e-preview`: **ERROR por cancelación**, no PASS ni fallo de assertion; requiere nueva ejecución exitosa tras arreglos.
- No se ejecutó `git merge-tree --write-tree` porque el entorno no tiene clon ni DNS a GitHub; `mergeable` de API no reemplaza ejecución. No se realizó `node docs/revision-pr/analizar.mjs verificacion` por la misma limitación, y no se falsifica un resultado.

## Informe revisar-pr — T-366 — 2026-10-15 — revisión independiente
**Resultado: CON BLOQUEANTES (4).**
**Checks locales:** typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (CI preexisting GREEN, no ejecutados por revisor).
**BLOQUEANTES:**
- `[queries.ts:35]` H01 0/true retorna éxito pese a vencidas sin conciliar → retry acotado o error, nunca SELECT.
- `[queries.test.ts:2483]` H02 test afirma el comportamiento erróneo → RED causal y fail-closed sin SELECT.
- `[request-states.spec.ts:951]` H03 E2E incompleto y ejecución cancelada → escenarios UI dos sesiones + E2E realmente PASS.
- `[docs/tasks/T-366.md:14]` H04 ficha corregida solo en rama feature → primero reconciliar en develop y sincronizar.
**MEJORAS:** `[queries.ts:10]` H05 presupuesto 10×50 limita disponibilidad con backlog >500, medir.
**No revisado / dudas para Lautaro073:** mutaciones independientes del repositorio, GitHub merge-tree local, E2E navegador autenticado; ninguna se declara ejecutada. No aprobar ni mergear.