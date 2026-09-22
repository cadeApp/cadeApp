# PR #57 — T-007 · ADR-0001 Supabase y ADR-0002 hosting y cron

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/57 |
| **Tarea** | T-007 (Fase 0 — Fundaciones y contratos) · Issue #8 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-007-adr-0001-0002` → `develop` |
| **Base** | `0c4f031` |
| **Tamaño** | 6 archivos en la ronda 1; + los arreglos de la ronda 2 |
| **Estado** | ✅ **Lista para aceptar** · 0 bloqueantes · 18 cerrados de 24 · CI **8 de 8** en `29b82fc` |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `65f174f` | 17 hallazgos: **7 bloqueantes** · 4 altos · 4 medios · 8 bajos · 1 decisión | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `3152068` | **14 cerrados y verificados** · **1 regresión** · 5 nuevos del barrido de controles · **0 bloqueantes** | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `29b82fc` | `H01` y `H18` cerrados · **1 regresión, de la revisión** (`R01`) · 1 bajo nuevo · **0 bloqueantes** | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

> Los arreglos de `H18`, `H19` y `H20` los aplicó quien revisa, así que no firman su propia verificación. Están respaldados por pruebas que corren en CI y por las anotaciones reales de los runs.

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| **H01** | El ADR promete que `notes` está protegido; es columna de `delivery_requests` y la lee todo repartidor aprobado | 🟠 | ✅ verificado (`29b82fc`) — el ADR describe el destino decidido y cita T-006 |
| **H02** | ¿`notes` debería estar en `delivery_request_contacts`? | 🔵 | ✅ **decidido**: la ve solo el repartidor aceptado → implementación en T-006 (H22) |
| **H03** | Trece identificadores de esquema citados como existentes que no existen | 🟠 | ✅ verificado (`3152068`) — barrido re-corrido: 4 excepciones legítimas |
| **H04** | `status = 'open'` ×4 sobre un enum cuyo valor es `'published'` | 🟡 | ✅ verificado (`3152068`) — 0 ocurrencias |
| **H05** | La exclusión de Storage del backup etiquetada `[DATO]`; el plan §9.4 la tiene como pendiente | 🟠 | ✅ verificado (`3152068`) — a `[SUPUESTO]` con verificación en T-310 |
| **H06** | `verify-adr.test.mjs` no lo corre ni `pnpm test` ni CI: borrar los ADR deja los 8 jobs en verde | 🟠 | ✅ **verificado en CI** (`3152068`, job `unit`: `# pass 6`) · origen `ficha` |
| **H07** | Los tests 3 y 5 pasan con las dos tablas de revisión borradas | 🟡 | ✅ verificado (`3152068`) — **pero introdujo H21** |
| **H08** | `approval-policy` en rojo: el cuerpo del PR no sigue el formato del paso 5 | 🟡 | ✅ verificado (`3152068`) — el job pasó |
| **H09** | El DoD marcado y la conformidad de P2/P3 firmada sin evidencia | 🟡 | 🔷 **aceptado** — decisión de Lautaro073: dejarlo como está |
| **H10** | `src/lib/env.ts` y `supabase/tests/rls_and_invariants.test.sql` no existen | 🔵 | ✅ verificado (`3152068`) |
| **H11** | `default_expiry_minutes = 15`: la clave es `request_ttl_minutes` y el valor es 30 | 🔵 | ✅ verificado (`3152068`) |
| **H12** | El SQL de `subscription_grace_days` no corre: `platform_settings` es clave/valor | 🔵 | ✅ verificado (`3152068`) |
| **H13** | S1–S3 citados como §16 (están en §17); S3 no es el supuesto impositivo; el límite de 2 proyectos no es D1 | 🔵 | ✅ verificado (`3152068`) |
| **H14** | 64 `[DATO]` sin fuente ni fecha; la convención se atribuye al plan, que no la tiene | 🔵 | ✅ verificado (`3152068`) |
| **H15** | `/Pro/i` matchea «producción»: el test 4 pasa sin nombrar el plan Pro | 🔵 | ✅ verificado (`3152068`) |
| **H16** | La suite verifica estructura y no verdad | 🔵 | ✅ verificado (`3152068`) |
| **H17** | `verify-workflows` afirma que CI corre `pnpm test` y se cumple por substring con `pnpm test:coverage` | 🔵 | 🔴 abierto · pre-existente desde la #51 |
| **H18** | El guard de la regla 00 no bloqueaba nada: formato de payload equivocado (**la ruta no estaba rota — ver `R01`**) | 🟠 | ✅ verificado (`29b82fc`) — `deny` en los 3 peligrosos, `ask` en el inocuo |
| **H19** | El job `audit` no podía fallar y escondía 23 vulnerabilidades high/critical (13 en `next`) | 🟡 | 🟡 arreglado (visible, sigue sin bloquear) · deuda → decisión |
| **H20** | Prettier instalado y sin ningún script ni job que lo corriera | 🔵 | 🟡 arreglado (advisory) · quedan 14 archivos sin formatear |
| **H21** | **REGRESIÓN**: el arreglo de H07 obliga a declarar que P2 y P3 aprobaron | 🟠 | 🔷 **aceptado** — decisión de Lautaro073: dejarlo como está |
| **H22** | `notes` llega a toda la bolsa, contra la decisión tomada | 🟠 | 🔴 abierto · **asignado a T-006** |
| **H23** | El arreglo de H01 quitó las aserciones que impedían su propia regresión | 🔵 | 🔴 abierto · se cierra con T-006 |
| **R01** | **REGRESIÓN DE LA REVISIÓN**: rompí la ruta del hook dando por rota una que funcionaba | 🟡 | ✅ verificado (`29b82fc`) — revertida por el agy en `6a46563` |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Lo que queda abierto, todo fuera de T-007

| | Dónde va |
|---|---|
| `H22` · `notes` a `delivery_request_contacts` + aserción de columna en `rls_matrix.sql` | **`T-006`**, por decisión de Lautaro073 |
| `H17` · «CI corre `pnpm test`» se cumple por substring con `pnpm test:coverage` | tarea de controles |
| `H23` · el Test 2 no impide volver a listar `notes` como columna presente | se cierra con `T-006` |
| `H19` · 23 vulnerabilidades `high`/`critical`, 13 en `next 14.2.24` | ficha propia; el aviso ya es visible en CI |
| `H20` · 14 archivos de `src/**` sin formatear | `pnpm format`, fuera de T-007 |

Ninguno bloquea el merge. Tres quedan `arreglado-sin-verificar` —`H18`, `H19`, `H20`— porque los aplicó esta revisión y quien toca no firma la verificación.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md): `AG-39` a `AG-46`. La que más rinde es `AG-39` —cruzar los identificadores con un comando antes de leer el documento—, porque produjo trece de los diecisiete hallazgos de la ronda 1 en un solo barrido. La más incómoda es `AG-46`, que sale de una regresión de la propia revisión.

Criterio para llevar algo a `AGENTS.md` en el [README del directorio](../README.md#cuándo-tocar-agentsmd): hace falta que el patrón aparezca en 2+ PRs, salvo severidad crítica.
