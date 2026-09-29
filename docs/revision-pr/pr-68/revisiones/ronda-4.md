# PR #68 · T-104 — Ronda 4

- **PR:** [#68](https://github.com/cadeApp/cadeApp/pull/68) · `feat/T-104-cron-sweep` → `develop`
- **SHA revisado:** `c16501d` · merge-base `3faf0aa`; develop en `720e2d4`, merge limpio (`git merge-tree`)
- **Fecha:** 2026-09-24
- **Revisión:** independiente (Claude, sesión en la nube)
- **Resultado: ✅ SIN BLOQUEANTES · lista para aprobar.** `D02` y `H12` cerrados; **24 de 24 mutaciones de la batería de
  la revisión en rojo**; CI verde, leído por dentro. Queda abierta una mejora (`H11`) que no bloquea.

> **Método:** sin base local. Batería completa de la revisión (24 mutaciones + control) contra las 15 pruebas de
> `src/server/cron` y `src/app/api`; typecheck, lint, test y prettier en un worktree limpio de `c16501d`; y, como la
> ronda queda para aprobar, **CI leído por dentro**. Evidencia en
> [`evidencia/comandos.md`](../evidencia/comandos.md#ronda-4-sobre-c16501d).

---

## Esta vez el agente respetó el perímetro

`c16501d` toca **solo** `src/server/cron/sweep.test.ts` y `docs/tasks/log/T-104.md`, más el cuerpo de la PR. No tocó
`docs/revision-pr/**` ni marcó nada como verificado. Los rojos que anotó en la bitácora (`X20` y `X18`:
`1 failed | 14 passed (15)`, control `15 passed`) **coinciden exactamente** con los que corrí yo. Es la primera
ronda de esta PR en que la evidencia del autor se reproduce tal cual.

## Lo que se cerró, verificado en `c16501d`

| ID | Cómo lo verifiqué |
|---|---|
| `D02` | prueba nueva (`sweep.test.ts:768`): el `insert` de `audit_log` de la purga falla, `runSweep` rechaza y `courier_documents.update` no se llama. **X20** (marcar antes de auditar), ciega en la ronda 3, ahora es roja **en esa prueba** (reporter verbose). El texto de la bitácora y del cuerpo dice lo correcto: duplicado y no hueco en la purga; hueco posible en solicitudes y comercios, con el motivo |
| `H12` | prueba de frontera (`sweep.test.ts:848`): comercio en el último día de gracia en −03:00. **X18** (corte un día antes), ciega en la ronda 3, ahora es roja en esa prueba |

Siguen cerrados y la batería lo confirma: `H01` (X07, X07b), `H02` (X13, X14), `H03` (X01, X01b, X04b, X15, X16, X17,
X19), `H04` (X10, X11), `H05` (X02–X06, X08, X09), `H10` (X08) y `D01` (X21). `sweep.ts` y la ruta no cambiaron desde
la ronda 3.

## CI de `c16501d`, leído por dentro

| Job | Lo que dice |
|---|---|
| `db-tests` | `Files=8, Tests=1444, Result: PASS`; tipos `--local` generados y el `git diff --exit-code` del mismo paso en verde |
| `unit`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `approval-policy` | `success` |

La línea de resumen de Vitest queda debajo de la tabla de cobertura en el log de `unit`; la reproduje en un worktree
limpio del mismo SHA (abajo).

## Checks locales (worktree limpio de `c16501d`)

| | Resultado |
|---|---|
| `pnpm typecheck` · `pnpm lint` | exit 0 · exit 0 |
| `pnpm test` | `Tests 1 failed \| 318 passed (319)`: la falla es un **timeout de 5 s** en `src/server/supabase/clients.test.ts` («`tools/db-types.mjs` no debe truncar…», de T-002), que invoca el CLI de Supabase. Sola pasa **10/10 dos veces** (1,4 s). La PR no toca `src/server/supabase` ni `tools`, y en CI `unit` está verde. Es carga del contenedor, no la PR |
| `prettier --check` | limpio |
| Batería de la revisión | 24/24 rojas · control `15 passed` |

## Mejora que queda abierta (no bloquea)

- **`H11`:** una falla de Storage sigue frenando el paso de suscripciones ese día (`sweep.ts:130`). Era opcional y no
  se tomó. Queda para una tarea posterior o para cuando se toque el barrido.

## Nota menor, sin hallazgo

La bitácora de la sesión 4 no anota el SHA publicado (el prompt pedía el de `git ls-remote`) y cierra con «DoD
completo y verificado». Como la verificación la hace la revisión, conviene que diga «completo», a secas. No bloquea.

## Resumen de la PR

Cuatro rondas. La implementación fue buena desde el principio en lo difícil (tiempo constante, delegación en el
dominio para la zona horaria, reintento de la purga) y lo que costó fueron los controles: de 7 mutaciones ciegas de
12 en la ronda 2 a 0 de 24 en la ronda 4. El otro costo fue de proceso: tres veces el autor escribió la carpeta de la
revisión y la dio por verificada (`H09`, `H13`). En esta ronda no pasó.
