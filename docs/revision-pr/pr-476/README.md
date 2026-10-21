# PR #476 — T-389 · Reportar incidente visible y ETA de 5 minutos

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/476 |
| **Tarea** | T-389 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-389-trip-report-eta` → `develop` |
| **Base cotejada** | `214404e0a2baca7ba7e4c87c35ef78c3de3d2109` |
| **Código funcional revisado** | `2fe4935d233a0ade030f8adc1072304571e9a5d2` |
| **Último SHA de autor revisado** | `0dd703d81b27eda5ccddf50fd4afda69584bf36f` |
| **Resultado ronda 2** | **H01 parcial. Sin bug funcional demostrado; gate oficial aún rojo por cancelación. No mergear.** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `2fe4935d233a0ade030f8adc1072304571e9a5d2` | H01 abierto | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `0dd703d81b27eda5ccddf50fd4afda69584bf36f` | H01 parcial, pendiente gate | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR476-H01 | Evidencia E2E de T-389 mejorada; gate oficial de Preview no verificado en verde | medio · bloqueo de DoD | **parcial** |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl). Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md).

## Decisión de Lautaro073: C (2026-10-21)

- Reconocer **solo como declaración de ejecución del autor** el `Flujo 5` local en verde y la prueba de no-superposición del botón.
- No modificar la lógica de T-389 ni perseguir una regresión inexistente por una cancelación del gate.
- Seguir T-360/login flaky y la cancelación del E2E oficial, **sin presuponer causa común**, en el [issue QA #479](https://github.com/cadeApp/cadeApp/issues/479).
- **Mantener como condición de merge el `e2e-preview=success` real del SHA relevante**, puesto que la ficha de T-389 así lo exige y no se aprobó una excepción a ese DoD.
- `approval-policy` también seguirá rojo mientras la revisión mantenga el bloqueo; no falsificar aprobación, ni aprobar ni mergear desde la revisión.

## Pendiente concreto

Un **run oficial concluyente**, donde el job `e2e-preview` efectivamente ejecute Chromium (y `global-settings`) sobre el SHA correcto y publique `success`; no valen workflows «success» con job E2E `skipped`. La evidencia local resumida no prueba por sí sola el gate completo. En caso de falla real, registrar su etapa y reproducir sin debilitar test, mocks o aserciones.

## Limitación independiente

Ronda 2: inspección de commit, código, bitácora y checks remotos. No hubo clon local disponible, ni trazas originales de las ejecuciones **locales** del autor; no se ejecutaron pruebas o mutaciones nuevas y ningún `verificado_en_sha` se atribuye a ellas. No se tocaron scripts de producción ni tests.
