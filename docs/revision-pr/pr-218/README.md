# PR #218 — T-326 · Barrios de Aguilares y selector del onboarding de comercio

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/218 |
| **Tarea** | T-326 · Issue #190 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-326-aguilares-zones-onboarding` → `develop` |
| **SHA funcional revisado** | `1d6f6b2a4042f35e18baf9fef8a014732dcd591e` |
| **Estado** | Draft · SIN BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ea2b03a0d5cb5362e046bc6bdf4a0cff7e1169af` | 4 hallazgos técnicos + 1 decisión P1 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `1d6f6b2a4042f35e18baf9fef8a014732dcd591e` | SIN BLOQUEANTES · H01–H05 verificados | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR218-H01 | Select controlado emite valor y luego vacío | alto | arreglado-verificado · CC-018 #219 / PR #222 |
| PR218-H02 | publish_request fabrica distancia sin ubicación efectiva | alto | arreglado-verificado · T-330 #220 / PR #223 |
| PR218-H03 | Falta demostrar RED del pgTAP T-326 | medio | arreglado-verificado · RED 6c8f29b → GREEN 34aa472 |
| PR218-H04 | ON CONFLICT no sincroniza centroides documentados/null | medio | arreglado-verificado · upsert determinista + pgTAP divergente |
| PR218-H05 | El PDF completo agrega 03 — 1º de Mayo | alto | arreglado-verificado · decisión P1 opción A |

## Resultado final verificado

- Rama sincronizada con `develop@125728b591950f0de2ecd520eea2617415ac9508`: 0 behind, mergeable.
- Lista final: **63 barrios = 52 puntos derivados + 11 NULL**.
- `03 — 1º de Mayo`: `-27.425778, -65.614882`, derivado reproducible e in-bounds.
- Fuente, `barrios-centroides.json`, migración y seed coinciden exactamente.
- Migración y seed usan el mismo upsert determinista de `centroid_lat`, `centroid_lng` y `active`.
- El pgTAP prueba convergencia desde filas preexistentes divergentes reejecutando las sentencias reales registradas de la migración.
- El selector del onboarding usa el `Select` compartido corregido por CC-018, sin workaround de `''` y sin `<select>` nativo operable.
- Unit actual: **114 archivos / 1694 tests** GREEN; onboarding: **21/21**.
- DB actual: **16 archivos / 1689 tests** GREEN; tipos DB sin diff.
- typecheck, lint, build y bundle-budget GREEN; Vercel Preview READY.
- `e2e-preview` bloqueado por `REQUIRES DEVELOP MIGRATION`: esperado para una PR con migración.
- `audit` falla por advisory nuevo de `braces`; `package.json` y `pnpm-lock.yaml` son exactamente los mismos que `develop`, y el job está definido como advisory hasta contracts-v1. No es un hallazgo de T-326.

## Próximo paso

No hace falta otra ronda mientras el HEAD funcional no cambie.

Lautaro073 puede sacar la PR de Draft y mergearla cuando decida. La revisión no aprueba ni mergea por sí sola.
