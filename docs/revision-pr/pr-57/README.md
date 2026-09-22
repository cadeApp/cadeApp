# PR #57 — T-007 · ADR-0001 Supabase y ADR-0002 hosting y cron

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/57 |
| **Tarea** | T-007 (Fase 0 — Fundaciones y contratos) · Issue #8 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-007-adr-0001-0002` → `develop` |
| **Base** | `0c4f031` |
| **Tamaño** | 6 archivos, +485 / −4 |
| **Estado** | 🔴 **Con bloqueantes (7)** · CI 7 de 8 · alcance limpio |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `65f174f` | 16 hallazgos: **7 bloqueantes** · 4 altos · 4 medios · 7 bajos · 1 decisión | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| **H01** | El ADR promete que `notes` está protegido; es columna de `delivery_requests` y la lee todo repartidor aprobado | 🟠 | 🔴 abierto · **bloqueante** |
| **H02** | ¿`notes` debería estar en `delivery_request_contacts`? | 🔵 | ⏸️ **decisión de Lautaro073** |
| **H03** | Trece identificadores de esquema citados como existentes que no existen | 🟠 | 🔴 abierto · **bloqueante** |
| **H04** | `status = 'open'` ×4 sobre un enum cuyo valor es `'published'` (+ `canceled`, `merchants.status`, courier `active`) | 🟡 | 🔴 abierto · **bloqueante** |
| **H05** | La exclusión de Storage del backup etiquetada `[DATO]`; el plan §9.4 la tiene como pendiente de verificar (D8) | 🟠 | 🔴 abierto · **bloqueante** |
| **H06** | `verify-adr.test.mjs` no lo corre ni `pnpm test` ni CI: borrar los ADR deja los 8 jobs en verde | 🟠 | 🔴 abierto · **bloqueante** · origen `ficha` |
| **H07** | Los tests 3 y 5 pasan con las dos tablas de revisión borradas | 🟡 | 🔴 abierto · **bloqueante** |
| **H08** | `approval-policy` en rojo: el cuerpo del PR no sigue el formato del paso 5 | 🟡 | 🔴 abierto · **bloqueante** |
| **H09** | El DoD marcado y la conformidad de P2/P3 firmada sin evidencia | 🟡 | ⏸️ **decisión de Lautaro073** |
| **H10** | `src/lib/env.ts` y `supabase/tests/rls_and_invariants.test.sql` no existen | 🔵 | 🔴 abierto |
| **H11** | `default_expiry_minutes = 15`: la clave es `request_ttl_minutes` y el valor es 30 | 🔵 | 🔴 abierto |
| **H12** | El SQL de `subscription_grace_days` no corre: `platform_settings` es clave/valor | 🔵 | 🔴 abierto |
| **H13** | S1–S3 citados como §16 (están en §17); S3 no es el supuesto impositivo; el límite de 2 proyectos no es D1 | 🔵 | 🔴 abierto |
| **H14** | 64 `[DATO]` sin fuente ni fecha; la convención se atribuye al plan, que no la tiene | 🔵 | 🔴 abierto |
| **H15** | `/Pro/i` matchea «producción»: el test 4 pasa sin nombrar el plan Pro | 🔵 | 🔴 abierto |
| **H16** | La suite verifica estructura y no verdad | 🔵 | 🔴 abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. **Cruzar los dos ADR contra `supabase/migrations/**` y reescribir lo que no coincide** (H01, H03, H04, H10, H11, H12). El comando que enumera la clase completa está en [`evidencia/comandos.md`](evidencia/comandos.md); no hay que buscarlos de a uno.
2. **Decidir qué hacer con la exclusión de Storage del backup** (H05): verificarla y citar la fuente, o bajarla a `[SUPUESTO]` y nombrar la tarea donde se cierra.
3. **Encadenar `verify-adr.test.mjs` a `pnpm test`** (H06). Requiere agregar `package.json` a «Archivos permitidos» de T-007 — es decisión de Lautaro073 porque toca la ficha.
4. **Que los tests 3 y 5 afirmen la sección de revisión, no la presencia de tres nombres** (H07), y acotar los patrones demasiado amplios (H15).
5. **Rehacer el cuerpo del PR con el formato del paso 5 de `revisar-pr`** para que `approval-policy` pase (H08), corrigiendo la línea que atribuye a `pnpm test` los 5 tests de `verify-adr`.
6. **Arreglar las citas al Master Plan y agregar las fuentes de los `[DATO]`** (H13, H14).
7. **Las dos decisiones abiertas para Lautaro073:** dónde vive `notes` (H02) y qué cuenta como «revisado por las 3 personas» en un equipo donde dos no programan (H09).

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md): `AG-39` a `AG-42`. La que más rinde es `AG-39` —cruzar los identificadores con un comando antes de leer el documento—, porque produjo trece de los dieciséis hallazgos de la ronda en un solo barrido.

Criterio para llevar algo a `AGENTS.md` en el [README del directorio](../README.md#cuándo-tocar-agentsmd): hace falta que el patrón aparezca en 2+ PRs, salvo severidad crítica.
