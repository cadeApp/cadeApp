# Ronda 1 — PR #326 / T-340 Paso 3 (2026-10-13)

**Resultado: CON BLOQUEANTES (3).** SHA auditado `7866da28973da6b45746ff000c11cef3d8cbb772`, base Develop `4eefd119b19792e179e46b1243d07ab957137649`. Review independiente, solo inspección de código + logs reales de CI; sin SQL remoto, tests locales ni despliegue.

## Contexto y decisión del dueño

Lautaro073 eligió explícitamente **opción C — protección diferenciada**. La migración deberá **limpiar solamente lo respaldado por copia privada comprobada**; deberá **conservar datos legacy de borradores incompletos** y **abortar toda la transacción** si una solicitud ya no-draft tiene datos que no se pueden preservar, reportando solo IDs/conteos seguros o resumen no sensible (no notas, teléfonos, montos privados). Este resultado reemplaza las opciones A (fallar ante cualquier borrador) y B (dejar históricos publicados sensibles sin alarma).

También autorizó expresamente:
1. A **KiraK72** a cambiar la migración SQL, el puente `app_private.request_cycle` y RPC de zona P1 **solo dentro del Paso 3 de T-340**, con revisión independiente posterior.
2. Conservar `src/server/e2e/staging-seed.test.ts`, pertinente al fallback de búsqueda cuando `notes` está NULL. Se registra como **excepción de alcance aceptada**, no como infracción a penalizar.
3. **No** autorizó nuevas dependencias, eliminación de columnas/puente legacy, cambios de permisos/RLS ajenos, ni desarrollar Paso 4 «Agregar otra entrega».

## BLOQUEANTES

### PR326-H01 — CRÍTICO: limpieza global sin verificar respaldo

En `supabase/migrations/20261013140000_t340_clean_legacy.sql:15–35`, después de `select app_private.t340_backfill_legacy()`, se hace `UPDATE public.delivery_requests SET notes=NULL, cash_change_amount=NULL WHERE ...`. El backfill existente de `supabase/migrations/20261009200000_t340_multi_drop.sql:1571–1611` **omite borradores incompletos** y casos no materializables; no garantiza un drop/contacto para cada fila. Además, el `COALESCE` del paso de sincronización conserva el dato privado existente aunque difiera del legacy, y luego descarta el legacy sin decidir cómo resolver el conflicto. **Hay una ruta lógica de pérdida irreversible por inspección. No se ejecutó un dataset adversarial para demostrarla en runtime.**

**Corrección requerida (C):** preflight seguro por estado, elegibilidad, drop `position=1`, contacto privado y equivalencia de cada dato no-NULL; preservar drafts sin copia; para no-drafts inconsistentes **RAISE EXCEPTION antes de limpiar**, en la misma transacción, sin PII en el mensaje. Hacer la actualización final solo contra filas elegibles y verificadas; rechazar divergencias, no sobreescribir datos privados válidos silenciosamente. Demostrar que una migración fallida revierte todo (incluido backfill).

### PR326-H02 — ALTO: puente con drop previo puede limpiar sin copiar

En la redefinición de `app_private.request_cycle` dentro de esa migración, `:204–236` crea `drop 1` + `drop_contacts` cuando no había drops, pero `:335–339` limpia `notes` y `cash_change_amount` siempre que se publique **también cuando ya había drops**. El segundo camino no valida que `drop_contacts` contenga el valor legacy sin pérdida; si el dato estaba ausente o diverge, se perdería.

**Corrección requerida:** asegurar copia/sincronización y verificaciones de `position=1` antes de limpiar en ambas ramas, con bloqueo/atomicidad existentes. En conflicto sin política explícita, rechazar la publicación, no limpiar ni revelar datos. Conservar autorización por actor, idempotencia, rate limit, límites de drops y privacidad; no reescribir indiscriminadamente la función.

### PR326-H03 — ALTO: los tests no ejercen el caso destructivo

`supabase/tests/t340_multi_drop.sql:439–510` prueba el camino correcto del puente de **cero drops** y el resultado esperado en un dataset favorable. No demuestra una ejecución real de la migración sobre **datos existentes antes de aplicarla**: drafts incompletos con `notes`, históricos published/matched inválidos, divergencia legacy↔privado, reintentos, ni rollback al fallar. Con la condición global actual esas rutas pueden borrar valores y `db-tests` seguir verde.

**Corrección requerida:** crear pruebas SQL genuinas de escenario pre/post migración bajo Postgres efímero del CI, más pruebas de helper invocable desde pgTAP si corresponde; exigir RED auténtico **del control específico** al reintroducir la limpieza global, y GREEN después, con asserts intactos. No introducir tests falsos, `.skip`, expectativas acomodadas, excepciones genéricas ni silenciar el caso.

## Estado de otras verificaciones

- `unit`: Vitest **2.136/2.136**, 129 suites PASS; `db-tests`: **21 archivos/2.003 tests PASS**, pgTAP `t340_multi_drop.sql` incluido, drift de tipos y mutación preexistente H15 del job verificados en log. Typecheck, lint, build, audit, bundle-budget PASS en HEAD.
- Vercel Preview SUCCESS, pero **`e2e-preview=BLOCKED / REQUIRES DEVELOP MIGRATION`** por SQL nuevo en PR. No adjudicar GREEN ni FAIL funcional. `approval-policy` rojo por falta de revisión independiente hasta esta ronda; la política no valida corrección de código.
- Únicamente 8 archivos tocados; ninguna modificación de Paso 4, CI/workflow, RLS/grants ni dependencias. El único archivo de prueba fuera de lista explícita, `src/server/e2e/staging-seed.test.ts`, queda autorizado por Lautaro073 para esta PR.
- El autor afirma RED→GREEN de tests unitarios sobre writer/seed; la revisión **no reprodujo esos RED** y no sustituye las pruebas adversariales de migración por esos assertions. No se observó evidencia de ejecución E2E tras migración en esta PR.

## Seguimiento

Kira debe trabajar en la **misma rama** sin rebase/force/amend, conservar el alcance, corregir H01–H03, demostrar la condición destructiva con mutación RED no commiteada, volver a ejecutar CI/pgTAP y actualizar exclusivamente `docs/tasks/log/T-340.md` y cuerpo de la PR como autor. **`docs/revision-pr/pr-326/**` es exclusiva de la revisión**. Al finalizar, pedir ronda 2 independiente sobre el HEAD nuevo. **No aprobar ni mergear**. El Paso 4 permanece bloqueado.
