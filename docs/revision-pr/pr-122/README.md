# Revisión PR #122 — T-205

> La revisión descartada original sigue fuera de vigencia. La revisión válida comenzó en `5ff06783...`; esta es su **Ronda 4** sobre el HEAD `732a9bdc...`.

- **PR:** #122 — `[T-205] Pasada de accesibilidad y rendimiento en las pantallas de comercio y repartidor`
- **Rama:** `feat/T-205-accesibilidad-rendimiento`
- **Base:** `develop@ae514947a467de4bd2f4e8deb96aff542a3e79c3`
- **SHA funcional revisado:** `5915ad4e66457fd83103518bcf5ef41de4da5273`
- **HEAD revisado:** `732a9bdc16ef495920c0a6c55920aa3ae427aca4`
- **Ronda vigente:** 4
- **Resultado:** **CON BLOQUEANTES**
- **PR:** abierta, no Draft, 0 behind / 11 ahead.
- **CI final:** no se usa todavía como criterio de cierre porque H03 continúa abierto.
- **Ejecución local independiente:** no disponible; no se atribuyen tests/Lighthouse/axe no ejecutados por el revisor.

## Estado

- `PR122-H01` — arreglado sin verificar runtime independiente.
- `PR122-H02` — arreglado sin verificar runtime independiente.
- `PR122-H03` — parcial y bloqueante: Lighthouse y axe siguen pendientes; la evidencia browser todavía no es reproducible.
- `PR122-H04` — arreglado.
- `PR122-R01` — arreglado.
- `PR122-R02` — arreglado.
- `PR122-R03` — **parcial**: las nuevas 14 PNG ya no muestran clipping visible, pero el mecanismo de auditoría declarado no quedó versionado/reproducible.
- `PR122-R04` — **nuevo bloqueante**: la bitácora declara un harness `src/features/requests/evidence/browser-audit.test.tsx` que no existe en el HEAD; además las capturas de onboarding incluyen una barra de progreso extra que no forma parte del árbol real de las rutas, por lo que no demuestran que se capturó exactamente la aplicación canónica.

Detalle: `revisiones/ronda-4.md`. Evidencia: `evidencia/comandos.md`.
