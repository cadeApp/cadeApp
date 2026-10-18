# PR #403 — T-367 · Avatar aprobado del repartidor

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/403 |
| Autor del código | asako669 |
| Rama | `feat/T-367-avatar-perfil` → `develop` |
| Estado | **CON BLOQUEANTES — no mergear** |
| SHA revisado R3 | `aa7903bc35bec39a9b711194a29670a5b7ea2c68` |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `d1af180b` | 4 bloqueantes, incidencia de proceso, mejora | [R1](revisiones/ronda-1.md) |
| 2 | `97fc11a6` | H07 nueva regresión E2E, H05 residual | [R2](revisiones/ronda-2.md) |
| 3 | `aa7903bc35bec39a9b711194a29670a5b7ea2c68` | **1 bloqueante (H08)**, E2E Preview sin verde | [R3](revisiones/ronda-3.md) |

## Estado de hallazgos

| ID | Estado R3 | Resumen |
|---|---|---|
| H01 | arreglado-sin-verificar | Guard de ruta canónica |
| H02 | parcial | Prueba de imagen y cross-user ampliada; H08 la debilita para fallback |
| H03 | arreglado-sin-verificar | Eliminar `any` de mocks |
| H04 | arreglado-sin-verificar | Autorrevisión archivada y carpeta preservada |
| H05 | arreglado-sin-verificar | Mutación visual informada por autor, pendiente de verificación independiente |
| H06 | arreglado-sin-verificar | `is_current=true` antes de `limit(1)` |
| H07 | arreglado-sin-verificar | Contextos separados de navegador; falta verde remoto |
| H08 | **abierto, bloqueante** | Ícono de barra inferior satisface falsamente prueba del fallback |

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia/comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Continuación

El agy debe pullear la revisión, corregir **solo H08** en 3 archivos más bitácora y dejar `docs/revision-pr/**` en manos de la revisión independiente. CI/E2E del SHA siguiente y revisión R4 antes de aprobación/merge. Comprobación humana en staging tras promoción.
