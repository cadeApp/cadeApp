# PR #689 — T-430 / CC-048 · SEC-06

| Campo | Dato |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/689 |
| Tarea | T-430, CC-048, SEC-06 |
| Autor | @Lautaro073 |
| Rama | `feat/T-430-sec06-draft-only` → `develop` |
| Base revisada | `develop@c823fae1b9ff79b6e456c51a77b3543c9b6f17f8` |
| Ronda 1 (head) | `7ce8a7f15b28f8624d025efb5f17949c982b858e` |
| Ronda 2 (head) | `3912c5fc4a8bfca3b8d7373b2749fa6985425e25` |
| Código con cambio de ronda 2 | `e9aa88484647791f7a79b220718d2177f6f10cd7` |
| **Estado de revisión** | **Ronda 2 CERRADA: SIN BLOQUEANTES, SIN HALLAZGOS ABIERTOS** |
| Acción de GitHub | No aprobada ni mergeada por la revisión |

## Historial de rondas

| Ronda | Estado y evidencia | Informe |
|---|---|---|
| 1 | D01-A ratificada; PR689-H01 detectado y D02-A solicitada | [Ronda 1](revisiones/ronda-1.md) |
| 2 | PR689-H01 **arreglado-verificado**, GREEN/RED cotejados; sin regresiones detectadas | [Ronda 2](revisiones/ronda-2.md) |

## Hallazgos

| ID | Estado | Evidencia |
|---|---|---|
| `PR689-A01` | **aceptado por D01-A**, no arreglo | Ampliación autorizada de `t339_fixed_price.sql` y `integration/cc026_reconcile_expired_requests.mjs` |
| `PR689-H01` | **arreglado-verificado en `e9aa8848`** | Política de INSERT aislada del trigger; test 108-111; GREEN [43150132171](https://github.com/cadeApp/cadeApp/actions/runs/43150132171), RED mutación aislada #696 [43150138719](https://github.com/cadeApp/cadeApp/actions/runs/43150138719) |

La prueba real corre en CI; la revisión independiente inspeccionó código y logs de PostgreSQL y ejecutó un control estático adicional con mutaciones en memoria, **no ejecutó PostgreSQL local ni lanzó workflows**. El run GREEN reporta **45 archivos / 3801 pruebas pgTAP PASS**, incluyendo `cc048` **111/111** y los ocho escenarios CC-048 de integración. El RED suprime **únicamente** `and r.status = 'draft'` del `WITH CHECK` de la policy de INSERT y falla precisamente en los tests **108 y 109** (`00000` real contra `42501` esperado). La PR de mutación #696 fue cerrada sin merge.

La rama revisada tiene un commit de bitácora `3912c5fc` después del código `e9aa8848`, sin cambios adicionales de implementación. El gate `e2e-preview` exige aplicar primero la migración en Develop y se encontraba `BLOCKED / REQUIRES DEVELOP MIGRATION`; no se afirma que E2E haya ejecutado o esté verde. No se exige GREEN adicional por bitácora o documentos de revisión.

## Fuentes y reproducción

- [Hallazgos estructurados](hallazgos.jsonl)
- [Evidencia de CI y comandos](evidencia/comandos.md)
- [Harness propio de Ronda 2](evidencia/probe-ronda-2.mjs) — control estático, no DB
- [Lecciones](lecciones.md)

**Cierre técnico de la revisión ≠ aprobación, merge ni verificación E2E.** Si el código cambia posteriormente, debe revisarse el nuevo SHA.
