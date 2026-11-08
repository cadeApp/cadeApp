# Informe revisar-pr — CC-047 / T-408 — ronda 2 — 2026-11-07

**PR:** https://github.com/cadeApp/cadeApp/pull/657  
**SHA revisado:** `ec341a04939b9cc9ae24b574c440a19d6690e591`  
**Padre:** `c8cd4b773888820c5cb23f610e732c0b090ab92d` (commit propio de ronda 1)  
**Base:** `develop@4e700aa2d5f3edb362446675a736903fbb55dd35`  
**Resultado:** **CON BLOQUEANTES (2)** — R01 y H05. **No aprobar/mergear.**

## Resumen

| Caso | Estado | Motivo |
|---|---|---|
| PR657-H01 · SEC-02 | Corregido por inspección, **sin ejecutar SQL** | Trigger `security invoker` con `current_user`, grant+policy temporales y comportamiento FK y RPC definidos |
| PR657-H02 · SEC-01/CC-031 | Corregido por inspección, **sin ejecutar SQL** | Dos RPC `aal2` con `FOR UPDATE` y `audit_log`; suites CC-031 y escenarios B/C listados |
| PR657-H03 · SEC-11 | Corregido por inspección, **sin ejecutar SQL** | `rpc_admin.sql` presente en Impacto, Archivos permitidos y DoD con nota auditada |
| PR657-H04 · SEC-11 | Corregido por inspección, **sin ejecutar SQL** | Sin backfill destructivo; SELECT con `DISTINCT ON` y último `audit_log.id`; manual por ambiente |
| D3=B | Respetada por inspección | `profiles_update_self`, `merchants_update_self` y push propios conservados, pgTAP por campo exigido |
| **PR657-R01** | **BLOQUEANTE nuevo (regresión)** | 10 suites y una migración concreta no coinciden con «Archivos permitidos» |
| **PR657-H05** | **BLOQUEANTE nuevo (reconciliación incompleta)** | Grants/policies/autoservicio se contradicen y el checklist ignora los locks CC-031 |

No hay nuevas decisiones de producto. D1=A, D2=B, D3=B quedan firmes.

## Evidencia sobre SHAs y alcance

- El PR en GitHub sigue apuntando a `ec341a04939b9cc9ae24b574c440a19d6690e591` y a la misma base de ronda 1.
- Comparación `c8cd4b7...ec341a04`: **1 commit**, dos rutas modificadas: `docs/contracts/CC-047.md` (+124/-24) y `docs/tasks/T-408.md` (+7/-2). **Nadie tocó `docs/revision-pr/pr-657/**` desde la ronda 1.
- Comparación de `develop...ec341a04`: contrato nuevo + ficha + cinco archivos de revisión; no hay SQL ni TypeScript nuevo.
- No existe `docs/tasks/log/T-408.md` en el head (aún no hay implementación; esto no es un hallazgo).
- GitHub marca el PR como mergeable; no se ejecutó `git merge-tree --write-tree` en un clon local y no se infieren resultados de CI de esa señal.
- El usuario informó `git diff --check` limpio; **no fue reproducido independientemente** por falta de clon local.
- Tests y checks `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:db`, E2E y mutaciones SQL: **NO EJECUTADOS** en esta ronda documental. Solo controles de texto con mutaciones en memoria y `node --check` del harness.

## Hallazgos nuevos

### R01 · ALTO · Bloqueante — «Archivos permitidos» no autoriza los nombres reales

**Archivo:** `docs/tasks/T-408.md:48,52,57`. **Control del repo:** `tools/verify-fichas.test.ts:44-47`.

**Diagnóstico [ANÁLISIS + reproducción documental].** La ficha incluye:

- `supabase/tests/{cc007_consent_enforcement,cc023_private_columns,cc032_request_cancellation_history,cc036_offers_rpc_only,rls_coordinates,rpc_distance}.sql` (6 pruebas);
- `supabase/tests/{rpc_accept,t339_fixed_price,t369_publication_credits,structure}.sql` (4 pruebas condicionales);
- `supabase/migrations/<timestamp>_cc047_admin_hardening.sql` (placeholder en lugar de archivo concreto).

El algoritmo `permite` usa **solo igualdad literal o prefijo que termine en `**`**; no interpreta llaves ni `<timestamp>`. En el SHA revisado, **10/10** nombres concretos de esas suites son rechazados por la comparación; una ruta de migración real como `supabase/migrations/20261108020000_cc047_admin_hardening.sql` tampoco coincide. Las rutas `rpc_admin.sql`, las dos CC-031 y `rls_matrix.sql` sí están permitidas. El test del repositorio solo valida ciertas rutas estructurales, no todas las entradas; no implica que CI esté rojo.

**Arreglo exacto:** reemplazar cada grupo de llaves por sus **rutas individuales entre backticks** en «Archivos permitidos». Para la migración, elegir un timestamp concreto posterior al último archivo en `develop`, verificar ausencia de colisión y poner **ese nombre exacto** tanto en la ficha como en las dos referencias del CC. No usar `supabase/migrations/**` para disimular el problema: amplía permisos de manera innecesaria. La propuesta `20261108020000_cc047_admin_hardening.sql` es ejemplo válido tras verificar colisión, no una migración ya creada. Conservar la condicionalidad de las cuatro suites opcionales en prosa.

**Mutación documental ejecutada en memoria:** el corrector `permite` devuelve falso para las once rutas con la ficha actual; el reemplazo por nombres literales hace que sea verdadero (sin modificar la rama). **Mutación SQL RED→GREEN pendiente para T-408**, no atribuible a este control textual.

### H05 · ALTO · Bloqueante — El contrato y el DoD se contradicen en privilegios y carreras

**Archivos:** `docs/contracts/CC-047.md:64-74,162-165`; `docs/tasks/T-408.md:35-39,79`.

**Diagnóstico [ANÁLISIS].** El CC dispone conservar grants compartidos a `authenticated` para self policies de comercios/repartidores y habilitar el autoservicio de admin (D3=B). Pero el DoD de T-408 aún pide que cada escritura pierda «su policy **y su grant** de escritura directa» (`:79`). Revocar el grant compartido de tabla para todo `authenticated` rompería el UPDATE legítimo del propio comercio/repartidor, contrario al CC. En el propio CC (`:163-165`), «el admin no tiene ninguna policy de escritura» también contradice D3=B: sí le pueden aplicar policies `*_self` sobre sus filas.

Además, el checklist `T-408.md:37` dice «Idempotencia y concurrencia: no aplica salvo `accept_offer`», aunque D1=A añade dos RPC que requieren `FOR UPDATE` y conservar las carreras B/C de CC-031. La comprobación del DoD `:85` no subsana una instrucción previa opuesta. `T-408.md:39` conserva la noción de backfill con nota nueva vacía, cuando D2=B prohíbe backfill: aclararlo para evitar una implementación ambigua.

**Arreglo exacto:**
1. En `T-408.md:79` reemplazar «pierde su policy y su grant» por «pierde las policies de escritura **administrativa**; los grants de tabla compartidos para policies de autoservicio se conservan; solo revocar privilegios de `audit_log` conforme SEC-02».
2. En `CC-047.md:163-165` decir «admin no tiene policy de escritura *privilegiada*, pero sí puede usar `*_self` en sus filas; se prueban campos sensibles de ambas maneras»; no afirmar cero UPDATE en cualquier campo.
3. En `T-408.md:37` mencionar `accept_offer` y **las dos RPC D1** con locks `FOR UPDATE` y escenarios CC-031 B/C; en `:39` anotar «sin backfill; SELECT de candidatos y paso manual por ambiente».

**Prueba documental:** buscar las tres afirmaciones contradictorias y comprobar que desaparecen conservando D1/D3. En T-408 futuro, probar positivo de autoservicio y bloqueo de campo privilegiado con JWT admin `aal1/aal2`, y conservar carreras B/C.

## Inspección detallada de H01–H04

- **H01:** `CC:75-86,154-159,292-298` especifica invoker, `current_user`, revokes y prueba real con grant/policy permisivos para UPDATE/DELETE/TRUNCATE; `ON DELETE SET NULL` y RPC definer preservados. Probar además explícitamente el DELETE de limpieza por `service_role` en T-408: el contrato lo exige aunque la enumeración de pgTAP se centra en la RPC definer y la FK. No se afirmó runtime.
- **H02:** `CC:127-145,171-175,258-261,282-286,311-312` nombra ambas RPC con `assert_admin_aal2()`, `FOR UPDATE`, auditoría y CC-031 B/C. `T-408:54-55,85` las permite. Compatibilidad verificada contra `20261018043250_cc031_courier_display_name_guard.sql` y el contrato anterior.
- **H03:** `CC:254-257` y `T-408:53,84` incluyen la suite `rpc_admin.sql` con invariantes nuevos de `merchants.notes`, sin debilitar el resto.
- **H04:** `CC:94-126` contiene solo el SELECT. Contra `20260922031435_schema_v1.sql:184-192` y `20261017090000_t369_publication_credits.sql:1652-1660` se confirmó que `audit_log.target_id` es texto, `id` es bigint y `target_type='merchant'`, en tanto `merchants.profile_id` es uuid: el casteo de la unión es válido. La consulta no devuelve el contenido de `nota_admin`. No se ha ejecutado en ambientes.
- **D3:** `CC:67-74,287-291` mantiene self policies y casos positivos/negativos por campo; `cc035_register_push_subscription.sql` no se modifica, según decisión del usuario.

## NO TOCAR / hallazgos descartados

- No revocar grants compartidos a `authenticated` de tablas con autoservicio. **Sí** revocar los de `audit_log`.
- No reintroducir `profiles_update_admin`, ni cambiar `assert_admin_aal2()` o los nombres de RPC.
- No tocar `supabase/tests/cc035_register_push_subscription.sql`: el caso admin con `aal1` de `register_push_subscription` es autoservicio intencional.
- No agregar tabla de notas ni ejecutar limpieza de `merchants.notes` sin revisión humana por ambiente.
- No usar un SQL «simulado» ni un test textual como prueba de seguridad de RLS.

## Por qué no alcanzan los checks

`verify-fichas.test.ts` comprueba rutas de bitácoras/revisión/fichas, no todas las permitidas (R01). La verificación textual de la revisión anterior detectaba presencia de D1/D3, no las afirmaciones contrarias que seguían vivas (H05). Las dos fallas se verificaron leyendo el mismo SHA, no con resultados hipotéticos de runtime.

## Cierre y próximos controles

**Estado:** CON BLOQUEANTES (2), nuevas decisiones: **ninguna**. Una vez corregidas las dos contradicciones documentales, ronda 3 sobre nuevo SHA. Antes de T-408 se requiere el paso humano de D2 por ambiente, **no ahora**. No aprobar ni mergear esta ronda.
