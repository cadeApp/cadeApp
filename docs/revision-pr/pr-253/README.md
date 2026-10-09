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
| **Estado** | **SIN BLOQUEANTES — RONDA 5; PR Draft hasta decisión P1** |

## Estado de Ronda 5 — 2026-10-09

- Revisión de `66630c1a548639be0e553e28685739f132050f4c` contra develop `8ebd5e2`; sin cambios nuevos en spec desde la ronda 4.
- Integrados T-350 y T-351. `e2e-preview` `37995617834` contra Preview de SHA exacto: **8/8 T-309 PASS**, 67 Chromium + 3 global-settings PASS.
- CI `37995517926`: todos los siete jobs PASS. 
- 12 hallazgos R1–R4 conservan trazabilidad; no se encontraron nuevos bloqueantes.
- Issues externos #296 y #297 siguen abiertos administrativamente pese a los fixes mergeados; seguimiento separado.
- [Informe de Ronda 5](revisiones/ronda-5.md). PR en Draft; Lautaro073 decide pasar a Ready y mergear una vez finalicen los checks que disparan los archivos de revisión.

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | `0dc814c` | 8 bloqueantes |
| 2 | `64f5b91` | 8 bloqueantes |
| 3 | `d7b7f40` | 2 bloqueantes internos |
| 4 | `f3d783b` | **0 hallazgos internos; 2 defectos externos aún sin corregir en aquel momento** |
| 5 | `66630c1` | **SIN BLOQUEANTES; E2E T-309 8/8 PASS, CI verde** |

## Estado de hallazgos

Los **12 hallazgos internos PR253-H01…H12 están arreglados-verificados**.  
No se agregan H13/H14: los dos defectos externos observados en R4 eran preexistentes del producto y no eran atribuibles a T-309. **En R5 ya quedaron corregidos en develop y las auditorías E2E pasan.**

Bloqueos externos **históricos de R4, resueltos funcionalmente en R5**:
- **#296** — viaje: `aria-hidden-focus` + contraste WCAG AA; fix T-350 / PR #308 mergeado y test viaje GREEN.
- **#297** — onboarding: contraste WCAG AA; fix T-351 / PR #310 mergeado y test onboarding GREEN.

Ambos issues aún estaban abiertos administrativamente al cerrar R5, pero **no bloquean el diff de T-309**. Se preserva el estado anterior en `revisiones/ronda-4.md`.

## CI R4

Sobre el SHA funcional `f3d783b`:
- CI `37554842296`: typecheck, lint, unit, build, db-tests, audit y bundle-budget ✅.
- Vercel ✅.
- `e2e-preview` `37554952589`: **43 passed / 2 failed**.
- Los únicos fallos son `axe AA en viaje` y `axe AA en onboarding`, por #296 y #297.

**Este bloque de CI corresponde históricamente a R4, no es el estado actual.** Los defectos se corrigieron por PR #308 y #310; R5 verifica 8/8 E2E PASS y CI verde. La PR continúa **Draft** hasta que Lautaro073 decida pasarla a Ready y autorice el merge.
