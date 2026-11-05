# PR #607 — Ronda 2 · Informe definitivo de aceptación

**Tarea:** T-404 · **Fecha de cierre local:** 2026-11-04 · **SHA de código revalidado:** `1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc` · **Base:** `develop` en `7d07fdf80d94bce49580ec84cc39722b5bff4756`.

## Veredicto

**Resultado: SIN BLOQUEANTES (0). Revisión independiente ACEPTADA.** Los 2 bloqueantes de R01 se corrigieron y los tests oficiales ejecutados sobre el SHA exacto verifican el comportamiento nuevo; H03 es una decisión de alcance aceptada. **No es una aprobación de GitHub ni un merge.** La PR queda bajo decisión final de Lautaro073, en Draft hasta que él la cambie.

**Integridad del head:** la comparación entre `1d4fcc29` y el head recibido para el cierre `ccc8965a` arroja exactamente **un commit, 5 archivos, todos en `docs/revision-pr/pr-607/`** (README, revisión R02, hallazgos, lecciones y evidencia). Sin cambio de producción, test ni contrato posterior al SHA comprobado. El nuevo commit de este informe es asimismo exclusivamente documental. No exigir otra E2E GREEN por este movimiento documental.

## Tabla de hallazgos cerrados

| ID | Resultado | Verificación independiente |
|---|---|---|
| **PR607-H01** (alto) | **arreglado-verificado** | `getApplicantAuditRows.limit(50)` + retorno completo de auditorías e hitos (hasta 52) con empates deterministas; tests 0/49/50 y empate vistos en diff; CI unit en `1d4fcc29` **3568/3568 PASS** |
| **PR607-H02** (alto) | **arreglado-verificado** | `?courier` validado, filtro PostgREST compartido por courier y courier_document **antes** del límite, propagación de errores, sesión/RLS, cursor y URL persistente; tests unitarios nuevos GREEN, y **E2E real T-404** navega desde detalle a auditoría y muestra el motivo compuesto |
| **PR607-H03** (medio) | **aceptado** | Decisión D01=C de Lautaro073, motivo visible para el repartidor trasladado al CC y tarea separados de [#609](https://github.com/cadeApp/cadeApp/issues/609); ficha, bitácora, archivos permitidos y cuerpo PR coherentes. No se cambió RPC/contrato en T-404 |

**No hay decisiones abiertas.** H01/H02 constan `arreglado-verificado` con `verificado_en_sha=1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc` y método de verificación concreto en `hallazgos.jsonl`. La inspección de un revisor con las pruebas ejecutadas por GitHub Actions y el E2E de Preview **no equivale a mutaciones locales repetidas**: estas últimas permanecen únicamente como evidencia declarada por el autor.

## Resultado CI y E2E: ejecución real y SHA comprobado

| Control | Evidencia oficial | Resultado |
|---|---|---|
| Typecheck | [CI #41947713873](https://github.com/cadeApp/cadeApp/actions/runs/41947713873), SHA `1d4fcc29` | **SUCCESS** |
| Lint | Mismo CI | **SUCCESS** |
| Build | Mismo CI | **SUCCESS** |
| Audit | Mismo CI | **SUCCESS** |
| Unit | Mismo CI, job `126983938716`, log de Vitest | **193/193 archivos · 3568/3568 tests PASS** |
| DB | Mismo CI, job `126983939061`, salida final de pgTAP | **42 archivos · 3396 tests · Result: PASS** |
| Bundle budget | Mismo CI; status success, advertencia anterior | **267 kB / 180 kB** en `/admin/applicants/[id]` y `/admin/audit`. No aumentó respecto de R01. |
| E2E Chromium | [e2e-preview #41947878934](https://github.com/cadeApp/cadeApp/actions/runs/41947878934), job `126984567642`, checkout explícito de `1d4fcc29` | **114 passed + 2 flaky**, los dos recuperados |
| E2E global-settings | Mismo job, segundo proyecto | **6 passed** |
| E2E commit status | `/commits/1d4fcc29/status` / job `report-preview-status` | **`e2e-preview=success`**, no pending/cancelled |

**Ambos flakies reales y comprobados en logs:**
- **T-380 `admin-courier-reinstate.spec.ts:100`:** Playwright strict mode: `getByText('Aprobado', { exact: true })` encontró dos badges, falló intento base y retry #1, **PASS en retry #2**. La línea estaba en `develop` antes de T-404. El test contiene comprobaciones T-404 añadidas después de ese punto; el spec terminó verde en el reintento.
- **T-410 `admin-trips.spec.ts:167`:** timeout de `waitForURL` en un escenario de viaje; falló el intento inicial y **PASS en retry #1**. El archivo no forma parte de la PR T-404.

**T-404 confirmado en runner:** `courier-onboarding.spec.ts:838`, «Admin en UI rechaza con un motivo de la lista y el motivo compuesto queda en la auditoría y el historial», figura como PASS de primera en Chromium; incluye el nuevo paso «Ver todo en Auditoría», comprobado dentro del spec. `admin-courier-reinstate` corrió completo y PASS tras retry #2; el flaky está en una aserción T-380 anterior a las agregadas.

El workflow `e2e-preview` usa `repository_dispatch` sobre el SHA de la rama `develop`, **pero el job de pruebas hizo checkout explícito `ref: 1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc`** y el reporte publicó el status GREEN **en ese commit**, no en develop. El E2E de un commit posterior que solo cambia docs terminó cancelado; eso no invalida el E2E del SHA de código.

## Mejoras y deudas NO bloqueantes

1. **E2E del camino documental y segunda página:** el test nuevo confirma URL y decisión de tipo `courier`; no fuerza una fila `courier_document`, el filtro de otro courier con datos reales ni 21+ entradas. Los tests unitarios verifican que la consulta armada incluye la rama `courier_document` y conserva el cursor. Mejorar cobertura cuando se amplíe el alcance, sin bloquear este DoD demostrado.
2. **Cardinalidad documental:** la lista de IDs para `target_id.in.(...)` no está paginada; el `max_rows` configurado en Supabase es 1000. Posible riesgo de escala, **no fallo reproducido** en T-404.
3. **Bundle budget:** presupuesto no cumplido en diversas rutas de admin, pero exactamente igual que en los CI previos `e5ca27ad` y `7cc21d39`. Registrar como deuda histórica, sin atribuir incremento falso.
4. **Flaky de test legacy:** conviene endurecer por separado el selector `Aprobado` de T-380 para distinguir badges. T-410 tuvo un timeout aislado. **No cambiar esos tests fuera de la ficha T-404** para maquillar el estado del gate.
5. Comentario obsoleto en `getApplicantAuditRows` sobre «una de más» con `.limit(50)` sigue sin indicador real de truncamiento: corrección de prosa posible, no funcional.

## Alcance real, gates y cierre

El revisor **leyó y comparó** código, ficha/bitácora y E2E; **inspeccionó directamente las ejecuciones y logs** oficiales del SHA. El ambiente local no dispone de clon DNS ni de `pnpm`, por lo que **no corrió una suite ni mutaciones locales propias**, y no atribuye como independientes los RED 11/98, GREEN 109, M1–M4 o MA–MD del agente. Esto es diferente de los tests CI y E2E ejecutados de verdad y verificados en el registro oficial.

`approval-policy` falló en ejecuciones previas con «Falta el informe completo de revisar-pr sin bloqueantes». Leyendo el script de `develop` se verificó que **no lee comentarios de la PR**: requiere seis rótulos específicos dentro de la sección `### Informe de revisión de agy` **en el cuerpo de la PR**. El cierre incluye la actualización de ese cuerpo; no se declara que el check haya cambiado a verde hasta observarlo.

**Conclusión:** T-404 **ACEPTADA POR REVISIÓN INDEPENDIENTE**, 0 bloqueantes; sin aprobación ni merge. Seguimiento CC #609 separado. No disparar workflows manuales ni exigir E2E nuevo por documentación. Lautaro073 conserva la decisión de pasar Draft a Ready y de mergear.
