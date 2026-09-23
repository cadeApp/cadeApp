# PR #58 — T-006 · Contratos de dominio v1

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/58 |
| **Tarea** | T-006 · Contratos de dominio v1 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-006-contracts-v1` → `develop` |
| **Estado** | ✅ **Lista para aceptar** · 0 bloqueantes · 15 de 16 verificados · CI **8 de 8** en `d100c3a` |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `afe3631f46d450cdfdd128f73b46ccee56b02b76` | **14 hallazgos bloqueantes** | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `ad630b98ac846a1b667bd4d37fb0d359b4f49deb` | **10 verificados · 4 siguen bloqueando** | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `d100c3a` | **4 bloqueantes cerrados + la mejora de la ronda 2** · 1 bajo nuevo · **0 bloqueantes** | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Decisiones humanas cerradas antes de entregar la ronda

1. Se amplía «Archivos permitidos» de T-006 para incluir `vitest.config.ts` y configurar ahí el umbral real de cobertura de ramas ≥ 90 %.
2. Se amplía el alcance a `package.json` y `pnpm-lock.yaml` para remediar las vulnerabilidades que ahora hacen fallar el job `audit`.
3. Si existen las cuatro coordenadas, la distancia se calcula con Haversine. Si falta el pin/coordenadas, no se inventa distancia con centroides: el producto mostrará «De barrio X a barrio Y» sin distancia. Una caída de Google Maps no cambia una distancia ya calculada porque Haversine corre en servidor y no depende de esa API.
4. En la ronda 2 Lautaro073 autorizó ampliar el alcance para actualizar Next.js a una versión soportada y parcheada —como mínimo 15.5.24—. Ignorar los 10 GHSA de severidad alta/crítica no se acepta como remediación.

## Estado al cerrar

| ID | Sev. | Estado |
|---|---|---|
| `H01`–`H04`, `H06`, `H09`–`H13` | — | ✅ verificados en `ad630b9` (ronda 2) |
| **`H05`** · error forzado fuera del catálogo | 🟠 | ✅ verificado (`d100c3a`) — tipo **y** guarda de runtime |
| **`H07`** · relaciones imposibles, outputs inválidos, ventana de incidentes | 🟠 | ✅ verificado (`d100c3a`) — 4 contracasos + los 8 `!` eliminados |
| **`H08`** · la secuencia pisaba ofertas sembradas | 🟡 | ✅ verificado (`d100c3a`) — `nextUniqueOfferId` busca hueco |
| **`H14`** · 10 avisos altos/críticos silenciados | 🔴 | ✅ verificado (`d100c3a`) — **0 altas, 0 críticas, sin `ignoreGhsas`** |
| `H15` · códigos de settings inalcanzables | 🔵 | ✅ verificado (`d100c3a`) — era la mejora no bloqueante de la ronda 2 |
| `H16` · `createClient` async sin prueba que lo ejercite | 🔵 | 🔴 abierto · **corresponde a T-009**, no bloquea |

## Qué queda

1. **`H16`** — que T-009 liste en su DoD el caso de `createClient()` async: hoy nada lo ejecuta y `typecheck` solo valida la firma.
2. **Confirmar dónde aterriza `PR57-H22`** — mover `notes` a `delivery_request_contacts` está asignado a T-006 por decisión de Lautaro073, y **no entra en este PR**, que es de contratos de dominio y no toca `supabase/`.

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)
