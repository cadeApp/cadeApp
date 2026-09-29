# PR #49 · Ronda 2 — `04d77e9`

> **Nota sobre este archivo.** El informe original de la ronda 2 se escribió en el árbol de trabajo y nunca se commiteó. El `git revert` de `04d77e9` (commit `fbe7054`) se llevó puesta la carpeta `docs/revision-pr/pr-49/` completa, incluido este archivo. Lo que sigue es una **reconstrucción** hecha en la ronda 3 a partir de los comandos guardados y del `hallazgos.jsonl`; el texto no es el original, los resultados sí.
>
> La lección operativa está en `lecciones.md` (AG-22): el dato de una revisión no puede vivir sin commitear en la rama que se está revisando.

| | |
|---|---|
| **SHA revisado** | `04d77e9` |
| **Veredicto** | 4 de 7 cerrados y verificados |
| **Fecha** | 2026-09-21 |

## Checks en `04d77e9`

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | limpio |
| `pnpm test` | 65 passed (65) en 9 archivos |

## Verificado en verde

| ID | Cómo se comprobó | Resultado |
|---|---|---|
| **H01** | Client Component (`"use client"`) importando `@/lib/supabase/browser` | 0 errores de ESLint |
| **H02** | La regla nueva probada **en las dos direcciones**: fixture sin `server-only` → 1 error; con `server-only` → 0; con el import en segunda posición → 0 | correcta |
| **H03** | `grep -c "test:db" docs/onboarding.md` | 0 |
| **H05** | **Demostrado en rojo**: plantando un PAT falso con prefijo `sbp_` en `docs/zz-clave-falsa.md` | `Tests 1 failed \| 7 passed (8)` |

H02 se probó también con el import en segunda posición porque la implementación anterior dependía de `Program.directives`, que es una extensión de Babel y no existe en espree. Con la regla actual pasa igual, que es lo correcto.

## La verificación falsa de H04

El commit `04d77e9` dejó `H04` como `arreglado-verificado` con este método:

> `inspeccion: supabase/config.toml formalizado como configuracion declarativa del proyecto en la ficha ampliada`

La celda «Archivos permitidos» de la ficha decía, en ese SHA:

```
src/server/supabase/**, src/lib/supabase/**, tools/**, .eslintrc.json,
package.json, .env.example, docs/onboarding.md, docs/tasks/**,
docs/implementation-plan.md
```

`grep config.toml` sobre esa celda devolvía **0**. El hallazgo volvió a `abierto`.

Es la primera vez que la disciplina de `verificado_en_sha` atrapa una auto-verificación. Y deja una regla para el flujo de P2/P3, donde el agente que arregla también escribe el `hallazgos.jsonl`:

> El `verificado_metodo` tiene que ser un **comando con su salida**, no una afirmación en prosa. «`inspección: X formalizado en la ficha`» no es verificable; «`grep config.toml <celda de la ficha> → 1`» sí, y se habría caído sola al escribirla.

Quedó incorporado a `COMO-ENTREGAR.md`.

## Estado al cerrar la ronda

| ID | Estado |
|---|---|
| H01, H02, H03, H05 | cerrados y verificados en `04d77e9` |
| H04 | **revertido a `abierto`** |
| H06 | parcial |
| A01 | parcial — 11 archivos fuera de alcance, 10 de ellos de mi propia carpeta de revisión |

El `README.md` de la PR afirmaba «6 hallazgos resueltos y verificados + 1 decisión aceptada (0 pendientes)». Se corrigió a 4/7 con una nota que registra lo que el commit afirmaba y lo que quedó comprobado.

> En la ronda 3, H03 bajó de `arreglado-verificado` a `parcial`: el `grep -c test:db → 0` verificaba solo una de las dos mitades del hallazgo. Ver `ronda-3.md`.
