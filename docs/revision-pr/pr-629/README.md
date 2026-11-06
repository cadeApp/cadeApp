# PR #629 — T-405 · Comercios según A03

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/629 |
| **Tarea** | T-405 · Fase 4 (#486) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-405-comercios-a03` → `develop` |
| **Base revisada en R2** | `5a8f6dc504a320e13579921024ddfe7711d54479` (incluye CC-046) |
| **SHA funcional revisado en R2** | `af61096fdad07593686f7c6870dc8a204323f695` |
| **Diff PR vs develop en R2** | 23 archivos (incluye la documentación de R1) |
| **Resultado R2** | **SIN NUEVOS BLOQUEANTES DE CÓDIGO**, pero **CI parcial y e2e-preview T-405 pendiente**. No lista para merge. |

## Rondas

| Ronda | SHA funcional revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `ae38d57d34320a840b51db619ec6860af9cc8ed6` | H01 bloqueante, M01 mejora | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `af61096fdad07593686f7c6870dc8a204323f695` | H01 reparado y verificado en componente compartido; M01 reparada, E2E pendiente; 0 nuevos | [ronda-2.md](revisiones/ronda-2.md) |

## Estado actualizado por hallazgo

| ID | Resumen | Estado y fundamento |
|---|---|---|
| **PR629-H01** | `Sheet side="right"` quedaba centrado | **arreglado-verificado** para la corrección compartida: CC-046 (#631) mergeado; mismos blobs en T-405; E2E del menú 390/1023 del CC pasó en Actions. **E2E geométrico de T-405 todavía pendiente**. |
| **PR629-H02 (M01)** | Fecha fija caducaba | **arreglado-sin-verificar**: fecha dinámica UTC +60 días comprobada en fuente; el E2E nuevo no terminó. |

`hallazgos.jsonl` conserva dos registros, sin inventar hallazgos ni falsificar ejecución. [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Decisiones de Lautaro073 — sin novedades

- **D01=A:** action de lectura bajo demanda con Zod + AAL2.
- **D02=A:** conservar «Abono y piloto».
- **D03=A:** piloto `default`, activo `verified`.
- **D04=B:** CC compartido. [CC-046 / PR #631](https://github.com/cadeApp/cadeApp/pull/631) se mergeó en `develop` (`5a8f6dc5`); T-405 hizo merge sin conflictos (`8b4151e9`).

## Qué falta antes de mergear

1. **Gate oficial `e2e-preview` del SHA funcional `af61096f`**: comprobar que corrió el test de T-405 con posiciones 1280/390, mutación del plan, lectura de movimientos y navegación a Auditoría. Registrar run/job, líneas del resultado y `TARGET_SHA`. Si falla por los duplicados de streaming ya aislados en T-426 (#639/#640), registrarlo sin atribuir causalidad automática ni declararlo verde.
2. **CI oficial `db-tests`**: seguía en progreso cuando se redactó R2. Resto: lint, typecheck, unit, audit, build y bundle-budget completados en success; Vitest **195 archivos / 3686 tests**.
3. **Nueva verificación independiente** si el gate falla, aparecen cambios funcionales o surge otro hallazgo. No exigir otra CI GREEN exclusivamente por este commit documental.

## Límite de ejecución

En R2 el contenedor no resuelve `github.com` para `git ls-remote` ni clonar; no se ejecutaron Vitest, Playwright, mutaciones ni `git merge-tree` localmente. La revisión sí verificó directamente blobs/commits, diffs y logs oficiales del CI mediante el conector GitHub. El reporte diferencia **CI ejecutado por Actions**, **evidencia histórica del CC** y **E2E T-405 pendiente**.
