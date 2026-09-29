# Revisión PR #122 — T-205

> La revisión descartada original sigue fuera de vigencia. La revisión válida comenzó en `5ff06783...`; esta es su **Ronda 5** sobre el HEAD `bae8c771...`.

- **PR:** #122 — `[T-205] Pasada de accesibilidad y rendimiento en las pantallas de comercio y repartidor`
- **Rama:** `feat/T-205-accesibilidad-rendimiento`
- **Base:** `develop@ae514947a467de4bd2f4e8deb96aff542a3e79c3`
- **SHA funcional revisado:** `f182000...`
- **HEAD revisado:** `bae8c771e2a42c20a45764cc984fefb5265de160`
- **Ronda vigente:** 5
- **Resultado:** **CON BLOQUEANTES**
- **PR:** abierta, no Draft, 0 behind.
- **CI final:** no se consulta todavía como criterio de cierre porque H03 y los nuevos bloqueantes siguen abiertos.
- **Ejecución local independiente:** no disponible; no se atribuyen tests/Lighthouse/axe no ejecutados por el revisor.

## Estado

- `PR122-H01` — arreglado sin verificar runtime independiente.
- `PR122-H02` — arreglado sin verificar runtime independiente.
- `PR122-H03` — parcial y bloqueante: Lighthouse y axe siguen pendientes; browser integrado no está cerrado.
- `PR122-H04` — arreglado.
- `PR122-R01` — arreglado.
- `PR122-R02` — arreglado.
- `PR122-R03` — parcial: las PNG ya no muestran clipping.
- `PR122-R04` — parcial: el harness ahora existe, pero no representa exactamente las rutas canónicas.
- `PR122-R05` — **nuevo bloqueante:** CSS compilado con hash fijo y fallback silencioso a CSS vacío; el harness puede quedar verde sin estilos.
- `PR122-R06` — **nuevo bloqueante:** el harness sigue recreando manualmente layouts/rutas y omite piezas reales, por lo que no puede llamarse auditoría canónica de ruta.
- `PR122-R07` — **nuevo bloqueante:** se amplió la API pública de `courier-onboarding/index.ts` con exports estáticos solo para el harness; eso modifica el grafo de producción y la evidencia de bundle mostrada no fue re-medida después del cambio.

Detalle: `revisiones/ronda-5.md`. Evidencia: `evidencia/comandos.md`.
