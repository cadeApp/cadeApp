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
| Estado | **Ronda 2: SIN BLOQUEANTES DOCUMENTALES**, CI cancelado; no aprobar ni mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `cdd9644` | 1 bloqueante, 3 mejoras | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `6f5a142c` | H01–H04 verificados documentalmente | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR707-H01 | Procedimiento de CRON_SECRET no verifica secrets efectivos de GitHub por environment | alto (bloqueante documental) | arreglado-verificado (documental R2) |
| PR707-H02 | Justificación de D1-C atribuye una ruta a CC-040 que no aparece allí | bajo (mejora) | arreglado-verificado (documental R2) |
| PR707-H03 | Falta indicar generación criptográficamente aleatoria de secretos | medio (mejora) | arreglado-verificado (documental R2) |
| PR707-H04 | La ficha afirma que serverEnv rompe necesariamente todas las rutas | bajo (mejora) | arreglado-verificado (documental R2) |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md).

## Qué queda por hacer

1. H01–H04 cerrados documentalmente en Ronda 2; no hay decisiones nuevas.
2. CI oficial de esta PR cancelado sin jobs: si la política de merge exige CI positivo, Lautaro073 debe investigar/reintentar antes de fusionar. No pedir otro CI exclusivamente por el informe de revisión.
3. Implementación SEC-08 en otra PR después del merge documental, con tests RED/GREEN de runtime y revisión independiente.
4. Antes del merge de la implementación y las promociones, Lautaro073 registra en [#666](https://github.com/cadeApp/cadeApp/issues/666) la verificación manual por ambiente sin divulgar secrets.

## Alcance de Ronda 2

Auditor documental independiente RED (SHA original) / GREEN (SHA corregido) / seis mutaciones RED. CI `cancelled` sin jobs, 123/123 solo en bitácora del autor, sin clone por DNS. Se actualizó mínimamente el cuerpo del PR, sin mover el SHA. El protocolo prohíbe que el revisor apruebe, mergee o acceda a secrets.

## Alcance de la revisión

Lectura del protocolo, diff, ficha nueva, bitácora, contrato CC-040, antecedente T-203, código base y wiring de cuatro workflows. Control documental independiente en memoria con corrección simulada y cuatro mutaciones RED. Sin clon local por fallo de DNS a github.com; no se ejecutaron pnpm/Vitest, CI, E2E, git merge-tree, ni comandos contra servicios remotos. El 123/123 de herramientas es afirmación del autor, no ejecución de esta revisión. GitHub reportó `mergeable: true`; esto no sustituye `git merge-tree`.

La carpeta es exclusiva de revisión. No se modificaron código, workflows, secretos ni configuración del repositorio.
