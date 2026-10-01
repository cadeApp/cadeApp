# Revisión PR #159 — T-321

- **PR:** #159 — `[T-321] Saneamiento del panel admin en staging: relaciones PostgREST y defaults operativos`
- **Rama:** `feat/T-321-admin-staging-bootstrap`
- **Base revisada:** `develop@9e232d0e4ef003ca0535b11e5a962b4cf603189a`
- **SHA revisado:** `8aad4db969c148499374ebc24acedfd2c070d44a`
- **Ronda:** 3
- **Fecha:** 2026-10-01
- **Resultado:** **CON BLOQUEANTES (1)**

## Estado

| ID | Tipo | Estado | Resumen |
|---|---|---|---|
| PR159-H01 | BLOQUEANTE R1 | arreglado-verificado | T-321 corre sin seed y el pgTAP quedó en 10 aserciones reales. |
| PR159-H02 | DECISIÓN | aceptado | Evidencia AAL2 post-merge/post-promoción. |
| PR159-H03 | BLOQUEANTE R2 | arreglado-verificado | El checker ya ignora comentarios y mata M03/M04. |
| PR159-H04 | MEJORA R2 | arreglado-verificado | El cuerpo de la PR ya describe 10 aserciones y no conserva el total DB viejo. |
| PR159-H05 | BLOQUEANTE R3 | abierto | El checker estático no detecta un UPDATE destructivo separado del INSERT objetivo. |

## Verificación de ronda 3

- Desde `b120fad4` hubo un único commit del autor: `8aad4db9`.
- Solo modificó `.github/workflows/ci.yml` y `docs/tasks/log/T-321.md`, ambos autorizados.
- CI run `36815136630`: todos los jobs verdes.
- `db-tests`: T-321 sin seed **Files=1, Tests=10, PASS**; M01/M02/M03/M04 reportan `RED_OK`; suite completa **Files=13, Tests=1611, PASS**.
- El cuerpo de PR ya no contiene “11 aserciones” ni “1612”.
- Mutación independiente **M05**: conserva el `INSERT ... DO NOTHING` válido y agrega después un `UPDATE public.platform_settings` que solo pisa valores no-default. El checker actual devuelve `[]` (GREEN), y el pgTAP de base fresca tampoco ejerce ese caso.

La evidencia está en [evidencia/comandos.md](evidencia/comandos.md).
