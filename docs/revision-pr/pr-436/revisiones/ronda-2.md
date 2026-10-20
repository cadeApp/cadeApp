# Informe independiente — PR #436 / CC-033 / T-376 — Ronda 2

**Fecha:** 2026-10-20  
**PR:** https://github.com/cadeApp/cadeApp/pull/436  
**SHA del autor revisado:** `79389ea830cc1c63636ffd06c35cefeafabdad6e`  
**Base develop:** `54bbdcd7b079fa208e970725efa66832a8fac724`  
**Commit de revisión de ronda 1:** `6191721a4473d5aed00bce519eb43f633056febc`  
**Resultado:** **SIN BLOQUEANTES DOCUMENTALES (0)**. H01–H03 cerrados por verificación documental independiente.

## Método y alcance

Leí completo `docs/contracts/CC-033.md` y `docs/tasks/T-376.md` del SHA de autor, contrasté la fila de la tarea en `docs/implementation-plan.md`, la propuesta CC-025 y el informe de ronda 1. Comparé remotamente `6191721a...79389ea`: **solo tres documentos modificados** (CC-033 +36/-8, T-376 +3/-3, plan +1/-1). `docs/revision-pr/pr-436/**` del revisor no fue tocada por el agente. Comparación con `develop`: 3 commits ahead, 0 behind.

Se ejecutaron **16 aserciones propias** de presencia/coherencia sobre el contenido de estos documentos recuperados exactamente en el SHA de autor y se leyeron las cláusulas en contexto: **16 PASS, 0 FAIL**. Son controles de contrato documental, no simulación de RLS, transacciones o llamadas a Postgres; evidencia y arnés en `../evidencia/comandos.md`. Al ajustar un verificador preliminar, un falso negativo por la frase «ni se delega» se corrigió antes de emitir el resultado final; el conteo final corresponde a la versión ajustada.

## PR436-H01 · ALTO — ARREGLADO Y VERIFICADO documentalmente

**Archivo principal:** `docs/contracts/CC-033.md`, sección «Propuesto», validación 4, además de «Seguridad» y «Decisiones de producto».  
**SHA de comprobación:** `79389ea830cc1c63636ffd06c35cefeafabdad6e`.  
**Resultado:** texto y matriz de casos conforme a la **decisión A de Lautaro073** (2026-10-20).

- RPC exige `status IN ('pending','approved') AND vehicle_type IS NOT NULL` sobre `couriers` bajo `FOR UPDATE`; sin fila `NOT_FOUND`, suspendido/rechazado `UNAUTHORIZED_ACTOR`, `pending` con onboarding incompleto `INVALID_STATE_TRANSITION`.
- Lock ordering documentado `couriers FOR UPDATE -> profiles FOR SHARE -> courier_documents FOR UPDATE`; la regla no queda delegada a UI.
- El DoD de la ficha y la fila T-376 del plan dicen **onboarding completo**; pgTAP futura discrimina `pending` completo/incompleto y `approved` completo, sin nuevas filas ni auditoría para actor incompleto.
- Se mantiene que la nueva RPC no modifica `doc_level` ni autoaprueba documentos.

**Limitación:** garantía verificada en la **especificación**, no en SQL inexistente todavía.

## PR436-H02 · MEDIO — ARREGLADO Y VERIFICADO documentalmente

**Archivo:** `docs/contracts/CC-033.md`, «Concurrencia e idempotencia» e «Impacto exacto».  
**SHA de comprobación:** `79389ea830cc1c63636ffd06c35cefeafabdad6e`.

- La futura PR de implementación debe incorporar `supabase/tests/integration/cc033_concurrency.mjs` con **dos sesiones reales e independientes**, sin `sleep` ni mocks de base y con locks/barreras controlados.
- Escenarios escritos: dos altas mismo tipo (path distinto y mismo path), única fila vigente/auditoría, y alta concurrente con suspensión en ambos órdenes, sin `40P01`.
- Exige mutación independiente RED→GREEN en la futura implementación; la elección concreta del mutante deberá confirmarse allí con fallo real, nunca presumirse a partir de la redacción o aceptar «sin objetivo».

**Limitación:** no se ejecutó la batería de concurrencia porque esta PR no crea la RPC ni la suite.

## PR436-H03 · MEDIO — ARREGLADO Y VERIFICADO documentalmente

**Archivo:** `docs/contracts/CC-033.md`, «Compatibilidad, rollout y rollback».  
**SHA de comprobación:** `79389ea830cc1c63636ffd06c35cefeafabdad6e`.

- Antes de desplegar T-376, se puede retirar la RPC vía **migración nueva forward-only**.
- Después de T-376, se retira/deshabilita primero la UI y se considera compatibilidad con clientes activos/caché; solo después una migración nueva puede retirar la función.
- Persisten documentos vigentes, estados de revisión y `audit_log`; no se edita una migración ya mergeada.

## Comprobaciones y CI

| Aspecto | Estado honesto |
|---|---|
| 16 aserciones documentales independientes | **16/16 PASS**, leídas en contexto |
| Archivos modificados por autor desde R1 | **3 autorizados**, comparados remotamente |
| Carpeta propia de revisión | **No modificada por el autor** |
| Estado de rama vs. develop | **ahead 3, behind 0** al consultar |
| `verify-fichas` | Autor declara **7/7**, no reproducido localmente por revisor |
| `git diff --check` | Autor declara **limpio**, no reproducido localmente por revisor |
| `db-tests`, E2E, `pnpm test:db`, PostgreSQL local | **No exigidos ni ejecutados**; PR solo documental |
| Git merge-tree en clon | **No ejecutado**; compare GitHub no identifica divergencia de base |
| Aprobación/merge | **No realizados** |

### Próximos pasos y límites

La **PR documental #436 está sin bloqueantes por contenido**. Los controles de rama que GitHub efectivamente requiera son independientes de esta revisión. Cuando se mergee, **no desbloquear todavía T-376**: primero hace falta la implementación de CC-033, el merge de esa implementación y su RPC realmente aplicada en Supabase Develop. Solo entonces corresponde T-376 con UI, admin, test de integración y E2E.

No existe hallazgo nuevo de ronda 2 ni decisiones abiertas. No reabrir la ronda 1 por cambios del registro de revisión.

**Sin aprobación automática y sin merge.**
