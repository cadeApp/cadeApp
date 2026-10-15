# Revisión independiente PR #337 — fix(admin) / Issue #336 (relacionado con T-340)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/337 |
| Incidencia | #336: /admin/merchants denegado tras CC-023 |
| Tarea relacionada | T-340; no es el Gate 4 ni cierra #258 |
| Autor | Lautaro073 |
| Rama | `fix/admin-merchants-count` → `develop` |
| HEAD de código inspeccionado | `a3c88ee3591b5ca6d5461dce5e96d21912941e5d` |
| Base comprobada | `fbb6e5052a6473a0f7063e60a711b4fa452835f3` |
| Alcance | 5 archivos, +492/-17 líneas |
| Estado | **SIN BLOQUEANTES — Ronda 2; pendiente merge autorizado y validación posterior de staging** |

## Rondas
| Ronda | SHA de código inspeccionado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `a3c88ee3` | H01, documental | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `82989c0f` | H01 arreglado-verificado; 0 bloqueantes | [ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos
- **PR337-H01 (MEDIO, BLOQUEANTE DE PROCESO):** falta constancia de la implementación y su evidencia real en `docs/tasks/log/T-340.md` de la rama PR. El body de la PR sí explica los cambios, pero la bitácora de su HEAD no incluye esta sesión. Estado: **arreglado-verificado** en `82989c0f`.
- No se encontraron bloqueantes de lógica de conteos ni seguridad por inspección y cotejo de CI.
- Postmerge: verificar migración y visita `/admin/merchants` como admin AAL2 en staging. **No acreditado aún** y no se exige antes de merge.

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl). Comprobaciones: [evidencia/comandos.md](evidencia/comandos.md). Lecciones: [lecciones.md](lecciones.md).

## Para cerrar
1. **Listo para decisión de merge de Lautaro073** desde el punto de vista de la revisión independiente R2. No aprobado ni mergeado por la revisión.
2. Issue #336 sigue abierto: después del merge autorizado, verificar migraciones, despliegue y acceso real `/admin/merchants` como admin AAL2 en staging; no se han realizado.
3. Actualizar el informe R2 en el cuerpo de la PR para que `approval-policy` evalúe un resultado legítimo `SIN BLOQUEANTES`; no debilitar el workflow.

