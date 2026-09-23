# PR #59 — T-008 · Base de UI y tokens de Stitch (D16)

> ❌ **Con bloqueantes · 9 bloqueantes · 10 mejoras · 4 decisiones resueltas · CI 7 de 8 en `e3c1a4d`**

| | |
|---|---|
| **PR** | [#59](https://github.com/cadeApp/cadeApp/pull/59) · `feat/T-008-ui-tokens-d16` → `develop` |
| **Tarea / issue** | [`T-008`](../../tasks/T-008.md) · Issue #9 |
| **Autor** | Lautaro073 (agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **SHA revisado** | `e3c1a4d` (implementación `40ab440`, Fase Roja `3b6ad9f`) |
| **Base** | `origin/develop` = `92c8386` |
| **Alcance** | 28 archivos · **0 fuera** de «Archivos permitidos» |

## Rondas

| Ronda | SHA | Fecha | Resultado | Informe |
|---|---|---|---|---|
| 1 | `e3c1a4d` | 2026-09-23 | ❌ 9 bloqueantes · 10 mejoras · 4 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |

## Resumen en una línea

El código tiene disciplina real —cero dependencias no autorizadas, cero `any`/`!`/`.skip`, tokens correctos,
matriz de contraste que calcula de verdad— y lo que falla es **lo que lo verifica**: de nueve controles del DoD
que rompí a propósito, **ocho dejaron la suite en verde**.

## Estado por hallazgo

| id | sev | archivo | qué | estado |
|---|---|---|---|---|
| `H01` | alto | cuerpo del PR | `approval-policy` en rojo: CI es 7 de 8 y el informe declara todo verde | abierto |
| `H02` | alto | `skeleton.tsx:15` | `animate-pulse` y `animate-spin` ignoran el movimiento reducido; los presets que lo respetan no animan nada | abierto |
| `H03` | alto | `ui-system.test.tsx:264` | `ConfirmDialog` 0 % de cobertura; la prueba afirma sobre un `vi.fn()` desconectado | abierto |
| `H04` | alto | `ui-system.test.tsx:92` | Anti-12px se verifica sobre `tokens.css`, que no tiene tipografía | abierto |
| `H05` | alto | `select.tsx:117` | `role="option"` huérfano en S00 y la auditoría reporta 0 violaciones | abierto |
| `H06` | alto | `form.tsx:188` | `FormMessage` sin `id`; el control sin `aria-describedby` | abierto |
| `H07` | alto | `ui-system.test.tsx:343` | El barrido de arbitrarios usa lista fija: 8 clases reales escapan | abierto |
| `H08` | alto | `motion/index.tsx:26` | Nada ejercita la detección de `prefers-reduced-motion` | abierto |
| `H09` | alto | `ui-system.test.tsx:145` | El foco automático del Dialog: la prueba enfoca y después afirma | abierto |
| `H10` | medio | `notify.ts:58` | `notify` suprime en vez de reemplazar; el id puede quedar tomado | abierto |
| `H11` | medio | `notify.ts:48` | El sanitizador no reconoce lo que produce `formatPhone` | abierto |
| `H12` | medio | `select.tsx:141` | El Select muestra el value crudo en el primer pintado | abierto |
| `H13` | medio | `tokens.ts:95` | La matriz no cubre `.badge-success` ni `bg-muted` | abierto |
| `H14` | medio | `brand-logo.tsx:4` | `BRAND_ASSET_PATHS`: cuatro rutas 404 | abierto (cierra con `D02`) |
| `H15` | bajo | `tokens.css:12` | El ratio es 7,35:1 y no 6,93:1; el umbral 6.9 no es AAA | abierto |
| `H16` | bajo | `brand-logo.tsx:11` | El SVG está duplicado: se puede cambiar el color con la suite en verde | abierto |
| `H17` | bajo | `select.tsx:77` | El Select no tiene teclado ni forma de cerrarse | abierto (cierra con `D01`) |
| `H18` | bajo | `dialog.tsx:101` | El Dialog no devuelve el foco al cerrar | abierto (cierra con `D01`) |
| `H19` | bajo | `toaster.tsx:9` | El `<Toaster />` real nunca se renderiza | abierto |
| `D01` | 🔵 | `T-008.md:24` | Librerías de la regla 25 prohibidas por la ficha | **decidido**: ampliar ficha e instalar |
| `D02` | 🔵 | `T-008.md:8` | `public/**` y la ruta de S00 | **decidido**: ampliar ficha |
| `D03` | 🔵 | `showcase.tsx:23` | axe | **decidido**: mover a E2E |
| `D04` | 🔵 | `vitest.config.ts:15` | Umbral de cobertura para `src/ui/**` | **decidido**: sumarlo en esta PR |

Las cuatro decisiones se le preguntaron a Lautaro073 **antes** de escribir el informe, así que la ronda 2 entra
con todo resuelto y nada esperando.

## Checks en `e3c1a4d`

Worktree detached (`../cadeApp-rev59`) con `pnpm install --frozen-lockfile`. El árbol compartido con el agy no se
tocó y nunca se cambió de rama.

`typecheck` ✅ · `lint` ✅ · `test` ✅ (13 archivos · 116 casos + 19 workflows + 6 ADR) · `test:coverage` ✅
(pero el umbral solo alcanza `src/domain/**`; `src/ui` queda en **64,15 % de ramas**) · `test:db` n.a. (sin Docker
local; en CI pasa) · **CI 7 de 8**: `approval-policy` en rojo.

## Archivos

- [`revisiones/ronda-1.md`](revisiones/ronda-1.md) — informe completo
- [`hallazgos.jsonl`](hallazgos.jsonl) — 23 registros
- [`lecciones.md`](lecciones.md) — `AG-49` a `AG-52`
- [`evidencia/comandos.md`](evidencia/comandos.md) — comandos, probe y batería de mutaciones
