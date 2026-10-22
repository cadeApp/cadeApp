# PR #467 — SEC-466 · Corrección de override de Vite

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/467 |
| Incidente | https://github.com/cadeApp/cadeApp/issues/466 |
| Tarea | `SEC-466`, issue de seguridad; **no se supone que exista ficha T-466** |
| Autor | @Lautaro073 |
| Rama | `fix/SEC-466-vite-override` → `develop` |
| Base revisada | `127a900bf489dabf319a4f02046c959689487774` |
| HEAD revisado | `567a4858539c99a485a0c53f790cf1a557455f91` |
| Alcance del parche | 2 archivos, +14/-14 líneas |
| Estado de revisión | Sin defectos bloqueantes detectados en el diff; merge pendiente por CI |

## Rondas

| Ronda | SHA examinado | Hallazgos de código | Informe |
|---|---|---|---|
| 1 | `567a485` | 0 | [ronda-1.md](revisiones/ronda-1.md) |

## Condiciones pendientes de merge

- `build` del primer run del HEAD falló en `next/font/google` desde `src/app/layout.tsx` (archivo sin cambios); no está demostrada regresión causada por Vite.
- `bundle-budget` quedó `skipped` porque depende de `build`.
- `e2e-preview` todavía no figura como status del SHA revisado; Vercel Preview sí reportó deployment listo.
- `db-tests` aún se encontraba en progreso en el momento de consultar el run.
- `approval-policy` falló por no encontrar aún un informe de revisión con el formato requerido. Este informe se añadirá al body.

**No mergear con checks faltantes o fallidos.** El commit de estos documentos dispara de nuevo CI: verificar el estado final del nuevo HEAD y no dar por válido un verde correspondiente solo al SHA previo.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

