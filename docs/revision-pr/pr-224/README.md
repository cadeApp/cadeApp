# PR #224 — T-308 · E2E de incidentes y suspensión cautelar

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/224 |
| **Tarea** | T-308 · Issue #40 |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-308-incidents-e2e` → `develop` |
| **SHA funcional revisado R4** | `593c2b845fa30f7e43666d993f27679f53d8560b` |
| **develop al revisar R4** | `1cd3da01b3af9619e4a19107ba5e8354a18c2159` |
| **Estado** | Draft · CON 4 BLOQUEANTES · behind=4 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `9c2a5f3447f0b8e3c4c215cda0846088e75b8507` | 4 bloqueantes + behind=49 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `4370ddc741bd8be21e7ab5b93add6b9455034ed9` | H01/H02 verificados; H03 sin verificar; H04 parcial; H05 nuevo; behind=5 | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `cc3813f05d110c9248f5186decf0fe941f39880a` | H05 corregido; H03/H05 sin runtime; H04 pendiente por rate limit; behind=0 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `593c2b845fa30f7e43666d993f27679f53d8560b` | Preview disponible; DoD1 avanza hasta validación del relato; H06 nuevo; CI normal GREEN; behind=4 | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Hallazgos

| ID | Sev. | Estado | Resumen |
|---|---:|---|---|
| PR224-H01 | alto | arreglado-verificado | Bootstrap admin+AAL2 comprobado en gate real. |
| PR224-H02 | alto | arreglado-verificado | Matched canónico comprobado en gate real. |
| PR224-H03 | medio | arreglado-sin-verificar · bloqueante | MFA corregido, pero DoD1 todavía no llega a ese tramo. |
| PR224-H04 | alto | parcial · bloqueante | Gate real disponible, pero sigue RED; faltan M1–M4 y GREEN final. |
| PR224-H05 | medio | arreglado-sin-verificar · bloqueante | Selectores corregidos; runtime ya superó radio y descripción, pero aún no llega a confirmación/bandeja. |
| PR224-H06 | medio | abierto · bloqueante | El relato E2E incrusta `testRunId` con 13 dígitos y viola CC-012; el formulario lo rechaza como dato de contacto. |

## R4 — ejecución real

Commit `593c2b8`:

```text
Vercel      success
CI          success
e2e-preview failure
run         37334483825
23 passed
1 failed
```

Único fallo:

```text
DoD 1: El reporte llega a la bandeja de administración
incidents.spec.ts:77
getByText(/recibimos tu reporte/i)
element(s) not found
```

El artefacto de Playwright muestra la causa anterior al submit:

```text
textbox:
"Incidente E2E e2e_1791215...: El repartidor tuvo un problema con el cobro acordado."

alert:
"Sacá los teléfonos o correos del relato: no se pueden compartir datos de contacto."
```

CC-012 considera teléfono cualquier secuencia de **7 o más dígitos**. `testRunId` contiene una secuencia larga de dígitos, por lo que la validación del propio producto bloquea el envío.

Esto demuestra que H05 mejoró: el gate ya supera los selectores de tipo y descripción. No demuestra aún la confirmación ni la bandeja admin.

## Sincronización

Mientras corría el Preview, `develop` avanzó cuatro commits hasta `1cd3da0`. Entre ellos T-336 cambia auth/guards y middleware, por lo que la siguiente reparación debe volver a integrar develop antes de intentar cerrar H03.

**No mergear todavía.**
