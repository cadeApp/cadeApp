# Informe revisar-pr — PR #457 / T-386 — Ronda 1

**Fecha:** 2026-10-20 · **HEAD:** `ebffc06f72b1fd7a9cd24a78fd6cfcd3b600535d` · **Base:** `develop@24de5c511b32a1d472d4e022284997cc1648df83`

**Resultado: CON BLOQUEANTES (2)** · 1 mejora · 0 decisiones. Sin aprobación ni merge.

## Comprobaciones y alcance

Leídos desde develop: T-386, CC-035, AGENTS.md, COMO-ENTREGAR.md, README de revisión y skill revisar-pr. Se contrastaron lecciones de las PRs #56, #62, #63, #64, #68 y #82, bitácora T-386 y comentarios del PR. Los 11 archivos del diff se ajustan a «Archivos permitidos»; no se altera ficha ni RLS, hay CC aprobado. GitHub reporta `mergeable=true`.

| Evidencia en CI del SHA revisado | Resultado |
|---|---|
| `unit` | ✅ 151 archivos y 2920 tests |
| `typecheck`, `lint`, `build`, `audit`, `bundle-budget` | ✅ |
| `db-tests` | ✅ 33 archivos, 2956 pgTAP, `Result: PASS` |
| CC-035 `cc035_register_push_subscription.sql` | ✅ |
| CC-035 alta/alta y reasignar/reasignar | ✅ dos escenarios en dos sesiones PostgreSQL |
| Mutación **del autor** sin retry de unique_violation | ✅ RED esperado y GREEN restaurado |
| Drift de tipos generado | ✅ `git diff --exit-code` |
| `e2e-preview` | ⛔ gate de migración previo al merge, fuera de T-386 |

Fuente: [run 39393534439](https://github.com/cadeApp/cadeApp/actions/runs/39393534439), HEAD coincidente. **No se ejecutó Docker/Supabase local**. Todo lo indicado a continuación es análisis independiente sin afirmar que la mutación adicional ya corrió.

## BLOQUEANTES

### PR457-H01 · Tipos JSON no textuales pasan la validación de claves

**Archivo:** `supabase/migrations/20261020123000_cc035_register_push_subscription.sql:32-46`. **Severidad:** alta. **Evidencia:** ANÁLISIS.

**Diagnóstico:** `p_payload->>'p256dh'` y `->>'auth'` convierten JSON booleano o número a texto. `true` y `12345` coinciden con `^[A-Za-z0-9_-]+$`, de modo que una llamada directa a la RPC con `"p256dh": true` o `"auth": 12345` puede guardar claves que incumplen el contrato Zod, en vez de `VALIDATION_ERROR`. El wrapper TS no protege llamadas directas de clientes `authenticated`.

**Arreglo concreto:** antes de `->>` comprobar `jsonb_typeof(p_payload->'endpoint') is distinct from 'string'`, igual para `p256dh` y `auth`, y aceptar `platform` solo cuando su tipo JSON sea `string` o `null` (si está ausente también es válido). Rechazar con `P0001 / VALIDATION_ERROR`. Mantener las reglas actuales de longitudes, regex y plataforma web.

**RED→GREEN exigido:** 3 pgTAP negativos (p256dh boolean, auth número, platform objeto), y uno positivo platform null. Afirmar que rechazos no crean filas. Ejecutarlos contra el SQL defectuoso (RED) y con el fix (GREEN), sin modificar expectations para forzar verde.

**Por qué CI no lo atrapó:** los negativos actuales usan strings inválidas, mientras que Zod aplica tipado en otra frontera.

### PR457-H02 · Falta probar la historia correcta de reasignaciones concurrentes

**Archivo:** `supabase/tests/integration/cc035_concurrency.mjs:250-283`, ligado al `FOR UPDATE` de `supabase/migrations/20261020123000_cc035_register_push_subscription.sql:53-57`. **Severidad:** alta. **Evidencia:** ANÁLISIS.

**Diagnóstico:** `scenario2` comprueba dos auditorías y dueño final B, sin leer `before.user_id` y `after.user_id`. Si se quita únicamente `FOR UPDATE` del SELECT, ambas sesiones pueden leer C; sus UPDATE se serializan, el segundo termina con B y hay dos auditorías, pero sus `before` podrían quedar C→A y **C→B** en vez de C→A y **A→B**. El polling de `pg_blocking_pids` seguiría detectando el bloqueo producido por UPDATE. La mutación existente solo protege el retry del INSERT, no el lock del SELECT.

**Arreglo concreto:** hacer que `scenario2` consulte `audit_log` por `target_id` ordenado por `id` y compare exactamente `[{from: C, to: A}, {from: A, to: B}]`. En `scenario1` comprobar A→B. Añadir mutación independiente que elimine solo el `FOR UPDATE` del SELECT de esta RPC, exija fallo de la **aserción sobre la cadena** (no timeout ni error de infraestructura) y restaure función original para GREEN. Ejecutarla en CI junto a CC-035.

**RED→GREEN exigido:** runner real dos sesiones con aserciones de origen/destino, mutante que quite solo el lock, RED por auditoría equivocada, y GREEN restaurado. No aceptar simple conteo o presencia textual de `FOR UPDATE`.

**Por qué CI no lo atrapó:** se mide un proxy del invariante —cantidad de auditorías y estado final— en vez de cada cambio de propietario.

## MEJORA

**PR457-H03 · docblock mal ubicado:** en `src/domain/rpc-contracts.ts:1409-1412`, el comentario «CC-016: solo el comercio dueño de la solicitud...» precede a `register_push_subscription`, cuando describe otra RPC. Moverlo a `get_request_offer_couriers` o eliminarlo de ese lugar. No bloquea por sí solo.

## No tocar / no confundir con defectos

CC-035 acepta expresamente el riesgo de reasignación de un endpoint conocido por otra cuenta. La auditoría SQL actual solo escribe ids y no claves ni endpoint, y el actor se valida. El E2E de registro mediante ruta sigue fuera de alcance hasta T-383 y la aplicación de la migración en Develop. No alterar RLS ni la ruta de push actual para resolver esta revisión.

**Verificación independiente pendiente:** no hay DB local, no se pudieron reproducir las mutaciones H01/H02. Ver `evidencia/comandos.md`. La CI de GitHub es evidencia **del autor y del código**, no prueba propia del nuevo oráculo. Siguiente ronda necesaria antes de merge.
