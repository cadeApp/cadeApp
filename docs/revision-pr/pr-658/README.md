# PR #658 — T-408 · CC-047 · Endurecimiento administrativo

| Dato | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/658 |
| Tarea / dueño | T-408 · Fase 4 · P1 @Lautaro073 |
| Contrato aprobado | `docs/contracts/CC-047.md`, mergeado en #657 |
| Rama | `feat/T-408-admin-hardening` → `develop` |
| Base examinada | `fd86f9b2a25b39607e2719e76ad1821f84f44eef` |
| Código R1 | `3a396ee1258b39c6c6e111f157399fccdb8ae42f` |
| Código R2 | `511940aaa6df0bde2075d7b6bd07bf0a47e5f50c` |
| Código R3 | `0fd186af738fd3bf993c79f97cd09bf5c34ea4be` |
| Bitácora posterior a código R3 | `5f3512aede017bfcdf651de57b43e8e14119d200` (solo docs) |
| Estado revisión | **R3: SIN BLOQUEANTES DE CÓDIGO · H01–H07 cerrados (7/7)** |
| Estado PR al cierre | Abierta, Draft, **sin aprobar ni mergear** |

## Rondas

| Ronda | SHA funcional | Resultado | Informe |
|---|---|---|---|
| 1 | `3a396ee1` | 6 bloqueantes · D01=B, D02=A resueltas | [R1](revisiones/ronda-1.md) |
| 2 | `511940aa` | H01–H06 corregidos; H07 nuevo de cobertura | [R2](revisiones/ronda-2.md) |
| 3 | `0fd186af` | **H07 arreglado-verificado; 0 bloqueantes de código** | [R3](revisiones/ronda-3.md) |

## Estado de los hallazgos

| ID | Severidad | Síntesis | Estado |
|---|---|---|---|
| PR658-H01 | medio | rate_limits: policy SELECT denegada | arreglado-verificado, R2 |
| PR658-H02 | alto | Catálogo RLS de policies admin DML | arreglado-verificado, R2 |
| PR658-H03 | alto | Storage courier-docs sin escrituras directas | arreglado-verificado, R2 |
| PR658-H04 | alto | Locks D1 y audit.before bajo concurrencia real | arreglado-verificado, R2 |
| PR658-H05 | medio | D3 por AAL y columna, positivos propios | arreglado-verificado, R2 |
| PR658-H06 | medio | Notas internas y ausencia de backfill | arreglado-verificado, R2 (backfill: inspección SQL) |
| **PR658-H07** | medio | **rate_limits sin policies DML genéricas e INSERT denegado** | **arreglado-verificado, R3** |

## Evidencia R3

- [Run 42446531770](https://github.com/cadeApp/cadeApp/actions/runs/42446531770) · SHA `0fd186af`: CI success, `db-tests Files=44, Tests=3683, Result: PASS`, `cc047` 99/99; Vitest 199 archivos/3755 tests; typecheck, lint, build, audit y budget PASS; concurrencias D/E verdes. Drift de tipos PASS.
- [PR mutante #663](https://github.com/cadeApp/cadeApp/pull/663) · SHA `35de0dd2` · [run 42446535180](https://github.com/cadeApp/cadeApp/actions/runs/42446535180): cerrada sin mergear, solo policy `rate_limits_insert_any WITH CHECK(true)`; `cc047 Failed 7/99` (6–12). Catálogo detectó 1 policy; tres INSERT devolvieron 00000 (esperaba 42501) y dejaron filas. **Hay grant INSERT a authenticated**; sin policy de DML el control efectivo es RLS.
- Verificación propia **estática**: en textos GitHub por SHA, baseline una policy SELECT y cero DML, mutante una SELECT y una INSERT; 10 comprobaciones verdaderas, tests idénticos entre ramas. [Comandos, logs y límites](evidencia/comandos.md).
- [Hallazgos estructurados](hallazgos.jsonl) · [Lecciones](lecciones.md) · [Informe R3](revisiones/ronda-3.md).

## Gates operativos pendientes, NO hallazgos de código

1. **Por ambiente y antes de promover:** Lautaro073 ejecuta personalmente la consulta de candidatos de `merchants.notes` en CC-047 `6, resuelve todos los candidatos y registra ambiente/fecha/SHA/cantidad/IDs, **sin texto de notas**. No promover con candidatos pendientes.
2. **Después del merge:** `migrate-develop` aplica migración y valida drift; luego E2E completo del panel admin con `aal2` en staging antes de producción. `e2e-preview` en el SHA de código tiene estado `error BLOCKED / REQUIRES DEVELOP MIGRATION`, previsto por [runbook](../../runbooks/e2e-preview.md) (E2E post-merge automático sobre Develop no implementado).

**Esta revisión declara 0 bloqueantes de código, pero no aprueba, mergea ni libera producción.** Esas decisiones y acciones siguen siendo de Lautaro073.
