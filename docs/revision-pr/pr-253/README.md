# PR #253 — T-309 · E2E de carga de documentos con red lenta y accesibilidad

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/253 |
| **Tarea** | T-309 |
| **Autor** | @asako669 |
| **Rama** | `feat/T-309-uploads-a11y` → `develop` |
| **SHA R1** | `0dc814cf1e240f50bc3c9add370ac924866c39cc` |
| **SHA R2** | `64f5b9153a5614ba2920e622857db18910137a42` |
| **SHA R3** | `d7b7f40a80d8619ad126df6369ddaa8e45f9ad10` |
| **SHA R4 funcional revisado** | `f3d783ba44c5cbe15f8b5c2485a18d91a93d202d` |
| **develop al revisar R4** | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| **Estado** | **BLOQUEADA POR DEFECTOS EXTERNOS (2)** |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | `0dc814c` | 8 bloqueantes |
| 2 | `64f5b91` | 8 bloqueantes |
| 3 | `d7b7f40` | 2 bloqueantes internos |
| 4 | `f3d783b` | **0 hallazgos internos abiertos · 2 bloqueos externos** |

## Estado de hallazgos

Los **12 hallazgos internos PR253-H01…H12 están arreglados-verificados**.  
No se agregan H13/H14 porque los dos fallos restantes son defectos preexistentes del producto y no son atribuibles ni a la implementación de T-309 ni a su ficha.

Bloqueos externos:
- **#296** — viaje: `aria-hidden-focus` + contraste WCAG AA.
- **#297** — onboarding: contraste WCAG AA en tarjetas de documentos.

Ambos defectos existen con los mismos blobs en `develop` y en la rama de T-309. Encajan además en el alcance de la pasada de accesibilidad **T-205 / #32**.

## CI R4

Sobre el SHA funcional `f3d783b`:
- CI `37554842296`: typecheck, lint, unit, build, db-tests, audit y bundle-budget ✅.
- Vercel ✅.
- `e2e-preview` `37554952589`: **43 passed / 2 failed**.
- Los únicos fallos son `axe AA en viaje` y `axe AA en onboarding`, por #296 y #297.

La PR permanece **Draft**. No se aprueba ni mergea hasta que #296 y #297 estén corregidos/mergeados en `develop`, la rama se sincronice y el `e2e-preview` exact-head quede GREEN.
