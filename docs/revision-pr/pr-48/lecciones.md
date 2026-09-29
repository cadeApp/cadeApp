# Lecciones de la PR #48 (T-001) para `AGENTS.md` y las reglas

**Fuente:** 6 registros (5 hallazgos + 1 desvío de alcance). Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

> Ronda 1. Conviene esperar a que se arreglen para ver si aparecen regresiones, como pasó en la #47.

## Patrón dominante

Los dos hallazgos serios (`H01`, `H02`) son **el mismo error que ya cometimos en T-000**: una expresión regular que cubre la forma exacta que nombra el DoD y ninguna variante. En T-000 fue `includes('/server')` y la lista de `disallow` incompleta; acá es la lookahead de `.env` y el `git push` sin rama.

Las reglas `AG-05` (allowlist en vez de enumerar lo prohibido), `AG-06` (cubrir todas las formas) y `AG-07` (caso negativo obligatorio) ya cubren esto. **No hacen falta reglas nuevas: hace falta que las existentes se apliquen a los scripts de `.agents/`,** que hoy no están cubiertos ni por lint ni por revisión.

## Lecciones propuestas

### AG-16 · Mover un archivo obliga a actualizar quien lo nombra
**Origen:** H03

La PR movió `docs/agy-kit/` a la raíz y borró el original, pero dejó siete citas a la ruta vieja en el plan de implementación — incluido un enlace markdown roto y la instrucción de onboarding para los dos operadores que no programan.

> **Regla propuesta.** Al mover, renombrar o borrar un archivo, el agente busca su ruta anterior en todo el repositorio (`grep -rn "<ruta-vieja>"`, excluyendo `node_modules`) y actualiza cada aparición, sean enlaces o texto plano. El PR lista cuántas referencias se encontraron y cuántas se actualizaron. Un `git mv` limpio no garantiza nada: git renombra el archivo, no las menciones.
>
> **Control asociado para T-003:** un verificador de enlaces markdown relativos sobre `docs/` y `.agents/`. Barato y habría atajado este caso.

### AG-17 · Los scripts de `.agents/` también son código
**Origen:** H01, H02

`agent-guard.mjs` es el freno técnico del que dependen las tres personas, y hoy no lo cubre `pnpm lint` (`--dir src --file middleware.ts`) ni tiene más pruebas que las cuatro del DoD.

> **Regla propuesta.** `.agents/scripts/**` y `tools/**` entran en el alcance del lint y se revisan con el mismo estándar que `src/**`. Toda regla de bloqueo lleva, además del caso que nombra el DoD, al menos dos variantes que el atacante o el despistado usaría — comodines, formas abreviadas, y la forma sin argumentos.

## Qué cambiar, en orden de impacto

1. **Ampliar el alcance del lint** a `.agents/` y `tools/`, donde vive casi todo el cambio de esta PR y nada lo mira.
2. **AG-16** con su verificador de enlaces — barato y ya tiene un caso real.
3. **El check de «Archivos permitidos»** que `AG-13` viene pidiendo: `P10` va cuatro apariciones en dos PRs.
