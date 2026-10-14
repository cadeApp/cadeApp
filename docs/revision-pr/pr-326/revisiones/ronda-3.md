# PR #326 — Ronda 3 independiente — T-340 Paso 3

**Fecha:** 2026-10-13. **SHA auditado:** `23360fafc6c096c39bdb32bfa25ca095e07134c0`. **Base:** `develop 4eefd119b19792e179e46b1243d07ab957137649`.

## Dictamen: CON BLOQUEANTES (1 técnico H03 + 1 decisión de alcance A01 pendiente)

**R3 H01/H02:** arreglados en código por inspección desde R2. Kira añadió los mutadores específicos en `supabase/tests/integration/t340_concurrency.mjs`, pero **no se ejecutaron** porque el job `db-tests` falló antes. Se mantienen **arreglado-sin-verificar**; no afirmar mutación RED real ni verificación independiente.

### H03 — BLOQUEANTE ALTO — pgTAP idempotencia falla en el HEAD nuevo

Archivo `supabase/tests/t340_multi_drop.sql:1956–1960`. Nuevo control #133:
```text
segunda ejecucion preserva datos privados de destinatario en drop_contacts
have: Dest Historico
want: Dest Historico Integro
Files=21, Tests=2039, Result: FAIL
```
Run [38474615215](https://github.com/cadeApp/cadeApp/actions/runs/38474615215), job `115562136832`, commit `23360fafc6c096c39bdb32bfa25ca095e07134c0`. El fixture `:1534` y `:1544` define `recipient_name='Dest Historico'`; la aserción posterior esperaba otro valor. El fallo actual muestra una expectativa incompatible con el dataset, **no una pérdida de datos demostrada**.

**Solución exacta mínima:** preservar las 8 aserciones nuevas y cambiar el valor esperado de `:1958` a `'Dest Historico'` o, mejor, tomar una instantánea de `recipient_name` antes de la segunda ejecución y comparar igualdad después, para que sea una prueba auténtica de idempotencia. Nunca borrar el control ni transformar el test en `1=1`. Correr el mismo `t340_multi_drop.sql` y confirmar 136/136 GREEN, **antes** de investigar mutaciones.

### A01 — 🔵 DECISIÓN DE LAUTARO — alcance del runner de mutación

`supabase/tests/integration/t340_concurrency.mjs:1035–1154`: el agente agregó ~123 líneas para mutar `t340_clean_legacy` (H01) y `request_cycle` (H02) dentro de `runMutationChecks`. La ficha `docs/tasks/T-340.md:77` y `:103` autoriza este archivo **solo para Paso 1/H08**. La decisión C previa autoriza SQL/RPC para Paso 3 y `staging-seed.test.ts`, **pero no este runner**. La lista cerrada del prompt R2 también lo excluyó y pidió scripts auxiliares `/tmp`.

**Opción A — autorización puntual del runner existente [RECOMENDADA]:** aceptar `supabase/tests/integration/t340_concurrency.mjs` únicamente para controles RED→GREEN de `t340_clean_legacy`/puente en Paso 3. Pros: control automatizado en CI existente, reutiliza DB efímera, sin dependencias ni edición de workflow, guardas de restauración. Contras: el runner, antes dedicado a concurrencia/H13-H14, acumula lógica; hay que verificar el comportamiento real y mantenerlo.
**Opción B — revertir la extensión y demostrar mutación manual efímera en `/tmp`:** preserva alcance anterior y simplicidad del runner. Coste: el control no queda repetible automáticamente por CI, riesgo mayor de regresión futura. No se deben afirmar RED no corridos.
**Alternativa C — runner nuevo exclusivo de mutaciones de cleanup:** mejor separación si en el futuro hay muchas mutaciones, pero requiere autorizar otro archivo y modificar CI para invocarlo. Mayor superficie de mantenimiento y de error. Por ahora no justificada.
**Recomendación:** A, **pendiente de decisión expresa de Lautaro073**. Si no se autoriza A, Kira debe revertir los 123 renglones del runner y aportar evidencia efímera externa sin tocar workflows. No tomar decisión por el usuario.

### Estado de CI, pruebas y seguridad

| Check | R3 |
|---|---|
| unit, typecheck, lint, build, audit, bundle-budget | ✅ SUCCESS |
| pgTAP 136 asserts / db-tests | ❌ FAIL, test #133 (fixture mismatch) |
| H01/H02 mutantes RED→GREEN | ❌ NO EJECUTADOS (pipeline se cortó antes) |
| approval-policy | ❌ FAIL con informe bloqueante |
| Vercel | ✅ deployed |
| e2e-preview | ⚠️ BLOCKED por migración pendiente en develop (no equivale a GREEN) |

**Alcance:** desde R2 hasta R3 solo `supabase/tests/t340_multi_drop.sql`, `supabase/tests/integration/t340_concurrency.mjs`, `docs/tasks/log/T-340.md`. No modificaciones funcionales a migración/puente, auth, RLS, workflows, dependencias, UI ni Paso 4. Autor no modificó docs de revisión.

**Limitaciones:** el revisor verificó la salida real del job y comparó código/fixtures; no ejecutó DB/Postgres/Docker local ni mutantes propios. **No certificar H01/H02 como `arreglado-verificado` hasta que su RED y restauración GREEN sean observados.** La revisión no aprueba ni mergea y mantiene #326 Draft.

**Próximo control:** corregir test #133; lograr db-tests GREEN 136/136 en el HEAD exacto; verificar ejecución y salida **por aserción** de mutantes H01/H02 y restore GREEN; resolver decisión A01. Si aparece error nuevo reportar su causa primero, no manipular oráculos para dar verde. Paso 4 sigue bloqueado.
