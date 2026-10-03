# PR #218 — T-326 · Barrios de Aguilares y selector del onboarding de comercio

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/218 |
| **Tarea** | T-326 · Issue #190 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-326-aguilares-zones-onboarding` → `develop` |
| **SHA funcional/integrado revisado** | `8f3fe8642c7104ac6f28a16d1131f2239dc503e0` |
| **Estado** | SIN BLOQUEANTES · LISTA PARA MERGE |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ea2b03a0d5cb5362e046bc6bdf4a0cff7e1169af` | 4 hallazgos técnicos + 1 decisión P1 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `1d6f6b2a4042f35e18baf9fef8a014732dcd591e` | SIN BLOQUEANTES · H01–H05 verificados | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `77c40b3f349f2928b982c22b5a8f9b39193fa9dd` | H06: bloqueante contractual · CC-020 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `8f3fe8642c7104ac6f28a16d1131f2239dc503e0` | SIN BLOQUEANTES · H06 cerrado · integración final | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR218-H01 | Select controlado emite valor y luego vacío | alto | arreglado-verificado · CC-018 #219 / PR #222 |
| PR218-H02 | publish_request fabrica distancia sin ubicación efectiva | alto | arreglado-verificado · T-330 #220 / PR #223 |
| PR218-H03 | Falta demostrar RED del pgTAP T-326 | medio | arreglado-verificado |
| PR218-H04 | ON CONFLICT no sincroniza centroides documentados/null | medio | arreglado-verificado |
| PR218-H05 | El PDF completo agrega 03 — 1º de Mayo | alto | arreglado-verificado |
| PR218-H06 | `referencia_local` amplía la semántica de CC-017 sin contract-change previo | alto | arreglado-verificado · CC-020 #230 / PR #231 |

## Resultado final

- `develop@2ba24cf3f25744eb1755c5ee448eb6516b983ed6` integrado sin conflictos.
- **behind=0**, mergeable.
- CC-020 Opción A está mergeada y autoriza exactamente los 7 `referencia_local` actuales.
- Desde Ronda 3 no cambió ningún archivo funcional/data de T-326:
  - `barrios-centroides.json`;
  - `referencias-locales.json`;
  - `points.json`;
  - `area-17.json`;
  - `gen_sql.py`;
  - migración;
  - seed;
  - pgTAP;
  - onboarding y sus tests.
- Data final: **63 barrios = 56 `derivado` + 7 `referencia_local` + 0 NULL**.
- Migración: `20261003130000_t326_aguilares_zones.sql`, posterior a CC-019.
- Cadena de evidencia, migración y seed continúan sin divergencias.
- Único punto compartido: **El Alto / Villa Nueva**, autorizado y documentado.
- CI exact-head `8f3fe8642c7104ac6f28a16d1131f2239dc503e0`, run `37104008549`:
  - typecheck ✅
  - lint ✅
  - unit ✅ — **114 archivos / 1738 tests**
  - build ✅
  - db-tests ✅ — **17 archivos / 1807 tests**
  - bundle-budget ✅
  - database.types.ts ✅ sin diff
  - audit ❌ únicamente advisory externo de `braces`
- Vercel no creó el último Preview por rate limit de la cuenta. El árbol funcional T-326 es idéntico al verificado en Ronda 3, donde Vercel estaba READY y el E2E quedó en `BLOCKED / REQUIRES DEVELOP MIGRATION`, el gate esperado para esta PR con migración.

## Ajustes administrativos de Ronda 4

La revisión alineó la ficha T-326 con CC-020 y marcó los dos DoD que ya estaban demostrados por CI/bitácora. No se modificó código, data ni tests.

**PR #218 queda SIN BLOQUEANTES y lista para merge.**
