# PR #115 — CC-012 · Contrato de incidentes

> 🟢 **Ronda 2 — SIN BLOQUEANTES**

| | |
|---|---|
| PR | #115 |
| Rama | `cc/CC-012-incidents` → `develop` |
| SHA funcional verificado | `391697a482c542a7306700599bad8b67909a4468` |
| Base | `develop@5772cb3b1eef7a91a5d0a5a61d2d8cbb0fa5ae28` |
| Estado | Draft |
| CI | typecheck ✅ · lint ✅ · unit ✅ · build ✅ · audit ✅ · db-tests ✅ · bundle-budget ✅ |
| Unit | 83 archivos · 1033 tests PASS |
| DB | 12 archivos · 1601 tests PASS · db:types sin drift |
| Resultado | 0 bloqueantes · listo para merge autorizado |

## Decisiones

Se mantienen D05-A, D06-A, D07-A y D08 de T-124 sin decisiones humanas pendientes.

## Ronda 1

La Ronda 1 encontró cinco bloqueantes: fixture histórico incompatible, falta de mutaciones, fake sin oferta accepted, fake sin gate CC-007 y pérdida de microsegundos en keyset.

## Ronda 2

Los cinco hallazgos quedaron corregidos y verificados sobre `391697a`.

- H01: `structure.sql` usa kind canónico; DB suite completa pasa.
- H02: M1–M5 tienen evidencia RED→GREEN real. M1–M4 y M5 SQL fueron verificados en CI remoto.
- H03: el fake deriva participación courier desde `acceptedOfferId → offer accepted → courierId`.
- H04: el fake y pgTAP focal conservan el gate de consentimiento activo de CC-007.
- H05: el fake preserva microsegundos y la suite focal prueba `.123789Z` vs `.123456Z`.

No se detectaron regresiones nuevas ni debilitamiento de checks.

Detalle: [revisiones/ronda-2.md](revisiones/ronda-2.md)
