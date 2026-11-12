# PR #707 — T-433 · SEC-08: longitud de CRON_SECRET y secreto independiente para push

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/707 |
| Tarea / issue | T-433 / SEC-08 #666 |
| Autor | @Lautaro073 |
| Rama | `feat/T-433-sec08-cron-secret` → `develop` |
| Base | `395fdce5f034e2d7c630c2d9f0272ee018477f3a` |
| Head auditado | `cdd964438d8f4ed726fa0f2eeaad3ee28621b1bf` |
| Alcance | 3 archivos documentales, +148/-0 líneas; sin CC |
| Estado | **Ronda 1: CON BLOQUEANTES (1 documental)**; no aprobar ni mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `cdd9644` | 1 bloqueante, 3 mejoras | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR707-H01 | Procedimiento de CRON_SECRET no verifica secrets efectivos de GitHub por environment | alto (bloqueante documental) | abierto |
| PR707-H02 | Justificación de D1-C atribuye una ruta a CC-040 que no aparece allí | bajo (mejora) | abierto |
| PR707-H03 | Falta indicar generación criptográficamente aleatoria de secretos | medio (mejora) | abierto |
| PR707-H04 | La ficha afirma que serverEnv rompe necesariamente todas las rutas | bajo (mejora) | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md).

## Qué queda por hacer

1. Corregir H01 en la ficha y actualizar la bitácora; incluir verificación independiente de los secretos efectivos en GitHub Actions (desarrollo, staging y producción), prioridad environment > repositorio y sincronización/validación de la autenticación de health-cron, sin exponer valores.
2. Aplicar H02–H04 al mismo documento, sin alterar D1-A/D2-A/D3-A ni ampliar alcance.
3. Revisión independiente Ronda 2 del nuevo SHA y su evidencia. **No hay decisiones nuevas de Lautaro073 abiertas en esta ronda.**
4. La comprobación real de secrets por ambiente corresponde a Lautaro073 **antes del merge de la futura PR de implementación o antes de cada promoción**, no al agente revisor ni a la PR documental.

## Alcance de la revisión

Lectura del protocolo, diff, ficha nueva, bitácora, contrato CC-040, antecedente T-203, código base y wiring de cuatro workflows. Control documental independiente en memoria con corrección simulada y cuatro mutaciones RED. Sin clon local por fallo de DNS a github.com; no se ejecutaron pnpm/Vitest, CI, E2E, git merge-tree, ni comandos contra servicios remotos. El 123/123 de herramientas es afirmación del autor, no ejecución de esta revisión. GitHub reportó `mergeable: true`; esto no sustituye `git merge-tree`.

La carpeta es exclusiva de revisión. No se modificaron código, workflows, secretos ni configuración del repositorio.
