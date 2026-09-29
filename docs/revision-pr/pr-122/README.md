# Revisión PR #122 — T-205

> La revisión anterior descartada sigue fuera de vigencia. La revisión válida comenzó en `5ff06783...`; esta es su **Ronda 2** sobre el arreglo `2e3d6eda...`.

- **PR:** #122 — `[T-205] Pasada de accesibilidad y rendimiento en las pantallas de comercio y repartidor`
- **Rama:** `feat/T-205-accesibilidad-rendimiento`
- **Base:** `develop@ae514947a467de4bd2f4e8deb96aff542a3e79c3`
- **SHA funcional revisado:** `2e3d6edad1fd127294e360288cd8857263c90948`
- **Ronda vigente:** 2
- **Resultado:** **CON BLOQUEANTES**
- **Estado:** PR abierta, no Draft, 0 behind / 5 ahead.
- **CI:** no se usa todavía como criterio de cierre porque permanecen bloqueantes.
- **Ejecución local independiente:** no disponible; no se atribuyen tests, mutaciones, Lighthouse, axe o navegador no ejecutados por el revisor.
- **Preview Vercel:** los proyectos conectados `cadeapp-staging` y `cadeapp` no exponen deployments, por lo que no hubo preview reproducible para browser review.

## Estado de hallazgos previos

- `PR122-H01` — **arreglado sin verificar runtime**. El diff corrige tabs 48 px, heading de CourierFeed y elimina las animaciones directas enumeradas.
- `PR122-H02` — **arreglado sin verificar runtime**. El proxy de bundle fue eliminado y las regresiones específicas de inputmode/targets fueron agregadas.
- `PR122-H03` — **parcial / sigue bloqueante**. Axe queda pendiente y todavía faltan evidencia reproducible de Lighthouse, browser/capturas y auditoría de primitivas para justificar los `[x]`.
- `PR122-H04` — **arreglado sin verificar runtime**. La bitácora ya referencia `5ff0678` y la sesión activa usa `por commitear`.

## Regresiones de Ronda 2

- `PR122-R01` — la rama modificó el texto autoritativo del DoD: reemplaza “axe AA sin violaciones” por “axe AA pendiente...”. La decisión 1-A impide agregar dependencias al proyecto, pero no elimina el requisito.
- `PR122-R02` — el test nuevo de headings usa non-null assertions `levels[i]!` / `levels[i - 1]!`, expresamente prohibidas por `AGENTS.md`, mientras la bitácora afirma “Cero `!`”.

Detalle: `revisiones/ronda-2.md`. Evidencia: `evidencia/comandos.md`.
