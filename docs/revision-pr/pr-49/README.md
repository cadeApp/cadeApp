# PR #49 — T-002 · Clientes @supabase/ssr, vinculación remota y scripts db:*

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/49 |
| **Tarea** | T-002 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-002-supabase-clients` → `develop` |
| **Base** | `9f03018` |
| **Tamaño** | 16 archivos, +411 / −20 |
| **Estado** | Abierta · **5 cerrados · 1 parcial · 6 abiertos (1 crítico)** |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3ba9be6` | 6 abiertos + 1 decisión | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `04d77e9` | 4 cerrados · H04 revertido a abierto · A01 parcial | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `17a0be4` | H04 y A01 cerrados · H03 bajado a parcial · **5 hallazgos nuevos** | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | El cliente browser es inalcanzable desde un Client Component | 🟠 | ✅ arreglado-verificado (`17a0be4`) |
| H02 | Falta `server-only` en `server.ts` y `browser.ts` | 🟠 | ✅ arreglado-verificado (`17a0be4`) |
| H03 | El onboarding describe base local y cita un script inexistente | 🟡 | ⚠️ **parcial** — la línea 20 sigue mandando a `pnpm supabase status` |
| H04 | `config.toml` va en dirección contraria a la ficha | 🟡 | ✅ arreglado-verificado (`17a0be4`) |
| H05 | «No hay claves en el repo» se verifica sobre tres archivos | 🟡 | ✅ arreglado-verificado (`17a0be4`) |
| H06 | El drift de tipos quedó sin dueño: el DoD lo da por hecho en un CI que no existe | 🟡 | 🔴 abierto |
| **H07** | **El CLI de Supabase está declarado pero no se puede instalar ni ejecutar** | 🔴 | 🔴 **abierto** |
| H08 | `db:types` borra los tipos commiteados cuando falla | 🟠 | 🔴 abierto |
| H09 | `--project-id` recibe un nombre de proyecto, no un ref | 🟡 | 🔴 abierto |
| H10 | La vinculación remota, mitad del objetivo de T-002, no está entregada | 🟡 | 🔴 abierto |
| H11 | `.env.example` sigue entregando el flujo con Docker | 🟡 | 🔴 abierto |
| **A01** | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ arreglado-verificado (`17a0be4`) — **0 fuera de alcance** |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)

## Lo que está verificado y bien

- **H01:** `browser.ts` en `src/lib/supabase/browser.ts`. Fixture consumidor `client-browser-supabase-consumer.tsx` con 0 errores de boundaries.
- **H02:** `server.ts` con `import 'server-only'` y regla propia `cadeapp/server-layer-must-be-server-only`, probada en rojo y en verde con dos fixtures.
- **H04:** `supabase/config.toml` entró a los «Archivos permitidos» de la ficha y del plan. Verificado con `grep -c` → 1 en ambos.
- **H05:** barrido recursivo de claves sobre todo el repo, demostrado en rojo con un PAT falso plantado.
- **A01:** los 16 archivos del diff caen dentro de la ficha. Primera de las tres PRs sin desvío de alcance.
- `admin.ts` tiene `server-only` y no hardcodea nada: el ítem explícito del DoD se cumple.
- `typecheck`, `lint` y `test` en verde en `17a0be4`: 65/65.

## Lo que no

> El commit `b0c4c4f` cerró H04 correctamente, pero su otra mitad —H06— **cambió el problema de lugar en vez de resolverlo**: la validación de drift pasó de ser imposible de correr a ser responsabilidad de nadie, y quedó marcada `[x]`.

> `pnpm install --frozen-lockfile` **falla** (`ERR_PNPM_OUTDATED_LOCKFILE`), así que el CLI de Supabase que da título a la tarea no está instalado y `pnpm db:types` no puede correr. El lockfile ya venía desalineado de T-000 —eso se me pasó en la revisión de la #47—, pero esta PR agrega el motivo 29 y es la que depende de que el CLI exista.

> En la ronda 2 di H03 por cerrado verificando solo una de sus dos mitades. Corregido a `parcial` en la ronda 3.

## Nota sobre esta carpeta

El commit `04d77e9` metió esta carpeta en la rama de la tarea y el revert `fbe7054` la borró entera, informes incluidos. A partir de ahí vive en la rama **`docs/revisiones`**, que es lo que [`../COMO-ENTREGAR.md`](../COMO-ENTREGAR.md) prescribe: el dato estructurado nunca va en la rama que se está revisando. `revisiones/ronda-2.md` es una reconstrucción, no el original.
