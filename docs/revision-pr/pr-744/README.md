# PR #744 — T-437 · CC-052 / B-05: documentos obligatorios verificados

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/744 |
| Tarea | T-437 (B-05), issue #670; CC-052 mergeado en #742 |
| Autor | @Lautaro073 |
| Rama | `feat/T-437-b05-verified-documents` → `develop` |
| Base de PR | `f0e217ac028633f22f52d74632f8615ceb886a7e` |
| SHA revisado | `e96473185354589b3820a345cc7a089127919afd` |
| Tamaño previo a esta ronda | 51 archivos, +2560/-44 líneas |
| Estado de R1 | **CON BLOQUEANTES (1)**; revisión independiente sin aprobación ni merge |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `e96473185354589b3820a345cc7a089127919afd` | 2 (1 bloqueante y 1 mejora) | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR744-H01 | El fake subsana un documento sin objeto en Storage | alto · bloqueante | abierto, por inspección |
| PR744-H02 | Estado de subsanación no se refleja en el resumen del perfil | medio · mejora | abierto, por inspección |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Qué queda por hacer

1. **Agente autor:** corregir H01 en `src/domain/testing/rpc-fake.ts` y los fixtures/tests de `src/domain/cc052-courier-verified-documents.test.ts`, demostrando RED→GREEN sin adulterar pruebas; resolver H02 y probar la consistencia del perfil sin debilitar el E2E.
2. **Revisión independiente:** ronda 2, verificar cambios en el SHA nuevo, ejecutar controles propios cuando exista clon utilizable; no usar `verificado_en_sha` retroactivo.
3. **Después del merge:** ejecutar E2E reales y `e2e-mutation` para `t437-ui-approve-guard`, `t437-ui-reactivate-guard` y `t437-ui-reconsider-guard` en Develop con migración CC-052 aplicada. Esto es una condición pendiente, **no una prueba verde**.

## Observaciones de integridad

- `CI 43515294798` fue verde sobre `55b5098`; `55b5098..e9647318` modifica únicamente `docs/tasks/log/T-437.md`. No se exige otro CI solo por la bitácora.
- `#745` (review-only, cerrada sin mergear) prueba la ausencia de las guardas SQL con 23/76 casos RED. Es evidencia reproducible del **autor** vista en Actions, no una mutación ejecutada por esta revisión.
- `e2e-preview` está BLOCKED/REQUIRES DEVELOP MIGRATION, como informa la PR. No se declaró verde.
- No hubo autorización para aprobar ni mergear. Las decisiones D1-A…D7-A ratificadas se mantuvieron; no surgió una nueva decisión de alcance.
