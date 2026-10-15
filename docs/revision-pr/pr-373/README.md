# PR #373 — CC-026 · Reconciliación transaccional de expiraciones

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/373 |
| Contrato / Issue | CC-026 · #371 · @Lautaro073 |
| Tarea bloqueada | T-366 · #355 / PR #370 · @KiraK72 |
| Rama | `cc/CC-026-reconciliacion-expiraciones` → `develop` |
| Base | `687e2043817340b2951714cb6e7b179be2e3973a` |
| HEAD inspeccionado R3 | `f30193d6c633589390b22276cbc09a3bf7d31d2c` |
| Estado | Draft WIP, CON BLOQUEANTES; NO MERGEAR |

## Rondas

| Ronda | HEAD de código inspeccionado | Nuevos hallazgos | Informe |
|---|---|---|---|
| 1 | `eadaf545` | H01–H04 | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `f62a385` | H05–H10 | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `f30193d` | H11–H12, H04/H06/H09 pendientes | [ronda-3.md](revisiones/ronda-3.md) |

[Hallazgos y estados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Síntesis R3

- **H05**: SQL ahora revoca UPDATE de tabla a authenticated y concede únicamente columnas no operativas; primera parte de pgTAP prueba autorizaciones en verde (41 casos antes de error de test). **Todavía sin suite DB completa verde**, no cerrar.
- **H07/H08/H10**: limpieza FK ordenada, mock del endpoint cron y batches 200×5 por inspección; la suite unit ejecutó 2347/2347 aserciones verdes pero falla threshold global de cobertura.
- **H04**: documento master plan desalineado en límite exacto y fuera de alcance autorizado.
- **H06**: harness de concurrencia mejoró y tiene fail-fast, pero `.github/workflows/ci.yml` aún no lo ejecuta.
- **H09**: tipos SQL generados pendientes, typecheck/build rojos.
- **H11**: pgTAP aborta al invocar `like()` inexistente, no valida rollback forzado.
- **H12**: `src/domain/testing/rpc-fake.ts` cobertura de ramas 89,94 %, umbral 90 %.
- **Coordinación**: #355 de Kira fue restaurado a `bloqueada` tras encontrarse incorrectamente `en-curso`; CC-026 no ha pasado el gate.

## Pendiente antes de revisión final

Corregir H11/H12/H09; demostrar pruebas SQL del archivo entero y generación de tipos, implementar ejecución real de harness en CI mediante autorización de alcance y corregir `docs/master-plan.md` con alcance autorizado. La PR continúa explícitamente en Draft; no solicitar aprobación ni cerrar #371.
