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
| Estado | **CON BLOQUEANTE DOCUMENTAL (1); sin bloqueantes funcionales identificados** |

## Rondas
| Ronda | SHA de código inspeccionado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `a3c88ee3` | H01, documental | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos
- **PR337-H01 (MEDIO, BLOQUEANTE DE PROCESO):** falta constancia de la implementación y su evidencia real en `docs/tasks/log/T-340.md` de la rama PR. El body de la PR sí explica los cambios, pero la bitácora de su HEAD no incluye esta sesión. Estado: **abierto**.
- No se encontraron bloqueantes de lógica de conteos ni seguridad por inspección y cotejo de CI.
- Postmerge: verificar migración y visita `/admin/merchants` como admin AAL2 en staging. **No acreditado aún** y no se exige antes de merge.

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl). Comprobaciones: [evidencia/comandos.md](evidencia/comandos.md). Lecciones: [lecciones.md](lecciones.md).

## Para cerrar
1. El autor debe añadir entrada nueva en la bitácora con **hecho / pruebas / falta / SHA**, sin atribuirse revisión independiente ni falsificar ejecución. No editar `docs/revision-pr/**`.
2. Nueva ronda debe comprobar el SHA documental y el estado de CI. No interpretar el commit de esta revisión como revalidación de un HEAD funcional distinto.
3. Publicar el dictamen SIN BLOQUEANTES solamente cuando H01 esté subsanado. No aprobar/mergear sin instrucción explícita de Lautaro073.
