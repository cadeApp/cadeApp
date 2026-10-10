# PR #295 — T-338 · PWA standalone sin landing

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/295 |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-338-pwa-standalone` → `develop` |
| **Base original** | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| **HEAD funcional R2** | `43e5945f1d2519db37e260c114df51071bb3fe94` |
| **Decisiones P1 y ficha** | **0-A** entrada de `notifications/index.ts` autorizada; **1-A** no se acepta regresión JS. Ficha registrada en `f5d1393f0391a9f5ff03741a9bec1728b2cb2fd7`. |
| **Estado R2** | **CON BLOQUEANTES (2)**: presupuesto JS y gate E2E sin ejecutar; Android real pendiente |

## Rondas

| Ronda | SHA funcional | Resultado | Informe |
|---|---|---|---|
| 1 | `6a35d87fb1c02bcdbe7956ca4c37dc47581a6c3a` | CON BLOQUEANTES (6) | [ronda-1](revisiones/ronda-1.md) |
| 2 | `43e5945f1d2519db37e260c114df51071bb3fe94` | CON BLOQUEANTES (2) | [ronda-2](revisiones/ronda-2.md) |

## Seguimiento

| ID | Estado al cierre R2 |
|---|---|
| H01 a H05 | Cambios presentes por inspección; `arreglado-sin-verificar` por falta de reproducción independiente del RED |
| H06 | Parcial: sonda de visibilidad presente; E2E cancelado |
| R01 | **Abierto y bloqueante:** First Load JS de cuatro rutas excede 180 kB tras integrar standalone |
| H07 | **Abierto y bloqueante:** `e2e-preview` cancelado en SHA funcional revisado |
| A01 | Aceptado por P1 (0-A) y regularizado en ficha, sin abrir nuevas excepciones |

## Condiciones para R3

1. Optimizar el JS hasta `/`, `/legal`, `/login` y `/register` <=180 kB, sin cambiar el comportamiento ni desactivar controles.
2. Validar TypeScript, lint, tests, build; mostrar baseline RED (HEAD funcional R2) y nuevo GREEN de presupuestos.
3. Conseguir `e2e-preview` ejecutado y GREEN en el SHA funcional siguiente, con test standalone y navegador común.
4. Revalidar controles/mutaciones RED, especialmente sonda anti-flash; no aceptar únicamente los dichos de la bitácora.
5. **Persona en Android físico:** ejecutar y registrar prueba PWA instalada antes/después, y navegador normal.
6. Bitácora append-only, Conventional commit, push, `git ls-remote`, sin tocar `docs/revision-pr/**`.

**Limitación de esta revisión:** inspección de código y de logs reales de GitHub Actions. No se ejecutó en un clon propio la batería independiente de mutaciones ni se levantó Supabase/Docker. No se adjudica `arreglado-verificado` por pruebas del autor.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).
