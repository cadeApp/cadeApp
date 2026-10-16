# Cierre de decisiones de alcance — PR #373 / CC-026 — R4

**Fecha:** 2026-10-15. **Ratificación humana explícita:** **D1-A y D2-A**.

Esta nota es un **anexo al informe independiente [ronda-4.md](ronda-4.md)**, no una nueva revisión de código ni una ejecución local de mutaciones. El SHA de código inspeccionado y probado por CI permanece `23e394f828df3872a5681c4cdadf2da9eb3db399`. La revisión documental había sido publicada en `706643279afb179937c44f0d8c97915d06e4f615`.

**Fuentes trazables:** [comentario de ratificación en PR #373](https://github.com/cadeApp/cadeApp/pull/373#issuecomment-6199481008) y [referencia en issue #371](https://github.com/cadeApp/cadeApp/issues/371#issuecomment-6199481799). La elección fue expresada por Lautaro073 en la conversación y ya registrada en GitHub.

## PR373-A01 — DECISIÓN RESUELTA: D1-A

Se **autoriza incluir exclusivamente el diff del HEAD R4** en `.github/workflows/ci.yml` relativo a la ejecución automática en `db-tests` de:

- `DB_CONTAINER="$DB_CONTAINER" node supabase/tests/integration/cc026_reconcile_expired_requests.mjs`, dos sesiones PostgreSQL con `FOR UPDATE SKIP LOCKED` y transiciones concurrentes de aceptación/republicación.
- Mutante temporal en `$RUNNER_TEMP` que retira el trigger `cc026_fail_offer` de la suite SQL de CC-026. Debe producir RED causal (casos 42–49), restaurar el control y registrar GREEN 54/54.

No autoriza otros changes de workflow, bajar gates, omitir suites, ejecutar DB remota, o desactivar mutaciones. **Estado del hallazgo: aceptado (resuelto por decisión humana).**

## PR373-A02 — DECISIÓN RESUELTA: D2-A

Se **autoriza solamente** el cambio en `docs/master-plan.md:98` de `now() > expires_at` a `now() >= expires_at`, consistente con el corte SQL `expires_at <= now()`. **Estado del hallazgo: aceptado (resuelto por decisión humana).**

## Dictamen técnico y restricciones que subsisten

En los 23 archivos de PR y 7 modificados desde R3, **no fueron detectados nuevos bloqueantes funcionales en R4**. [CI #38783733680](https://github.com/cadeApp/cadeApp/actions/runs/38783733680) corrió en HEAD `23e394f`: **lint/typecheck/unit/build/audit/db-tests/bundle-budget GREEN**; **2348 tests unitarios** PASS, **2259 pgTAP** PASS, **54/54 CC-026** PASS, mutación H11 RED (8 fallos específicos)/GREEN (54 casos), harness CC-026 GREEN y comparación de tipos generados sin drift. Vercel pasó en ese SHA.

**Limitación:** no se ejecutó `pnpm`, `psql`, `docker` ni mutaciones de independencia por cuenta del revisor; los hallazgos H01-H12 siguen `arreglado-sin-verificar`, porque fue evidencia CI ejecutada por la PR y lectura del diff, no un mutante nuevo ejecutado por la revisión. No presentarlos como `arreglado-verificado` ni fabricar `verificado_en_sha`.

**No dar por GREEN total los gates de promoción:** `e2e-preview` registró **BLOCKED / REQUIRES DEVELOP MIGRATION** en [run #38783881834](https://github.com/cadeApp/cadeApp/actions/runs/38783881834): el esquema nuevo no está desplegado en Supabase Develop, así que el navegador no ejecutó E2E para la PR. `approval-policy` estaba rojo por falta de informe de revisión completo en el cuerpo de la PR; debe corregirse **sin falsificar** resultados ni identificarse como revisión de T-366. Si se agrega el informe, indicar que la revisión cubre únicamente **CC-026, dependencia de T-366**, sin verificar la tarea UI de Kira.

**T-366 #355:** se mantiene **`bloqueada`**, asignada a **@KiraK72**. No desbloquear por haber resuelto las decisiones ni por verde de CI. Gate: CC-026 mergeada en develop, migración `migrate-develop` confirmada, ficha `docs/tasks/T-366.md` reconciliada y luego Kira E2E Preview reales para su tarea.

**Conclusión:** D1/D2 dejan de bloquear por alcance; no requieren cambios de código. **No aprobar ni mergear** sin la gestión deliberada de Draft y los gates de rollout. El autor no debe tocar `docs/revision-pr/**` y las decisiones humanas ya quedaron registradas.
