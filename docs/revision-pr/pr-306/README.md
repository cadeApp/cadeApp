# PR #306 — T-351 · Ficha de accesibilidad del onboarding de documentos

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/306 |
| Issue | [#297](https://github.com/cadeApp/cadeApp/issues/297) |
| Autor | @Lautaro073 |
| Rama | `docs/T-351-ficha` → `develop` |
| SHA revisado (ronda 1) | `ef906b2ce719934f8b4082877c2355bef498d902` |
| Base | `0293fe381762f60bd47a7ba3b6f3152ee0f08bd8` |
| Diff original | 3 archivos documentales; +170/-0 |
| Resultado | **CON BLOQUEANTES (3), MEJORA (1)** |

## Rondas

| Ronda | SHA revisado | Dictamen | Informe |
|---|---|---|---|
| 1 | `ef906b2ce719934f8b4082877c2355bef498d902` | CON BLOQUEANTES (3) | [ronda-1](revisiones/ronda-1.md) |

## Hallazgos

| ID | Severidad | Estado | Tema |
|---|---|---|---|
| PR306-H01 | alto | abierto | E2E solo idle frente al contrato de todos los estados |
| PR306-H02 | medio | abierto | Precondición interna, no accesible, repetición de T-309/H02 |
| PR306-H03 | medio | abierto | RED fabricado al cambiar expectativa |
| PR306-H04 | bajo | abierto | Texto real success es «Cargado», no «Subido» |

Datos estructurados en [hallazgos.jsonl](hallazgos.jsonl); evidencia de la ronda en [comandos.md](evidencia/comandos.md); aprendizaje en [lecciones.md](lecciones.md).

## Por hacer

- Corregir únicamente `docs/tasks/T-351.md` y `docs/tasks/log/T-351.md` conforme al comentario de ronda 1.
- No implementar T-351 ni crear ramas E2E temporales durante la PR documental.
- El informe de revisión es independiente; no aprobar ni mergear hasta la ronda 2 y los checks requeridos.
