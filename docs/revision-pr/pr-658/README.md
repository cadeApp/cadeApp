# PR #658 — T-408 · CC-047 · Endurecimiento administrativo

| Dato | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/658 |
| Tarea | T-408 · Fase 4; contrato `docs/contracts/CC-047.md` mergeado en #657 |
| Autor | @Lautaro073 |
| Rama | `feat/T-408-admin-hardening` → `develop` |
| Base de contraste | `fd86f9b2a25b39607e2719e76ad1821f84f44eef` |
| SHA de código R1 | `3a396ee1258b39c6c6e111f157399fccdb8ae42f` |
| SHA de código R2 | `511940aaa6df0bde2075d7b6bd07bf0a47e5f50c` |
| SHA bitácora R2 | `e8a002a808a22fc95c310489f70db32f64afbf53` (no cambia código) |
| Estado | **R2: CON BLOQUEANTES (1 nuevo de cobertura), sin aprobación ni merge** |

## Rondas

| Ronda | SHA revisado | Estado | Informe |
|---|---|---|---|
| 1 | `3a396ee1` | 6 hallazgos abiertos; D01=B, D02=A decididas | [R1](revisiones/ronda-1.md) |
| 2 | `511940aa` | H01–H06 resueltos, H07 nuevo abierto | [R2](revisiones/ronda-2.md) |

## Hallazgos

| ID | Severidad | Resumen | Estado después de R2 |
|---|---|---|---|
| PR658-H01 | medio | rate_limits SELECT admin → USING(false) | **arreglado-verificado** (inspección estática propia + CI) |
| PR658-H02 | alto | Test de catálogo de policies no-SELECT con is_admin | **arreglado-verificado** |
| PR658-H03 | alto | Storage INSERT/UPDATE/DELETE | **arreglado-verificado** |
| PR658-H04 | alto | Concurrencia D1 admin/admin y audit.before | **arreglado-verificado** |
| PR658-H05 | medio | D3 aal1/aal2 + positivos | **arreglado-verificado** |
| PR658-H06 | medio | Tres historias de notas + consulta candidatos | **arreglado-verificado** (ausencia de backfill: inspección) |
| PR658-H07 | **medio** | Exclusividad de RPC en rate_limits: INSERT cliente y policy de escritura genérica escapan tests | **abierto, bloqueante de cobertura** |

## Evidencia validada

- [GREEN 42443782479](https://github.com/cadeApp/cadeApp/actions/runs/42443782479), SHA `511940aa`: pgTAP **Files=44 Tests=3676 Result: PASS**, cc047 **92/92**, escenarios D/E GREEN; unit **199 archivos/3755 tests**, typecheck, lint, build, audit, bundle PASS y drift de `database.types.ts` superado.
- PR de mutaciones del autor [#660](https://github.com/cadeApp/cadeApp/pull/660) (pgTAP 11/92 rojos y rpc_admin 1/111), [#661](https://github.com/cadeApp/cadeApp/pull/661) (D RED por before) y [#662](https://github.com/cadeApp/cadeApp/pull/662) (E RED por before): cerradas sin mergear; ver informe R2.
- Inspección independiente con batería propia de seis controles estáticos: base 6/6 GREEN, seis alteraciones independientes 6/6 detectadas en RED **estático**, y mutación teórica H07 que escapa a la cobertura por inspección. No es una ejecución propia de PostgreSQL.
- El archivo de [comandos y evidencia](evidencia/comandos.md) conserva R1 íntegra y agrega R2. [Hallazgos estructurados](hallazgos.jsonl) · [Lecciones](lecciones.md).

## Decisiones y acciones pendientes

- D01=B y D02=A quedaron resueltas en R1; no se reabren.
- El autor corrige **solo H07 en pgTAP**, demuestra mutación RED y GREEN y vuelve a pedir ronda 3. No tocar código productivo salvo que se descubra un defecto adicional probado.
- **Humano, cada ambiente:** Lautaro073 debe ejecutar y resolver la consulta de candidatos de `merchants.notes` de CC-047 `6, documentando resultado sin texto sensible, antes de promover.
- **Tras merge:** aplicar migración a Develop, validar tipos y E2E del panel admin con `aal2` en staging antes de producción. El E2E post-merge automático en Develop no está implementado según `docs/runbooks/e2e-preview.md:153`. No autorizar merge desde esta revisión.

> R2 no modifica el archivo [ronda 1](revisiones/ronda-1.md), que sigue siendo histórico del estado R1.