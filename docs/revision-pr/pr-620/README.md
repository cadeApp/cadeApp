# PR #620 — T-423 · Geocoding de direcciones

- PR: https://github.com/cadeApp/cadeApp/pull/620 · Rama `feat/T-423-map-geocoding` → `develop`.
- **Ronda 1:** [informe](revisiones/ronda-1.md), funcional `d8180d88e01088691b75f05a3a3be4d19d2d1b9a`: 5 bloqueantes y 1 mejora.
- **Ronda 2:** [informe](revisiones/ronda-2.md), funcional `9ec83512491515463beabf3627efc886b5068f83`: H01–H06 arreglados por inspección, H07–H08 abiertos.
- **Ronda 3:** [informe](revisiones/ronda-3.md), SHA funcional **`73590e4e4287b519028c9bb177d8dbc66dee75d8`**, posterior a `aa0fe12e`: **SIN NUEVOS BLOQUEANTES DE CÓDIGO POR INSPECCIÓN; NO APTO PARA MERGE POR CI BUILD FAILED Y E2E NO VERIFICADO**.
- Autor @Lautaro073 (agente). La carpeta la escribe exclusivamente la revisión; no se ejecutaron tests ni mutaciones propios, al no haber clon accesible en el entorno.

| ID | Estado R3 | Observación |
|---|---|---|
| PR620-H01 | arreglado-sin-verificar | A→null invalida petición |
| PR620-H02 | arreglado-sin-verificar | cleanup/cancelación de requests |
| PR620-H03 | arreglado-sin-verificar | consulta y pin consistentes |
| PR620-H04 | arreglado-sin-verificar | timeout de Google |
| PR620-H05 | arreglado-sin-verificar | query vacía terminal |
| PR620-H06 | arreglado-sin-verificar | ZERO_RESULTS robusto |
| PR620-H07 | arreglado-sin-verificar | A→B→A reintenta al volver |
| PR620-H08 | arreglado-sin-verificar | marcador visual vuelve al centro |

El estado `arreglado-sin-verificar` **no es** `arreglado-verificado`: la bitácora contiene RED→GREEN/mutaciones del agente y CI unitario verde, pero la revisión independiente no pudo repetirlas en runtime.

## Gates y decisión D09
- CI GitHub Actions sobre `73590e4e4287b519028c9bb177d8dbc66dee75d8`, run **42114705941**: `unit` **193/193 archivos y 3624/3624 tests**, `typecheck`, `lint`, `audit` success; `build` **failure** en `src/app/layout.tsx` por `next/font/google` Montserrat, tras reintentos (`TypeError: Cannot read properties of null (reading '1')`). El layout no se modificó en esta ronda; fallo aparentemente de descarga/parsing externo, **causa remota exacta no probada**. `bundle-budget` skipped por build fallido.
- `e2e-preview` **no tiene GREEN efectivo del SHA**; algunos workflows pueden terminar con conclusión `success` porque `e2e-preview` y `report-preview-status` quedaron **skipped**; esto no equivale a 2/2 tests E2E ejecutados.
- `approval-policy` falla mientras falta un informe sin bloqueantes (no se usa para ocultar build).
- **D09:** no modificar fuentes, tests ni workflow para disfrazar el error de fuentes; contrastar el CI automático del commit de revisión, y si persiste aislarlo y abrir tarea de infraestructura/fuentes autoalojadas fuera de T-423. El agente debe obtener build verde real y E2E real del SHA funcional que se quiera mergear.

[Hallazgos estructurados](hallazgos.jsonl) · [evidencia/comandos](evidencia/comandos.md) · [lecciones](lecciones.md).

**Checkpoint humano antes del rollout con direcciones reales:** issue [#619](https://github.com/cadeApp/cadeApp/issues/619) requiere revisión del aviso de privacidad versionado y validación legal. No confundir merge a develop con despliegue público.
