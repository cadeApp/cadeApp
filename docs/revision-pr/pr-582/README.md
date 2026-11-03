# PR #582 — T-400 · Auditoría legible: motivos, nombres y etiquetas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/582 |
| **Tarea** | T-400 (Fase 4) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-400-audit-readable` → `develop` |
| **Base** | `f4bd475bdec8378fa819fc75388fc505b808bd25` |
| **SHA revisado (R2)** | `2764de210c4929ac2b5a6ea07357d441f1db3759` |
| **Tamaño** | 15 archivos, +793 / -54 líneas |
| **Estado** | **Ronda 2: CON BLOQUEANTES (1 nuevo)**; PR Draft, sin aprobar ni mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `9a25af62e93b65f04a384758327ce608d98d3e5c` | H01, H02 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `2764de210c4929ac2b5a6ea07357d441f1db3759` | H03 nuevo; H01/H02 con arreglos visibles | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR582-H01 | El recorte del motivo altera el dato auditado | medio | arreglado-sin-verificar (inspección + CI unit) |
| PR582-H02 | El catálogo dinámico no detecta ampliaciones de `p_action` | alto | arreglado-sin-verificar (inspección + CI unit) |
| PR582-H03 | Guard de `report_incident` acepta `return` inerte en comentarios/literales | alto | abierto |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Qué queda por hacer

1. H03: corregir la detección de la sentencia ejecutable `RETURN`, no palabras en comentarios/literales; demostrar RED de las tres mutaciones de la revisión.
2. Ronda 3: ejecutar controles independientes en entorno clonable; confirmar E2E oficial del SHA final y approval-policy en verde cuando corresponda. H01/H02 se ven corregidos, pero sin mutación runtime independiente sus estados conservadores son `arreglado-sin-verificar`.
3. La bitácora en `2764de21` ya registró E2E local 1 passed sobre `40197470`; el E2E oficial de `2764de21` aún debe quedar acreditado.

**Alcance:** 6 archivos de aplicación/bitácora cambiados entre R1 y R2, sin tocar la ficha ni `docs/revision-pr/**` por el autor.

## Limitaciones

Este entorno sigue sin resolver `github.com` para clonar y no dispone de pnpm. En R2 se ejecutaron **sondas de expresiones regulares en memoria con SQL real** a través del conector: control original y 4 mutaciones. No se corrió Vitest en el entorno del revisor. El CI **unit, build, lint, typecheck, audit y bundle-budget** del SHA `2764de21` estaba en verde al revisar; `db-tests` seguía en curso y `e2e-preview` estaba pendiente. `approval-policy` falló porque aún falta un informe `SIN BLOQUEANTES`, coherente con H03 abierto. No se pide rerun por un commit exclusivamente documental.
