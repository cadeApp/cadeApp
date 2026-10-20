# Informe de revisión — PR #455 / T-385 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/455  
**Rama:** `feat/T-385-cc034-reinstate-courier` → `develop`  
**HEAD examinado:** `208fbf7e341fb907edc5ebf5ec8d6b9b90476e8c` (solo bitácora después del código)  
**SHA funcional verificado:** `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860`  
**Base:** `develop` @ `03dec5b074e634d6f3895c282e58f7d7e6eb4456`  
**Fecha:** 2026-10-20  
**Resultado:** **SIN BLOQUEANTES**. Ambos hallazgos de ronda 1 cerrados tras cotejo independiente de código, mutación aislada y CI de los mismos SHAs.

## Resumen de cierre

| ID | Resolución | Evidencia |
|---|---|---|
| PR455-H01 | Cerrado: fake ya no escribe `available`; test del valor `true` | Diff código `0870a9c`; `unit` oficial SHA `0870a9c`, 8/8 pruebas del archivo CC-034 |
| PR455-H02 | Cerrado: prueba verifica identidad física de la tupla con `ctid` | PR #456 con un único UPDATE deliberado: aserción 38 RED; PR real: pgTAP GREEN, 50 tests de CC-034 |

## 1. PR455-H01 — verificación

**Código:** `src/domain/testing/rpc-fake.ts`, `src/domain/cc034-admin-reinstate-courier.test.ts`.

El diff de `a412cb19` a `0870a9ce` elimina **solo** `courier.available = false` del caso de reactivación del fake. No se alteraron `status`, validaciones, contrato ni RPC real. Se agregó una prueba con un rechazado `available: true`, que comprueba `true` antes y después de `admin_reinstate_courier` y exige la respuesta `previousStatus: rejected`, `status: approved`, `idempotent: false`. Conviven las pruebas anteriores donde `available` comienza en `false`.

**GREEN comprobado en CI:** job `unit` 118514448261 del run 39388538108, commit `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860`, informó `src/domain/cc034-admin-reinstate-courier.test.ts (8 tests)`; `Test Files 149 passed (149)`; `Tests 2907 passed (2907)`.

**RED anterior:** la bitácora `docs/tasks/log/T-385.md` informa `1 failed | 7 passed (8)`, `expected false to be true`. No se conservó una ejecución de revisor de ese rojo; el mecanismo se corroboró inspeccionando el código anterior y la nueva aserción. No fingir una repetición propia.

**Estado:** cierre por inspección independiente del cambio y ejecución GREEN oficial del SHA de código; límite del RED local debidamente declarado.

## 2. PR455-H02 — verificación

**Archivo:** `supabase/tests/cc034_admin_reinstate_courier.sql`, sección 6.

Se añadió snapshot `ctid::text` del repartidor `courier_susp` **antes** de la llamada idempotente, y comparación de `ctid::text` después, con `plan(50)`. El test original de retorno y el de no duplicar auditoría se conservan. La migración de producción permanece intacta en la PR real.

**Control negativo RED realmente observado:**
- PR de prueba [#456](https://github.com/cadeApp/cadeApp/pull/456) cerrada sin merge; HEAD `36f0ab6f521849aa9602b6b1e81d546c85050f61`.
- Comparación `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860` → `36f0ab6`: **un solo archivo**: `supabase/migrations/20261020113000_cc034_admin_reinstate_courier.sql`, **2 líneas agregadas, 0 borradas**. Una línea comenta la mutación y la otra escribe `update public.couriers set available = available where profile_id = p_courier_id;` inmediatamente antes del `return` en `approved`.
- Job `db-tests` 118514301969 del run 39388573174: `Failed test 38: "approved idempotente no hizo UPDATE físico de couriers"`, `have: (0,75)`, `want: (0,74)`, `Tests: 50 Failed: 1`, `Result: FAIL`. Es el fallo esperado de la propiedad, no un error incidental.
- La PR de la mutación no fue mergeada ni mezcló otros cambios.

**GREEN realmente observado en la rama funcional:** job `db-tests` 118514448356, run 39388538108 sobre `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860`: `cc034_admin_reinstate_courier.sql ....... ok`, `Files=32, Tests=2918`, `Result: PASS` en primera y última verificación. Escenarios CC-034 concurrentes 1/2/3 GREEN y mutación de lock RED→GREEN. El paso de comparación de tipos se reportó SUCCESS.

**Estado:** cerrado tras prueba RED real aislada, validación del único cambio mutante y GREEN del código de la rama principal.

## 3. Alcance, comparaciones e integración

- Comparación `a412cb19` a `0870a9ce`: **exactamente tres archivos** de código/test autorizados por la instrucción de ronda 1: `src/domain/testing/rpc-fake.ts`, `src/domain/cc034-admin-reinstate-courier.test.ts`, `supabase/tests/cc034_admin_reinstate_courier.sql`.
- Comparación `0870a9ce` a `208fbf7`: **solo** `docs/tasks/log/T-385.md` (+19 líneas). No exigir un nuevo CI GREEN únicamente por esta bitácora.
- Comparación `develop` a `208fbf7` indica `ahead 6, behind 0`, merge-base `03dec5b074e634d6f3895c282e58f7d7e6eb4456`. Metadata PR `mergeable=true`; no `git merge-tree` local por ausencia de clon/red.
- CC-034 fue mergeado en `develop` con anterioridad; T-385 no cambia UI ni Server Actions de T-380.
- No hay evidencias de adulteración de test: el único cambio negativo de SQL está aislado en #456 cerrada, la PR real conserva la función SQL original.
- Bitácora actualizada; el cuerpo de la PR todavía dice «49 aserciones» aunque pgTAP pasó a 50. Corrección editorial opcional, no bloqueante, no requiere commit ni repetir checks de código.

## 4. Checks y límites

**GitHub Actions, SHA `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860`, run 39388538108**:
- `unit` SUCCESS: 149 archivos, 2907 tests Vitest PASS; 79 verificaciones de workflow y 6 ADR PASS.
- `db-tests` SUCCESS: pgTAP 2918 tests / 32 archivos PASS; concurrencia y mutación de CC-034, drift de tipos.
- `lint`, `typecheck`, `build`, `audit`, `bundle-budget`: SUCCESS.
- `approval-policy`: FAIL mientras no estaba publicado el informe de ronda 2. No tratarlo como falla del código.
- En el HEAD `208fbf7e341fb907edc5ebf5ec8d6b9b90476e8c` (solo bitácora adicional), hay un run en progreso al momento de inspección; no se usa para negar la validación GREEN del SHA funcional.

**No ejecutado personalmente:** `pnpm`, pgTAP, `git merge-tree` ni harness local. Un `git ls-remote` de este entorno falló por DNS a github.com. Los comandos ejecutados por CI se identifican como tales y **no** como ejecución directa del revisor. Las aserciones de corrección se corroboraron por inspección de código + outputs CI; se enumeró la clase revisada (estado, disponibilidad, idempotencia, auditoría, concurrencia, privilegios) y no se hallaron nuevos defectos.

## 5. Próximos pasos

1. Publicar esta ronda 2 en `docs/revision-pr/pr-455/` y el comentario de cierre en la conversación de PR.
2. `git pull` en la rama antes de volver a operar, porque el commit documental mueve HEAD.
3. Si `approval-policy` sigue fallando tras el comentario, diagnosticar la condición exacta del job, **sin** debilitarlo ni fingir aprobación. No bloquear por ausencia de otra corrida verde solo por bitácora/informe.
4. Lautaro073 decide cuándo quitar Draft y mergear; el revisor no aprueba ni mergea. **Después del merge**, comprobar `migrate-develop` y que aplicó `20261020113000_cc034_admin_reinstate_courier.sql` antes de iniciar T-380.

No se solicita ninguna decisión nueva.
