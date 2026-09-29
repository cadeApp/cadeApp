# Revisión PR #122 — T-205

> La revisión anterior descartada sigue fuera de vigencia. La revisión válida comenzó en `5ff06783...`; esta es su **Ronda 3** sobre el HEAD `fc010850...`.

- **PR:** #122 — `[T-205] Pasada de accesibilidad y rendimiento en las pantallas de comercio y repartidor`
- **Rama:** `feat/T-205-accesibilidad-rendimiento`
- **Base:** `develop@ae514947a467de4bd2f4e8deb96aff542a3e79c3`
- **SHA funcional revisado:** `fc0108503a630746ffa05fa463603e3bd88f175f`
- **Ronda vigente:** 3
- **Resultado:** **CON BLOQUEANTES**
- **PR:** abierta, no Draft, 0 behind / 8 ahead.
- **CI final:** no se usa todavía como criterio de cierre porque el DoD runtime continúa abierto.
- **Ejecución local independiente:** no disponible; no se atribuyen tests/Lighthouse/axe no ejecutados por el revisor.

## Estado

- `PR122-H01` — arreglado sin verificar runtime independiente.
- `PR122-H02` — arreglado sin verificar runtime independiente.
- `PR122-H03` — parcial y bloqueante: axe/Lighthouse siguen pendientes y la nueva evidencia browser tiene un falso verde de overflow.
- `PR122-H04` — arreglado sin verificar runtime.
- `PR122-R01` — arreglado sin verificar runtime: ficha restaurada literalmente.
- `PR122-R02` — arreglado sin verificar runtime: non-null assertions retiradas.
- `PR122-R03` — **nuevo bloqueante**: la auditoría declara “Sin overflow” pero las 14 PNG T-205 muestran contenido cortado por el borde derecho; el control `scrollWidth <= innerWidth` no alcanza para demostrar ausencia de clipping, especialmente con `body { overflow-x: hidden }`.

Detalle: `revisiones/ronda-3.md`. Evidencia y reproducción: `evidencia/comandos.md`.
