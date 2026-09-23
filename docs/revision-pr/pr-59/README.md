# PR #59 — T-008 · Base de UI y tokens de Stitch (D16)

> ✅ **Lista para aceptar · 0 bloqueantes · 38 de 40 cerrados · CI 8 de 8 en `c4797ce`**

| | |
|---|---|
| **PR** | [#59](https://github.com/cadeApp/cadeApp/pull/59) · `feat/T-008-ui-tokens-d16` → `develop` |
| **Tarea / issue** | [`T-008`](../../tasks/T-008.md) · Issue #9 |
| **Autor** | Lautaro073 (agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **SHA final** | `c4797ce` (arreglos en `30653c2` y `cdbd9a9`) |
| **Alcance** | 45 archivos · **0 fuera** de «Archivos permitidos» · `assets/` intacto |

## Rondas

| Ronda | Estado revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `e3c1a4d` | ❌ 9 bloqueantes · 10 mejoras · 4 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |
| 2 | sin commitear | ❌ 4 bloqueantes · 2 regresiones · 8 mejoras · 3 decisiones | [`ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `c4797ce` | ✅ **sin bloqueantes** · 1 medio abierto · 1 bajo | [`ronda-3.md`](revisiones/ronda-3.md) |

## El dato de la PR: los controles del DoD

| | Ronda 1 | Ronda 2 | Ronda 3 |
|---|---|---|---|
| **Mutaciones que ponen la suite en rojo** | **1 de 9** | **10 de 12** | **16 de 16** |

En la ronda 1 se podía devolver la tipografía a 12 px, desconectar el botón Confirmar del diálogo de acciones
irreversibles, meter clases arbitrarias y apagar la detección de movimiento reducido — todo con los 116 tests en
verde. Hoy cada una de esas cosas pone la suite en rojo.

`M2` cerró de una forma distinta: quedó **sin objetivo**, porque el manejo de foco propio se eliminó y solo
queda el de Radix. No hay dos implementaciones que confundir, así que no hay mutación que hacer.

## Lo que queda abierto

| id | sev | archivo | qué |
|---|---|---|---|
| `H30` | medio | `public/brand/logo.webp` | WebP de **272 × 0 px**: contenedor válido sin imagen. El control mide bytes (`> 20`), no dimensiones. Nadie lo consume todavía, pero el DoD dice «assets reales en `public/`» |
| `H31` | bajo | `implementation-plan.md:283` | La columna de archivos permitidos del plan §8 no lista los dos `tools/` ni el propio plan |

## Cerrados, con SHA

**38 de 40.** Los nueve bloqueantes de la ronda 1, los cuatro de la ronda 2, las dos regresiones y las siete
decisiones `D01`–`D07`. Los 24 que la ronda 2 había cerrado sobre un árbol sin commitear se revalidaron uno por
uno contra `c4797ce`; ninguno quedó sin `verificado_en_sha`.

## Checks en `c4797ce`

Worktree detached, `pnpm install --frozen-lockfile`. El árbol compartido no se tocó y nunca se cambió de rama.

`typecheck` ✅ · `lint` ✅ · `test` ✅ **129 casos** + 19 workflows + 6 ADR · `test:coverage` ✅ con `src/ui` en
**98,85 % / 91,90 % de ramas** y ningún archivo bajo el umbral de 80 · `build` ✅ (`/` 103 kB, `/design-system`
168 kB de 180) · `test:db` n.a. local, en CI `Files=3, Tests=98, Result: PASS` leído del log · **CI 8 de 8** ·
0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip`.

### Cobertura de ramas, de punta a punta

| | Ronda 1 | Ronda 3 |
|---|---|---|
| `src/ui` | 64,15 % | **91,90 %** |
| `dialog.tsx` | 53,84 % | 87,50 % |
| `select.tsx` | 62,50 % | 94,23 % |
| `notify.ts` | 65,21 % | 95,23 % |
| `sheet.tsx` | 57,14 % | 84,37 % |
| `toaster.tsx` | 12,50 % (líneas) | 100 % |

## Archivos

- [`revisiones/ronda-1.md`](revisiones/ronda-1.md) · [`ronda-2.md`](revisiones/ronda-2.md) · [`ronda-3.md`](revisiones/ronda-3.md)
- [`hallazgos.jsonl`](hallazgos.jsonl) — 40 registros
- [`lecciones.md`](lecciones.md) — `AG-49` a `AG-56`
- [`evidencia/comandos.md`](evidencia/comandos.md)
