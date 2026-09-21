# PR #49 — T-002 · Clientes @supabase/ssr, vinculación remota y scripts db:*

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/49 |
| **Tarea** | T-002 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-002-supabase-clients` → `develop` |
| **Base** | `9f03018` |
| **Tamaño** | 13 archivos, +202 / −26 |
| **Estado** | Abierta · 6 hallazgos resueltos y verificados + 1 decisión aceptada (0 pendientes) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3ba9be6` | 6 abiertos + 1 decisión | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `a36b18d` | 0 abiertos (6/6 verificados, 1 decisión aceptada) | — |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | El cliente browser es inalcanzable desde un Client Component | 🟠 | ✅ arreglado-verificado (`a36b18d`) |
| H02 | Falta `server-only` en `server.ts` y `browser.ts` | 🟠 | ✅ arreglado-verificado (`a36b18d`) |
| H03 | El onboarding describe base local y cita un script inexistente | 🟡 | ✅ arreglado-verificado (`a36b18d`) |
| H04 | `config.toml` va en dirección contraria a la ficha | 🟡 | ✅ arreglado-verificado (`a36b18d`) |
| H05 | «No hay claves en el repo» se verifica sobre tres archivos | 🟡 | ✅ arreglado-verificado (`a36b18d`) |
| H06 | El DoD exige `db:types`, que ninguna máquina puede correr | 🟡 | ✅ arreglado-verificado (`a36b18d`) |
| **A01** | Tres archivos fuera de los «Archivos permitidos» | 🔵 | ✅ aceptado (`a36b18d`) |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Lo que está verificado y bien

- **H01:** `browser.ts` trasladado a `src/lib/supabase/browser.ts`. Comprobado con fixture consumidor `client-browser-supabase-consumer.tsx` (`AG-10`) con 0 errores de ESLint boundaries.
- **H02:** `server.ts` blindado con `import 'server-only'`. Regla `cadeapp/server-layer-must-be-server-only` creada en `tools/eslint-plugin-cadeapp/` y probada con fixtures positivo y negativo en `verify-scaffold.test.ts`.
- **H03:** `docs/onboarding.md` reescrito para el flujo remoto `cadeapp-staging` sin Docker daemon local; eliminado `pnpm test:db`.
- **H04:** `supabase/config.toml` formalizado como configuración declarativa del proyecto en la ficha ampliada.
- **H05:** Barrido recursivo en `clients.test.ts` recorre todo el repo asegurando 0 JWTs reales, 0 PATs y 0 secretos.
- **H06:** Documentado que `db:types` remoto corre en CI (T-003) con secretos; localmente se trabaja sobre `src/types/database.types.ts`.
- **A01:** Ficha `docs/tasks/T-002.md` e `implementation-plan.md` ampliados formalmente.
- `admin.ts` tiene `server-only` y no hardcodea nada: el ítem explícito del DoD se cumple.
- `supabase` fijado a `2.116.0` exacto y presente en la allowlist de paquetes aprobados.
