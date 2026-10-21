# PR #469 — CI-468 · Timeout de db-tests

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/469 |
| Incidencia | https://github.com/cadeApp/cadeApp/issues/468 |
| Identificador | `CI-468` (sin ficha `docs/tasks/T-468.md`; el formato `T-468` del informe es solo alias documental exigido por `approval-policy`) |
| Autor | @Lautaro073 |
| Rama | `fix/CI-468-db-tests-timeout` → `develop` |
| Base examinada | `127a900bf489dabf319a4f02046c959689487774` |
| HEAD funcional revisado | `c2a833dec6bcfe6bdd741cee3352886b67b42ce4` |
| Tamaño del cambio funcional | 2 archivos, +8/-1 |
| Resultado de revisión | **SIN BLOQUEANTES de código**, merge no habilitado por CI pendiente/rojo |

## Rondas

| Ronda | SHA funcional revisado | Hallazgos bloqueantes | Informe |
|---|---|---|---|
| 1 | `c2a833d` | 0 | [ronda-1.md](revisiones/ronda-1.md) |

## Condiciones pendientes de merge

- `audit` está rojo por GHSA de Vite que aborda la PR #467, aún abierta: fallo ajeno al diff de CI-468, pero bloquea el criterio de CI verde.
- `db-tests` y `e2e-preview` estaban en ejecución en la consulta del run `39525533747` y `39525594800`. No afirmar éxito sin el resultado sobre el SHA funcional revisado.
- `approval-policy` requiere informe con resultado sin bloqueantes en el cuerpo de la PR.
- El límite de 20 minutos no elimina la descarga lenta ni `toomanyrequests: Data limit exceeded` de imágenes; problema subyacente ya descrito en comentario de `ci.yml` como PR54-H02, fuera del alcance de este parche.
- Si GitHub exige nuevos checks para el commit exclusivamente documental de la revisión, distinguir de la validación funcional ya ejecutada; no inventar un verde.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).
