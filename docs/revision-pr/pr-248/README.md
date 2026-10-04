# PR #248 — T-336 · Navegación de retorno y 404 al home real de la sesión

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/248 |
| **Tarea** | T-336 · issue #247 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-336-retorno-home-real` → `develop` |
| **Base** | `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3` |
| **HEAD R6 revisado** | `cbe3a4ca59c232f06c1c6e2dfb863f94173677ed` |
| **Estado** | **Ronda 6 · CON 1 BLOQUEANTE RAÍZ** |

## Estado de hallazgos

- PR248-H01 → arreglado-verificado
- PR248-H02 → arreglado-verificado
- PR248-H03 → arreglado-verificado
- PR248-H04 → abierto, dependiente de H05
- PR248-H05 → **abierto / bloqueante alto**

## Hallazgo raíz R6

El E2E permanente ya es discriminante, pero el Preview real demuestra que el producto sigue fallando.

Preview probado:
`968fc862e251fc797700a800703993c86e691899`

Run E2E:
`37190004737`

Resultado real:
- cookie Supabase presente después del login;
- cookie presente después del 404;
- click «Ir al inicio» → `/login`;
- hard navigation posterior a `/login` → **también** `/login`;
- tres intentos fallaron;
- status `e2e-preview = failure`.

El courier seed tiene `consent_status='active'`, por lo que CC-007 no explica el 200 de `/login`.

## Causa raíz

El proyecto usa `src/app`, pero el middleware está en `/middleware.ts` en la raíz.

Next.js 15 requiere que el middleware esté dentro de `src` cuando se usa `src/app`, al mismo nivel que `app`.

Evidencia independiente:
- el output de `next build` del run `37190624714` lista todas las rutas pero **no lista Middleware**;
- runtime logs del Preview no muestran actividad de `edge-middleware`;
- `GET /login` responde 200 con cookie autenticada.

## CI HEAD R6

Run `37190624714`:
- 118 test files / 1880 tests PASS;
- DB 10/10 + 1811/1811 PASS;
- lint/typecheck/build/bundle GREEN;
- `/courier/feed 159 kB`;
- `/courier/profile 178 kB`.

Esos checks no validan que Next haya descubierto el middleware.

## Resultado

No mergear. Mover/activar el middleware real y repetir el E2E Preview.
