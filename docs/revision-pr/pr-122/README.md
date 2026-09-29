# Revisión PR #122 — T-205

- **PR:** #122 — `[T-205] Pasada de accesibilidad y rendimiento en las pantallas de comercio y repartidor`
- **Rama:** `feat/T-205-accesibilidad-rendimiento`
- **Base revisada:** `develop@ae514947a467de4bd2f4e8deb96aff542a3e79c3`
- **SHA funcional revisado:** `79d3aeaa4949bd85820467592dafb62fdc2232d4`
- **Ronda actual:** 1
- **Resultado:** CON BLOQUEANTES (3)
- **Estado:** Draft, fase RED inicial
- **Decisión D01:** 1-A — T-205 mantiene “dependencias nuevas permitidas: ninguna”; no se incorpora axe/Playwright al proyecto.
- **Checks de revisión:** inspección estática reproducible; no se atribuyen ejecuciones locales no realizadas.
- **CI:** se deja para la ronda aprobable porque existen bloqueantes.

## Hallazgos abiertos

- `PR122-H01` — el RED de First Load JS no mide el contrato canónico y depende de un `.next` previo.
- `PR122-H02` — la auditoría de 48 px es un blacklist de clases sobre una sola pantalla y omite targets sub-48 presentes en superficies del DoD.
- `PR122-H03` — axe se carga desde una ruta privada de pnpm aunque no es dependencia declarada.

Ver detalle en `revisiones/ronda-1.md` y `evidencia/comandos.md`.
