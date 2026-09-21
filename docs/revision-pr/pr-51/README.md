# PR #51 — T-003 · CI, migraciones y política de aprobación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/51 |
| **Tarea** | T-003 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-003-ci-workflows` → `develop` |
| **Base** | `cdf6d13` |
| **Tamaño** | 7 archivos, +649 / −0 |
| **Estado** | Abierta · **1 crítico, 1 alto, 3 medios** · 0 fuera de alcance |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `631dc1e` | 5 abiertos (1 crítico) · alcance limpio | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| **H01** | **Producción migraría contra la base de staging** | 🔴 | 🔴 abierto |
| H02 | El filtro de quién migra saltea el job, y saltear es verde | 🟠 | 🔴 abierto |
| H03 | El test de la compuerta de producción no la ve | 🟡 | 🔴 abierto |
| H04 | El DoD pide que `bundle-budget` avise y el job bloquea | 🟡 | 🔴 abierto |
| H05 | Los `.mjs` no pasan por typecheck, lint ni `pnpm test` | 🟡 | 🔴 abierto |
| A01 | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ verificado (`631dc1e`) — **0 fuera** |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)

## Lo que está bien

Es la mejor primera ronda de las cuatro PRs revisadas. Las decisiones difíciles —las de seguridad— están bien tomadas:

- **`pull_request_target` usado correctamente**: `approval-policy` y `db-types` hacen checkout de la base y corren el código de la base, nunca el del PR. El código propuesto jamás corre con el token de Supabase ni con el contexto de escritura.
- **Actions fijadas por SHA**, con un test que barre todos los `.yml` y lo exige. No es una lista que se desactualiza.
- **`permissions: contents: read`** y `persist-credentials: false` en todos lados.
- **El interruptor `mode=local`/`mode=remote`** de `db-types` evita que T-004 se bloquee a sí misma. Bien pensado.
- **Pruebas de conducta** para los dos `.mjs`, no solo string matching del YAML.
- **Demostrado en rojo primero** (8/8 fallando antes de implementar) y **bitácora honesta**: el DoD queda sin marcar y los bloqueos están listados.

## Lo que no

> **H01 es el que impide mergear.** Los dos jobs de `migrate.yml` leen `vars.SUPABASE_PROJECT_REF`, que es una única variable de repositorio apuntando a staging; ningún environment define una que la pise. El job de producción aplicaría las migraciones a la base de staging **y reportaría éxito**.

> **H02 y H03 se refuerzan entre sí:** el filtro por `github.actor` saltea el job (verde) en vez de bloquearlo, el environment `production` tiene `protection_rules: []`, y el test que debería proteger la compuerta no distingue entre los dos jobs.
