# PR #49 — T-002 · Clientes @supabase/ssr, vinculación remota y scripts db:*

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/49 |
| **Tarea** | T-002 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-002-supabase-clients` → `develop` |
| **Base** | `9f03018` |
| **Tamaño** | 19 archivos, +664 / −57 |
| **Estado** | Abierta · **LISTA PARA ACEPTAR** · 15 de 16 cerrados y verificados en `4010afa` · 0 decisiones |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3ba9be6` | 6 abiertos + 1 decisión | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `04d77e9` | 4 cerrados · H04 revertido a abierto · A01 parcial | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `17a0be4` | H04 y A01 cerrados · H03 bajado a parcial · **5 nuevos, 1 crítico** | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `3be754a` | **Los 3 bloqueantes cerrados y verificados** · 2 nuevos chicos | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `62cf1f9` | H10, H12 y el residual de H06 cerrados · **H13 reabierto: la prueba no ejecuta el script** | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |
| 6 | `4010afa` | **H13 demostrado en rojo y H14 cerrados · los 15 técnicos cerrados** | [`revisiones/ronda-6.md`](revisiones/ronda-6.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | El cliente browser es inalcanzable desde un Client Component | 🟠 | ✅ verificado (`3be754a`) |
| H02 | Falta `server-only` en `server.ts` y `browser.ts` | 🟠 | ✅ verificado (`3be754a`) |
| H03 | El onboarding describe base local y cita un script inexistente | 🟡 | ✅ verificado (`3be754a`) |
| H04 | `config.toml` va en dirección contraria a la ficha | 🟡 | ✅ verificado (`3be754a`) |
| H05 | «No hay claves en el repo» se verifica sobre tres archivos | 🟡 | ✅ verificado (`3be754a`) |
| H06 | El drift de tipos quedó sin dueño | 🟡 | ✅ verificado (`3be754a`) — T-003 lo asume, demostrable |
| H07 | El CLI de Supabase está declarado pero no se puede instalar | 🔴 | ✅ verificado (`3be754a`) — `--frozen-lockfile` exit 0 |
| H08 | `db:types` borra los tipos commiteados cuando falla | 🟠 | ✅ verificado (`3be754a`) — mismo md5 tras fallar |
| H09 | `--project-id` recibe un nombre de proyecto, no un ref | 🟡 | ✅ verificado (`3be754a`) |
| H10 | La ficha promete una vinculación remota que ya no hace falta | 🔵 | ✅ verificado (`62cf1f9`) — resuelto por la opción (a) |
| H11 | `.env.example` sigue entregando el flujo con Docker | 🟡 | ✅ verificado (`3be754a`) |
| H12 | `.env.example` trae una URL de Supabase que no puede existir | 🔵 | ✅ verificado (`62cf1f9`) |
| H13 | La prueba de regresión no ejecuta el script: pasa en el vacío | 🟡 | ✅ verificado (`4010afa`) — demostrado en rojo |
| H14 | El arreglo de H12 amplió el regex del ref sin necesidad | 🔵 | ✅ verificado (`4010afa`) |
| **H15** | El cuerpo del PR no trae el checklist de seguridad (§2) | 🔵 | 🔴 abierto — **no es código** |
| **A01** | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ verificado (`3be754a`) — **0 fuera de alcance** |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)

## Checks en `3be754a`

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` (`--dir src --file middleware.ts --max-warnings 0`) | limpio |
| `pnpm test` | 65 passed (65) en 8 archivos |
| `pnpm install --frozen-lockfile` | **exit 0** |
| `pnpm supabase --version` | **2.116.0** |
| Alcance | 19 archivos, **0 fuera de la ficha** |

## Lo que está verificado y bien

- **H07:** lockfile regenerado sin bumps silenciosos —0 versiones resueltas eliminadas, 1 agregada, y los únicos paquetes nuevos son `supabase@2.116.0` con `eciesjs` y `jose`—. De paso arregló los 28 especificadores desalineados que venían de T-000: **`--frozen-lockfile` funciona por primera vez en el repo.**
- **H08:** demostrado en verde reproduciendo el escenario que destruyó el archivo en la ronda 3: `pnpm db:types` falló y `database.types.ts` conservó el mismo md5, los mismos 405 bytes y el árbol limpio.
- **H06:** el DoD de T-003 ahora dice «`ci.yml` falla si `db:types` deja drift (demostrado plantando un diff)». Criterio demostrable, con dueño.
- **La ficha se corrigió a sí misma:** «Dependencias nuevas permitidas» pasó de `ninguna` a declarar el CLI, y `pnpm-lock.yaml` entró a los «Archivos permitidos». Era la contradicción entre el título de T-002 y su propia letra chica.
- **A01:** segunda ronda consecutiva con 0 archivos fuera de alcance.

## Lo que queda

> **H10 es una decisión de una línea, no un arreglo.** Al delegar el drift a CI y resolver el ref por variable de entorno, la vinculación dejó de hacer falta; lo que sobra es la línea del objetivo que la promete.

> **H13 tardó tres rondas:** primero no existía la prueba, después existía pero no ejecutaba el script, y recién en la sexta atrapó el bug. Demostrada en rojo en `4010afa`.

## Nota sobre esta carpeta

El commit `04d77e9` metió esta carpeta en la rama de la tarea y el revert `fbe7054` la borró entera, informes incluidos. Desde entonces vive en la rama **`docs/revisiones`**, que es lo que [`../COMO-ENTREGAR.md`](../COMO-ENTREGAR.md) prescribe. `revisiones/ronda-2.md` es una reconstrucción, no el original.
