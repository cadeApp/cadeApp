# PR #737 — T-434 · Ajuste de fixtures E2E tras CC-050

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/737 |
| Tarea | T-434 / CC-050, seguimiento de #711 |
| Autor | @Lautaro073 |
| Rama | `fix/T-434-e2e-submitted-applicants` → `develop` |
| Base revisada | `632a04f585d4f3ed511a04c45b9407cfe95ec00a` |
| Head revisado | `a810fdbff53f1bbf43d304cef1af72258dc74625` |
| Tamaño | 2 archivos, +28 / -0 (spec: +7; bitácora: +21) |
| Ronda | 1 — 2026-11-12 |
| Resultado | **Sin bloqueantes ni mejoras demostradas en el diff; validación E2E del SHA pendiente** |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `a810fdbff53f1bbf43d304cef1af72258dc74625` | 0 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

**Datos estructurados:** [hallazgos.jsonl](hallazgos.jsonl) (vacío: ningún hallazgo demostrado). **Evidencia y arnés:** [evidencia/comandos.md](evidencia/comandos.md). **Lecciones:** [lecciones.md](lecciones.md).

## Estado y próximos pasos

1. El cambio de código conserva cada línea anterior de `courier-onboarding.spec.ts` y añade la finalización de la postulación antes de tres decisiones de admin.
2. Se observó el **RED real previo** en e2e-preview [43262434862](https://github.com/cadeApp/cadeApp/actions/runs/43262434862): fallan los tres casos en el estado sin envío. Se inspeccionaron el helper real y las aserciones preservadas.
3. El CI de `a810fdbff53f1bbf43d304cef1af72258dc74625` ([43273220950](https://github.com/cadeApp/cadeApp/actions/runs/43273220950)) tenía unit, typecheck, lint, build, audit y bundle-budget exitosos; `db-tests` seguía en progreso durante el corte de la revisión. El e2e-preview propio de `a810fdbff53f1bbf43d304cef1af72258dc74625` todavía **no había dado resultado**; no se lo certifica como verde.
4. **No interpretar esta ronda como autorización para mergear:** consultar el resultado E2E del SHA de código `a810fdbff53f1bbf43d304cef1af72258dc74625` y evaluar cualquier fallo atribuible a este diff. El commit documental de la revisión no exige por sí solo repetir un GREEN de código.
5. El 500 intermitente de `map-privacy.spec.ts:34` pertenece a [#478](https://github.com/cadeApp/cadeApp/issues/478) y está fuera del alcance de #737; T-376 pasó en retry en el RED anterior. No se alteraron esas pruebas ni se desactivó el gate.

La revisión no modifica código de la PR ni aprueba/mergea.
