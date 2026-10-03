# PR #218 — T-326 · Barrios de Aguilares y selector del onboarding de comercio

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/218 |
| **Tarea** | T-326 · Issue #190 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-326-aguilares-zones-onboarding` → `develop` |
| **SHA funcional/integrado revisado** | `77c40b3f349f2928b982c22b5a8f9b39193fa9dd` |
| **Estado** | Draft · CON BLOQUEANTE CONTRACTUAL |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ea2b03a0d5cb5362e046bc6bdf4a0cff7e1169af` | 4 hallazgos técnicos + 1 decisión P1 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `1d6f6b2a4042f35e18baf9fef8a014732dcd591e` | SIN BLOQUEANTES · H01–H05 verificados | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `77c40b3f349f2928b982c22b5a8f9b39193fa9dd` | 1 bloqueante contractual nuevo · H06 / CC-020 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR218-H01 | Select controlado emite valor y luego vacío | alto | arreglado-verificado · CC-018 #219 / PR #222 |
| PR218-H02 | publish_request fabrica distancia sin ubicación efectiva | alto | arreglado-verificado · T-330 #220 / PR #223 |
| PR218-H03 | Falta demostrar RED del pgTAP T-326 | medio | arreglado-verificado |
| PR218-H04 | ON CONFLICT no sincroniza centroides documentados/null | medio | arreglado-verificado |
| PR218-H05 | El PDF completo agrega 03 — 1º de Mayo | alto | arreglado-verificado |
| **PR218-H06** | `referencia_local` amplía la semántica de CC-017 sin contract-change previo | **alto** | **abierto · CC-020 #230** |

## Ronda 3 — técnicamente verificado

- Rama sincronizada con `develop@973d7fae30c1db610eedf3f07aa52fbff3163a29`: **behind=0**, mergeable.
- Migración T-326: `20261003130000`, posterior a CC-019 `20261003120000`.
- Lista: **63 barrios = 56 derivados + 7 referencia_local + 0 NULL**.
- Cadena de evidencia sin divergencias:
  - 55 derivados coinciden con `points.json`;
  - San Lorenzo coincide con `area-17.json`;
  - los 7 `referencia_local` coinciden con `referencias-locales.json`;
  - migración y seed coinciden exactamente con los 63 puntos de `barrios-centroides.json`.
- Todos los puntos están dentro de CC-019.
- Único punto compartido: **El Alto / Villa Nueva**, documentado.
- Mutación de Santa Rosa solo en datos → RED 3/20; revert normal → GREEN.
- Selector/UI sin cambios desde Ronda 2; `src/ui/select.tsx` del HEAD es idéntico a `develop`.
- CI exact-head:
  - typecheck/lint/unit/build/db-tests/bundle-budget GREEN;
  - unit: **114 archivos / 1738 tests**;
  - DB: **17 archivos / 1807 tests**, tipos sin diff;
  - Vercel READY.
- `audit`: advisory externo de `braces`.
- `e2e-preview`: `BLOCKED / REQUIRES DEVELOP MIGRATION`, esperado.

## Bloqueante H06

CC-017 vigente permite como dato de zona:

1. punto/centroide cartográfico derivado del plano municipal con georreferenciación reproducible; o
2. `NULL` cuando no existe un punto suficientemente sustentado.

También declara que no es válido usar un pin manual sin esa georreferenciación y resume la regla como **derivar o dejar NULL**.

T-326 ahora introduce una tercera categoría, `referencia_local`, y guarda 7 puntos de Google Maps/OSM/decisión local en `zones.centroid_lat/lng`.

Los puntos están bien documentados y fueron aprobados como ubicaciones, pero el contrato compartido todavía no autoriza almacenarlos/consumirlos como fallback geográfico. Los consumidores actuales pueden usarlos en onboarding y distancia aproximada.

→ Formalizado como **CC-020 / #230**.

**No mergear #218 hasta resolver y mergear CC-020.**
