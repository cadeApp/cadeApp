# PR #248 — T-336 · Navegación de retorno y 404 al home real de la sesión

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/248 |
| **Tarea** | T-336 · issue #247 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-336-retorno-home-real` → `develop` |
| **Base** | `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3` |
| **HEAD R5** | `0a495a15386c32ec39d7c1029ecef0f774f11a07` |
| **Estado** | **Ronda 5 · CON BLOQUEANTE RESIDUAL (1)** |

## Estado

- PR248-H01 → arreglado-verificado
- PR248-H02 → arreglado-verificado
- PR248-H03 → arreglado-verificado
- PR248-H04 → **abierto / bloqueante residual**

## Diagnóstico R5

La corrección de producto confirma **Caso A**:

- las cookies Supabase permanecen presentes;
- la navegación suave con `next/link` a `/login` reutilizaba el Client Router Cache;
- una hard navigation documental a `/login` sí llega a middleware y redirige al home real;
- ErrorView/NotFoundView ahora usan `<a href="/login">`.

Eso es coherente con el bug manual reproducido por Lautaro073.

## Bloqueante residual

El E2E nuevo de `e2e/specs/smoke.spec.ts` **no es discriminante**.

Después del click:

1. espera 2 segundos;
2. si quedó incorrectamente en `/login`, ejecuta `page.goto('/login')`;
3. esa hard navigation corrige el estado;
4. recién después exige `/courier/feed`.

Por lo tanto, **el test también podría pasar con el bug original**. No demuestra que el click por sí solo esté arreglado y no cumpliría el RED pre-fix exigido.

## Housekeeping del revisor

`e2e/specs/smoke.spec.ts` no figuraba en la lista original de archivos permitidos de T-336, aunque el revisor lo autorizó expresamente en Ronda 4. La ficha se corrige en esta ronda para reflejar esa autorización. No se registra como fallo del agente.

## CI parcial del HEAD

Al registrar R5:
- Vercel: success;
- lint/typecheck/build/unit/bundle: success;
- DB seguía ejecutándose;
- e2e-preview aún no estaba publicado para el nuevo HEAD.

## Resultado

No mergear todavía. Falta únicamente hacer discriminante el E2E browser-level de H04 y revalidarlo.
