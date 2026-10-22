# PR #508 — T-393 · Revisión independiente

**PR:** https://github.com/cadeApp/cadeApp/pull/508 · **Rama:** `feat/T-393-partial-delivery` → develop
**Estado:** H01 y H02 corregidos por el autor e inspeccionados; **pendiente de verificación independiente RED→GREEN/E2E**. H03 también fue corregida por el autor, pendiente de verificación independiente.
**HEAD documental observado:** `4699ab55176e978c40ca98f494c52dbd5e4d121e`; último SHA de **código** examinado: `455adc155103cc7d624c40fe3e8db25f23c19fae`.

| Ronda | SHA de código | Resultado |
|---|---|---|
| 1 | `e234ad0955b262f1cb2ce29ed06a50859ba9935f` | [2 bloqueantes + 1 mejora](revisiones/ronda-1.md) |
| 2 | `455adc155103cc7d624c40fe3e8db25f23c19fae` | [H01/H02 corregidos sin verificación independiente; H03 abierta](revisiones/ronda-2.md) |

## Estado
- PR508-H01 (alto): `arreglado-sin-verificar`.
- PR508-H02 (medio): `arreglado-sin-verificar`.
- PR508-H03 (bajo, mejora): `abierto`.

**Decisiones de Lautaro073 (22/10):** 1A autoriza export de trips index; 2B usa estado real con cualquier drop materializado y fallback solo para legacy sin drops; 3C exige `publish_request` autenticada en E2E. Las tres fueron aplicadas por el autor por inspección.

**Pendiente:** reproducir independiente el RED de componentes y la prueba E2E nueva en el Preview del SHA correspondiente, verificar rama contra develop antes del merge y cerrar siguiente ronda. No aprobar/mergear aquí.

[Datos estructurados](hallazgos.jsonl) · [Harness completo](evidencia/comandos.md) · [Lecciones](lecciones.md)
