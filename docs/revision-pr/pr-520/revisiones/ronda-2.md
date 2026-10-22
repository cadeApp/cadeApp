# Informe de revisión independiente — PR #520 / T-411 — Ronda 2

**Fecha:** 2026-10-22
**PR:** https://github.com/cadeApp/cadeApp/pull/520
**HEAD funcional revisado:** `edbe8c33efcb5cebfc2577e90131a2ff9e8360fc`
**Base:** `develop` @ `ef9df1c8e59a947cee6f1d26e80458dfea269fcf` (merge de #519)
**Resultado:** **SIN BLOQUEANTES** — ACEPTACIÓN de la revisión independiente del diff y sus evidencias.
**Acciones excluidas:** no se aprobó ni mergeó #520 y no se modificó código funcional.

## Verificación de la ronda 1

| ID | Resultado en ronda 2 | Evidencia |
|---|---|---|
| PR520-H01 | **CERRADO / arreglado-verificado** | PR #519 `merged=true` en `ef9df1c8`; los padres del merge `edbe8c33` son `9a5de50` y `ef9df1c8`. La comparación de `c8e546c` a `edbe8c33` muestra solo `docs/revision-pr/**` y `docs/tasks/log/T-411.md`, ningún cambio funcional. `mergeable=true`. |
| PR520-H02 | **ACEPTADO: evidencia RED acreditada por CI, no por ejecución local del revisor** | PR #521 cerrada sin merge; job `119947923443` sin migración y job `119954909638` sin lock; frente a `db-tests` GREEN de la rama funcional, job `119947807622`. |
| PR520-H03 | **ACEPTADO** | Ficha T-411 del HEAD `edbe8c33` conserva autorización para `runMutationChecks` y para el mock de salida de `actions.test.ts`. |

**Precisión H02:** el primer job RED reportó `Failed 30/30` porque el plan pgTAP era de 30, pero solo alcanzó a ejecutar 1 aserción; el helper inexistente abortó el archivo. El segundo job RED mostró `Files=37, Tests=3131, Result: PASS` en pgTAP, seguido de `AssertionError [ERR_ASSERTION]: E8 altas de plan con el mismo nombre: las dos altas responden sin error` en el runner multisesión sin `pg_advisory_xact_lock`. Es una falla esperada y dirigida de la mutación. No se confunden esos errores esperados con defectos del código funcional.

## Código: comparación respecto de la ronda anterior

El diff de `c8e546c` a `edbe8c33` no altera `src/**`, `supabase/**` ni `e2e/**`. El merge de `origin/develop` incorporó la documentación ya presente en la rama: no hay código que requiera una nueva ronda RED→GREEN por modificaciones recientes. El CC-038 ahora está en `develop` y la ficha desde `develop` se respeta salvo las dos ampliaciones H03 autorizadas.

Se mantiene la firma RPC para compatibilidad, `p_code: null` en el wrapper, el helper privado con permisos revocados, el `advisory lock` en el alta y la inmutabilidad de `code` al editar. La UI no solicita «Código», y el código permanece visible en el listado del administrador. No surgieron nuevos bloqueantes por inspección del diff.

## Checks: distinguir equivalencia de código de CI actual

| Check | Resultado confirmado | Condición / límite |
|---|---|---|
| `unit` | SHA `edbe8c33`: **165 archivos, 3261 pruebas PASS** (job `119961383318`) | Leído en log de CI, no ejecutado localmente |
| `typecheck`, `lint`, `audit`, `build`, `bundle-budget` | SHA `edbe8c33`: success | Checks nativos del SHA revisado |
| `db-tests` anterior | SHA `3a33aff`, código funcional idéntico: **Files=37, Tests=3131, Result: PASS** (job `119947807622`) | Incluye mutación CC038 RED/ GREEN del autor; no es control ejecutado por este revisor |
| `db-tests` nuevo | SHA `edbe8c33`, job `119961383361`: **en curso al redactar** | **No marcarlo verde hasta disponer de log final**; cualquier falla real debe reabrir la revisión |
| `e2e-preview` | Requiere migración de Develop, no ejecutado en preview del PR | Excepción deliberada de T-411; E2E local luego de `migrate-develop` |
| `approval-policy` | Falta sección de informe de revisión en el cuerpo de la PR | El informe de aceptación se publica como comentario **y** en el cuerpo; es una verificación de formato, no técnica |

No es necesario exigir nuevas suites por el commit exclusivamente documental de esta ronda (regla explícita de Lautaro073). Sí es necesario no mergear si el job de base aún en curso llegara a fallar.

## Cobertura metodológica / reservas

- Confirmé estado y parent-shas de los merges, comparé rutas alteradas, examiné el contrato, la ficha, el diff funcional y logs específicos de los checks anteriores y actuales por SHA.
- Este entorno no permite clonar GitHub (DNS fallido) ni ejecutar `pnpm`, Supabase o Docker local; **no se presenta ninguna ejecución propia de mutaciones como verificada**. El RED de #521 es prueba real de CI aportada por el autor e inspeccionada por la revisión.
- El criterio de aceptación está limitado a **no hallazgos bloqueantes demostrados** con la evidencia disponible. No significa que las pruebas pendientes ya pasaron, ni que el despliegue a Develop/Staging/Main se completó.
- No se modificaron los informes históricos: `revisiones/ronda-1.md` se conserva intacto.

## Conclusión

**Informe revisar-pr — T-411 — 2026-10-22 — revisión independiente**  
**Resultado: SIN BLOQUEANTES.**  
Aceptación para avanzar al proceso de merge **cuando los gates pendientes queden conformes**, preservando la ventana de migración antes del E2E local documentada en T-411. `approval-policy` se satisface con el texto exigido en el cuerpo del PR, no únicamente con este informe en archivos/comentarios.
