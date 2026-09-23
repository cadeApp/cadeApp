# PR #59 — T-008 · Base de UI y tokens de Stitch (D16)

> ❌ **Con bloqueantes · 4 bloqueantes · 2 regresiones · 8 mejoras · 3 decisiones resueltas**
> ⚠️ **El trabajo de la ronda 2 está sin commitear**: no hay SHA que verificar.

| | |
|---|---|
| **PR** | [#59](https://github.com/cadeApp/cadeApp/pull/59) · `feat/T-008-ui-tokens-d16` → `develop` |
| **Tarea / issue** | [`T-008`](../../tasks/T-008.md) · Issue #9 |
| **Autor** | Lautaro073 (agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **Head del PR** | `2491a4c` (el commit de la ronda 1) |
| **Estado revisado en ronda 2** | árbol de trabajo sin commitear, snapshot del 2026-09-23 02:50 |
| **Alcance** | 33 archivos · **8 fuera** de «Archivos permitidos» (`assets/1-8.svg`) |

## Rondas

| Ronda | Estado revisado | Fecha | Resultado | Informe |
|---|---|---|---|---|
| 1 | `e3c1a4d` | 2026-09-23 | ❌ 9 bloqueantes · 10 mejoras · 4 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |
| 2 | sin commitear | 2026-09-23 | ❌ 4 bloqueantes · 2 regresiones · 8 mejoras · 3 decisiones | [`ronda-2.md`](revisiones/ronda-2.md) |

## Lo primero

**Nada de la ronda 2 está commiteado.** 29 archivos modificados y dos carpetas sin trackear viven solo en el
árbol de trabajo compartido; `origin/feat/T-008-ui-tokens-d16` sigue en `2491a4c` y la bitácora no tiene entrada
nueva. `AGENTS.md` §5 pide cerrar cada sesión con bitácora, commit y push.

Por eso **ningún hallazgo cerrado en esta ronda lleva `verificado_en_sha`**, aunque todos se verificaron
ejecutando. `analizar.mjs verificacion` los lista bajo «corregido pero NO verificado», que es lo correcto: la
ronda 3 tiene que revalidarlos contra el commit.

## El dato de la ronda: los controles pasaron de 1 vivo sobre 9 a 10 sobre 12

Misma batería de mutaciones que la ronda 1, más cuatro nuevas.

| # | Rompí | R1 | R2 |
|---|---|---|---|
| M1 | `xs` vuelve a 12 px | 🟢 | 🔴 |
| M2 | saco el foco automático del Dialog | 🟢 | 🟢 (`H09` · lo hace Radix) |
| M3 | clases arbitrarias en `src/ui` | 🟢 | 🔴 |
| M4 | desconecto Confirmar de `ConfirmDialog` | 🟢 | 🔴 |
| M5 | `MotionConfig` no lee la preferencia | 🟢 | 🔴 |
| M6 | `mutedForeground` a 2,42:1 | 🔴 | 🔴 |
| M6b | `--accent` de `tokens.css` a 1,06:1 | 🟢 | 🟢 (`H22` · dos copias) |
| M8 | `notify` sin `id` | 🟢 | 🔴 |
| M9 | saco la guarda CSS de movimiento reducido | — | 🔴 |
| M11 | `FormControl` no apunta al error | — | 🔴 |
| M12 | borro un asset de `public/` | — | 🔴 |
| M13 | `notify` no sanitiza | — | 🔴 |

## Estado por hallazgo

### Bloqueantes abiertos

| id | archivo | qué |
|---|---|---|
| `H01` | cuerpo del PR | **parcial**: se agregó la sección pero `approval-policy` sigue rojo y el informe quedó viejo |
| `H20` | `assets/1-8.svg` | 8 archivos fuera de alcance; 7 más pesados; 6,45 MB → 13,9 MB |
| `H21` | `public/brand/logo.svg` | 1,25 MB contra 5 KB de presupuesto; copia byte a byte de `assets/2.svg` |
| `R01` | `notify.ts` | **regresión**: desaparecieron `DOMAIN_ERROR_MESSAGES` y `notify.promise` |

### Cerrados en la ronda 2 (sin SHA — revalidar)

`H02` · `H03` · `H04` · `H05` · `H06` · `H07` · `H08` · `H10` · `H11` · `H12` · `H14` · `H15` · `H16` · `H17` ·
`H18` · `H19` · `D01` · `D02` · `D03` · `D04` — y `H09` y `H13` cerrados en la propiedad con residual anotado.

### Mejoras abiertas

| id | archivo | qué |
|---|---|---|
| `R02` | `dialog.tsx:144` | `Escape` invoca `onClose` dos veces |
| `H22` | `tokens.css:21` | `tokens.ts` y `tokens.css` son copias sin control de sincronía |
| `H23` | `verify-fichas.test.ts:118` | `T-008` en `EXCEPCIONES`, que es para tareas mergeadas |
| `H24` | `dialog.tsx:180` | `backdrop-blur-xs` no existe en Tailwind 3.4 |
| `H25` | `brand-logo.tsx:38` | la marca quedó como `CadeApp` y `Cade` |
| `H26` | `notify.ts:43` | `activeToastIds` es estado muerto |
| `H27` | `ui-system.test.tsx:93` | el nombre de la prueba dice Tucumán; el código, Buenos_Aires |
| `H28` | `dialog.tsx:123` | duplica a mano la gestión de foco de Radix |
| `H29` | `design-system/page.tsx:4` | ruta pública e indexable, 168 kB |

### Decisiones

| id | qué | decisión |
|---|---|---|
| `D01`–`D04` | ronda 1 | **aplicadas** |
| `D05` | dónde viven los mensajes de `DomainErrorCode` | crear `src/lib/error-messages.ts` |
| `D06` | plan §8 vs excepción en `verify-fichas` | actualizar el plan y sacar la excepción |
| `D07` | exposición de `/design-system` | pública con `noindex` |

## Checks (snapshot del árbol de trabajo)

`typecheck` ✅ · `lint` ✅ · `test` ✅ **126 casos** (eran 116) + 19 + 6 · `test:coverage` ✅ con `src/ui` en
**98,09 % / 89,39 % de ramas** y umbral real de 80 por archivo · `build` ✅ (`/` 103 kB, `/design-system` 168 kB,
presupuesto 180) · `test:db` n.a. · CI **7 de 8** en `2491a4c`, y **el trabajo de esta ronda todavía no pasó por
CI**.

## Archivos

- [`revisiones/ronda-1.md`](revisiones/ronda-1.md) · [`revisiones/ronda-2.md`](revisiones/ronda-2.md)
- [`hallazgos.jsonl`](hallazgos.jsonl) — 38 registros
- [`lecciones.md`](lecciones.md) — `AG-49` a `AG-54`
- [`evidencia/comandos.md`](evidencia/comandos.md)
