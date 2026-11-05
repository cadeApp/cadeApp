# PR #620 — T-423 · Geocoding
- PR: https://github.com/cadeApp/cadeApp/pull/620
- Rama: `feat/T-423-map-geocoding` → `develop`
- SHA funcional revisado: `d8180d88e01088691b75f05a3a3be4d19d2d1b9a`
- Autor: Lautaro073 (agente). 15 archivos, +1571/-465. Fecha: 2026-11-05.
- **Ronda 1: CON BLOQUEANTES (5), 1 mejora. No aprobado ni mergeado.**
- Informe: [revisiones/ronda-1.md](revisiones/ronda-1.md). Pruebas propuestas: [evidencia/comandos.md](evidencia/comandos.md). Registros: [hallazgos.jsonl](hallazgos.jsonl).

| ID | Asunto | Estado |
|---|---|---|
| PR620-H01 | Quitar pin no invalida petición | abierto, alto |
| PR620-H02 | Callback tras unmount y refetch al reabrir mapa | abierto, alto |
| PR620-H03 | Cambiar dirección/barrio no invalida resultado anterior | abierto, alto |
| PR620-H04 | Biblioteca/promesa sin respuesta deja buscando | abierto, medio |
| PR620-H05 | Query vacía no finaliza | abierto, medio |
| PR620-H06 | ZERO_RESULTS depende de error.code | abierto, bajo, mejora |

## Decisiones delegadas
D04: **aceptar** `map-geocode.ts` y su incorporación a ficha/plan; evita import estático de Maps en formularios, mantiene reexports CC-045 y no cambia el DoD. D05: query vacía ⇒ `not_found` terminal, sin consultar Google. D06: usar cleanup, cancelación de peticiones, comparación de query vigente y timeout acotado en vez de un sistema global nuevo.

## Falta
Agente corrige H01–H05 con tests RED→GREEN y anotaciones en bitácora; nueva revisión independiente verifica el SHA funcional. Confirmar CI/E2E del SHA corregido. No exigir nuevo CI solo por commit documental. Issue #619 es obligatorio antes de exponer direcciones reales a Google, con validación legal/humana. Esta revisión es **por inspección**, sin clon ni ejecución local.
