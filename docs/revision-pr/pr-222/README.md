# PR #222 — CC-018 · Select controlado sin reset espurio a vacío

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/222 |
| **Contrato** | CC-018 · Issue #219 |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-018-select-controlled-reset` → `develop` |
| **SHA funcional revisado** | `588439a8e3bf91ab76c7affa56b682034bdb8807` |
| **Estado** | Draft · CON BLOQUEANTE OPERATIVO |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `588439a8e3bf91ab76c7affa56b682034bdb8807` | Código correcto; Preview Vercel rojo | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR222-H01 | El Preview Vercel del SHA revisado no construye | medio | abierto |

## Verificado como correcto

- La rama estaba sincronizada con `develop`: 1 commit ahead, 0 behind; PR mergeable.
- Los únicos archivos funcionales/documentales tocados están permitidos por CC-018: `src/ui/select.tsx`, `src/ui/select.test.tsx`, `docs/contracts/CC-018.md`.
- La corrección elimina únicamente `SelectPrimitive.Root` y su import; no altera la API pública ni los handlers propios de teclado/ARIA.
- La suite nueva cubre el bug exacto dentro de `<form>`, controlado/no controlado, fuente de verdad de `value`, roles/ARIA, cierre y `aria-selected`.
- GitHub Actions run 951 sobre el SHA revisado: typecheck, lint, unit, build, audit, db-tests y bundle-budget GREEN.
- Unit en CI: 114 archivos / 1687 tests PASS; `src/ui/select.test.tsx` 5/5 PASS.

## Pendiente

El deployment Vercel `dpl_CqVhLF7kG57bper8AXMYk7oPmG7E` del mismo SHA terminó `ERROR`:
`Command "pnpm run build" exited with 1` (`errorCode: type_error`).

No se atribuye todavía a código: el build de GitHub del mismo SHA es verde. Hace falta un deployment fresco GREEN o, si vuelve a fallar, inspeccionar su log y corregir la causa real.

**No mergear hasta cerrar PR222-H01.**
