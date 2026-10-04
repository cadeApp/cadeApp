# PR #242 — T-325 hotfix · Feed pending con documentos reales

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/242 |
| **Tarea** | T-325 hotfix · issue #241 |
| **Autor** | @Lautaro073 |
| **Rama** | `fix/T-325-feed-real-documents` → `develop` |
| **Base revisada** | `b4119ef3e16170decda0a1649fc35db207faa8b0` |
| **SHA funcional R2** | `3c469698bd551cd42022b3388562b935431e2999` |
| **Estado** | **Ronda 2 · CON BLOQUEANTE RESIDUAL (1)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ddf7f5991257f98b2371f8f51659ea9d6e6d1c87` | 3 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `3c469698bd551cd42022b3388562b935431e2999` | H01/H02/H03 cerrados; H04 abierto | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR242-H01 | Los tests no cubrían el cableado page → courier_documents | alto | arreglado-verificado |
| PR242-H02 | StatusView dejaba un CTA circular dentro del feed | medio | arreglado-verificado |
| PR242-H03 | authError se degradaba a documents=[] | medio | arreglado-verificado |
| PR242-H04 | La entrega no cerró bitácora/evidencia del SHA corregido | medio | abierto |

## Verificación R2

- CI #1076 del SHA `3c469698bd551cd42022b3388562b935431e2999`: success.
- Unit/coverage: **117 archivos · 1781/1781 tests**.
- `page.test.tsx`: **3/3**.
- Build: `/courier/feed` **159 kB** First Load JS (presupuesto 180 kB).
- Vercel: success.
- E2E Preview publicó success sobre `TARGET_SHA=3c469698bd551cd42022b3388562b935431e2999`.
- E2E tuvo 1 flaky ajeno a T-325 (T-303 Flujo 5, login); registrado como issue #245.

## Residual

No hay arreglo de producto pendiente. Falta cerrar la **entrega**:

1. entrada append-only de Ronda 1/2 del hotfix en `docs/tasks/log/T-325.md`;
2. evidencia de navegador del Preview ya disponible, con un courier pending real;
3. actualizar README de evidencia, DoD del hotfix y cuerpo del PR con el SHA/checks actuales.

No aprobar ni mergear hasta cerrar H04.
