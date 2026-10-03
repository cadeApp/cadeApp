# PR #222 — CC-018 · Select controlado sin reset espurio a vacío

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/222 |
| **Contrato** | CC-018 · Issue #219 |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-018-select-controlled-reset` → `develop` |
| **SHA funcional revisado** | `588439a8e3bf91ab76c7affa56b682034bdb8807` |
| **Último SHA verificado** | `bbe675a5d0516b3402f6f85c458b25c02ae56164` |
| **Estado** | Draft · SIN BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `588439a8e3bf91ab76c7affa56b682034bdb8807` | Código correcto; Preview Vercel rojo | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `bbe675a5d0516b3402f6f85c458b25c02ae56164` | SIN BLOQUEANTES | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR222-H01 | El Preview Vercel del SHA funcional no construyó | medio | cerrado · fallo transitorio verificado |

## Verificado como correcto

- La implementación funcional de CC-018 sigue siendo exactamente la de `588439a8e3bf91ab76c7affa56b682034bdb8807`; el commit de Ronda 1 agregó solo documentación de revisión.
- El alcance funcional coincide con CC-018: `src/ui/select.tsx`, `src/ui/select.test.tsx`, `docs/contracts/CC-018.md`.
- La corrección elimina únicamente `SelectPrimitive.Root` y su import; la API pública y los handlers propios de teclado/ARIA permanecen.
- Los tests cubren el bug controlado dentro de `<form>`, controlado/no controlado, fuente de verdad de `value`, roles/ARIA, cierre y `aria-selected`.
- GitHub Actions run 951 sobre el SHA funcional: todos los jobs GREEN; 114 archivos / 1687 tests PASS.
- GitHub Actions run 952 sobre el commit de revisión: todos los jobs GREEN; 114 archivos / 1687 tests PASS; `src/ui/select.test.tsx` 5/5.
- Preview Vercel fresco `dpl_H7iXX1GGecoXGyEhZVYeEE7k3XVM` sobre `bbe675a5d0516b3402f6f85c458b25c02ae56164`: READY.
- El fallo del deployment anterior quedó clasificado como transitorio: no reapareció sin modificar código funcional.

## Resultado

**SIN BLOQUEANTES.**

La PR puede salir de Draft y mergearse cuando Lautaro073 lo decida. La revisión no la aprueba ni la mergea por sí sola.
