# PR #607 — Revisión independiente, ronda 2

**Tarea:** T-404 · **Fecha local:** 2026-11-04 · **SHA de código revisado:** `1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc` · **Base develop:** `7d07fdf80d94bce49580ec84cc39722b5bff4756`. **Commits revisados esta ronda:** `7cc21d39..1d4fcc29` (14 archivos, sin cambios en la carpeta exclusiva del revisor).

**Resultado: SIN BLOQUEANTES DE CÓDIGO DETECTADOS (0), con verificación externa todavía incompleta.** No se autoriza el merge hasta el resultado final de `e2e-preview` y los gates oficiales. No se aprueba ni mergea. La PR permanece Draft.

## Hallazgos heredados de R01

| ID | Estado en R02 | Evidencia / residual |
|---|---|---|
| **PR607-H01** (alto) | **arreglado-sin-verificar** | `getApplicantAuditRows.limit(50)` permanece y `buildApplicantHistory` retorna **todos** los auditados y los 0–2 hitos sin `slice(-50)`. Orden con empates deterministas; tests 0/49/50 y empate. CI unit oficial del mismo SHA: 3568/3568. No se repitieron mutaciones propias en un checkout local. |
| **PR607-H02** (alto) | **arreglado-sin-verificar** | `applicantAuditFilter` compartido incluye courier+documentos por target_id/after/before; `getAuditLog` lo aplica antes de `pageSize+1` y preserva `id DESC`/cursor; `?courier` validado, conservado en formulario, enlaces y página. El E2E nuevo aún no terminó y prueba la decisión `courier`, no un registro `courier_document` ni una segunda página. |
| **PR607-H03** (medio) | **aceptado/resuelto documentalmente** | Archivos de D02 agregados a la ficha, E2E de lectura del motivo por courier trasladado al CC/tarea de [#609](https://github.com/cadeApp/cadeApp/issues/609). Campo «Mensaje para el postulante» conservado. Bitácora nueva entrada y descripción de PR coherentes. |

**Comparación con contrato de `develop`:** D01–D03 humanas y autorizadas; no se tocaron nuevas RPC, `src/domain`, `src/ui`, tipos generados, migraciones, dependencias ni secretos. Todos los archivos de producción cambiados aparecen en la ficha actualizada.

## CI oficial: resultados comprobados leyendo logs

| Check | Estado en `1d4fcc2900c8` |
|---|---|
| Typecheck | ✅ success |
| Lint | ✅ success |
| Build | ✅ success |
| Audit | ✅ success |
| Unit | ✅ success — **193/193 archivos; 3568/3568 pruebas** |
| Bundle budget | ⚠️ job success pero advierte: admin/applicants/[id] y admin/audit = **267 kB**, presupuesto **180 kB**, **igual que en R01** |
| DB tests | ⏳ in_progress al último sondeo |
| e2e-preview | ⏳ in_progress, [run #41947878934](https://github.com/cadeApp/cadeApp/actions/runs/41947878934) |
| approval-policy | ❌ por ausencia previa de informe completo sin bloqueantes, no por test; logs: `Falta el informe completo de revisar-pr sin bloqueantes.` |

`e2e-preview` corre como `repository_dispatch` en la rama default (`head_sha` del workflow = develop); su código resuelve el SHA de la PR y hace checkout `needs.resolve.outputs.sha`; el commit status para `1d4fcc2900c8` permanecía `pending`. No informar como GREEN hasta que publique su resultado.

El autor reportó `pnpm test` local con 3567/3568 y una falla intermitente de `request-offers`. En **CI oficial del SHA exacto**, esa misma suite completa pasó **3568/3568**. No hay base para atribuir a este PR un fallo persistente de `request-offers`.

## MEJORAS / RIESGOS NO BLOQUEANTES

1. **Cobertura E2E de H02:** el E2E nuevo comprueba el vínculo `?courier=...` y que aparece la decisión del repartidor; el vínculo puede ser correcto aunque falte la rama documental o falle el cursor en la segunda página. Los unit tests inspeccionan los argumentos del constructor de query, no ejecutan una base real con otro courier y dos documentos. Se recomienda un E2E de consulta real adicional como endurecimiento, **no se declara un defecto funcional sin prueba**.
2. **Escala de IDs documentales:** `getAuditLog` lee `courier_documents` por courier, sin paginar su lista de ids, y luego arma un `target_id.in.(...)`. `supabase/config.toml` configura `max_rows=1000`; ante cardinalidades grandes puede truncar IDs y aumentar longitud de URL. Las filas con `before/after.courier_id` siguen siendo alcanzables. No se reporta como fallo reproducido con las cantidades actuales; seguimiento de eficiencia si hay volumen real.
3. **Budget:** 267 kB/180 kB es un warning real del CI, no un PASS del umbral; los mismos valores figuran en los runs de R01 `e5ca27ad`/`7cc21d39`. Sin evidencia de regresión R02, tratar como deuda cuantitativa previa, no convertirla en falso hallazgo introducido por esta corrección.
4. Comentario heredado en `getApplicantAuditRows` sobre «una de más indica que está recortado» sigue sin ser exacto: la consulta usa `.limit(50)` y no devuelve indicador de truncamiento. Mejora documental, no afecta la consulta.

## Alcance y límites de esta revisión

**Se ejecutó de verdad:** inspección del código del SHA y comparación contra R01, consulta de status de GitHub, lectura de logs CI unit + bundle budget y de `approval-policy`, verificación de workflow E2E para distinguir SHA default vs SHA objetivo. **No se ejecutó:** clon, pnpm local ni mutaciones independientes/autorizadas por el agente; el entorno no resuelve el host GitHub por Git y no tiene pnpm. El autor dejó RED 11/98, GREEN 109 y M1–M4/MA–MD en bitácora: se los cotejó con tests agregados y CI GREEN, **no se reprodujo su RED ni sus mutaciones**. Ver [evidencia/comandos.md](../evidencia/comandos.md).

**Gates pendientes que requieren resultado, no decisión humana:** cierre de `db-tests` y `e2e-preview` con logs reales. Si falla alguno, no mergear y reabrir revisión; si quedan verdes y el SHA coincide, los bloqueantes de código inspeccionados en R01 están resueltos. La documentación de revisión que se commitea después **no requiere otro CI GREEN solo por bitácora/documentación**, pero sí mantener la condición de que las suites corresponden al SHA de código `1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc`.

**No hay decisiones nuevas que solicitar a Lautaro073.** D01/D02/D03 permanecen cerradas, issue #609 separado. No aprobar, no mergear, no mover `develop` ni ejecutar workflows manuales.
