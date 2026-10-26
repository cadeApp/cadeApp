# PR #551 — T-415 · Repartidores conectados ahora

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/551 |
| Autor | Lautaro073 |
| Rama | `feat/T-415-online-couriers` → `develop` |
| Contrato | CC-041, aprobado en develop |
| Base | `9b348f9b41de7c4e74b08dcccfe4eb94b4262597` |
| Código ejecutado por la revisión | `a3f349817426a4d1940abea547e9d391da0d03b0` |
| HEAD documental inspeccionado | `6aee02867ec53717f7eb1749125cb863009d0c36`; solo agrega evidencia a la bitácora |
| Resultado R1 | **CON BLOQUEANTES (4)** |
| Decisiones pendientes | Ninguna: opción A aceptada por Lautaro073 el 2026-10-26 |

## Rondas

| Ronda | SHA de código | Resultado | Informe |
|---|---|---|---|
| 1 | `a3f349817426a4d1940abea547e9d391da0d03b0` | 4 bloqueantes; 1 desvío de alcance aceptado | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Estado |
|---|---|---|
| H01 | El fake cuenta consentimiento inactivo | Abierto |
| H02 | Las pruebas en vivo no ejercen el comportamiento completo | Abierto |
| H03 | pgTAP no discrimina renovación, estado y defensa RLS declaradas | Abierto; por inspección + CI verde |
| H04 | Lectura del parámetro y límites del formulario sin cobertura suficiente | Abierto |
| A01 | Autorizar `src/features/admin/schemas.ts` | Aceptado por decisión explícita; incluye paridad formulario/RPC en H04 |

## Verificación y límites

- Local en el SHA de código: typecheck y lint exit 0; 183 archivos/3390 pruebas Vitest, 81 pruebas de workflows y 6 de ADR en verde.
- Base por CI: job [121396514429](https://github.com/cadeApp/cadeApp/actions/runs/40268666030/job/121396514429), Files=40, Tests=3244, Result: PASS; tipos generados sin diferencias.
- Control de mutaciones: 84/84 antes y después; 3 mutaciones detectadas y 10 supervivientes en sus suites pertinentes.
- Sondas nuevas: dos casos RED del fake; observer 3/3 GREEN que detecta cinco mutaciones; lectura admin 49/49 GREEN y 1 RED al hardcodear 10.
- No se ejecutó Docker/Supabase local. Los mutantes SQL se proponen, no se presentan como ejecutados.
- No se validó CI global para aprobación: hay bloqueantes. La bitácora del autor registra un audit global de Zod pendiente, que esta ronda no resuelve ni silencia.
- E2E real pendiente después de migrate-develop. El spec existente no es evidencia de ejecución.
- `6aee02867ec53717f7eb1749125cb863009d0c36` cambia solo bitácora: no se pide nuevo CI verde por ese commit. El commit documental de cierre también moverá el HEAD; no transforma los hallazgos en corregidos.

## Continuidad

Al publicar llegó el arreglo del autor `2a5c1593ecabbeb613c4eb5d5f67c450b8e2b5a0`. El commit documental se agrega después de ese trabajo y no lo modifica. Ese arreglo no se ejecutó ni se certificó en esta ronda: los estados siguen abiertos hasta la ronda 2.

La revisión agrega únicamente esta carpeta. Lautaro073 indicó que ya comienza los cuatro arreglos: traer el commit documental con `git pull --no-rebase` antes de seguir; si hay cambios locales, guardarlos en un commit normal. No descartar trabajo ni reescribir historia.

[Datos estructurados](hallazgos.jsonl) · [Evidencia y arneses](evidencia/comandos.md) · [Lecciones](lecciones.md). El prompt completo está en la ronda y en el mismo comentario de cierre de GitHub.
