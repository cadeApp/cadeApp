# Revisión independiente — PR #364 / CC-025 / T-356 — Ronda 5

**Fecha local:** 2026-10-16 · **SHA auditado:** `d0924270b8da6aaefd087c336b7e330339053be0` · **DICTAMEN: CON BLOQUEANTES (2 nuevos ALTOS: R06 y R07; gate R04 PARCIAL). NO APROBAR NI MERGEAR.**

**Decisión de Lautaro073 confirmada:** opción **A: revocar completamente INSERT directo para authenticated sobre courier_documents**, centralizar writers en `submit_courier_onboarding_documents` y `replace_courier_document`. Es independiente de la opción A anterior de rollout **EXPAND → B0 → APP → CONTRACT**, que continúa vigente. No volver a consultar.

## Estado general
`develop...PR`: ahead=26, behind=0; GitHub mergeable true. El writer B0 implementado en PR #376 se preservó sin volver al upsert legacy. Migración de C `20261016210000_cc025_courier_document_replacement.sql` correctamente posterior a A y B0, elimina guard expansivo y define backfill con retención 30 días desde obsolescencia, índices únicos parciales, permisos UPDATE/DELETE restringidos y RPCs de reemplazo/verificación con orden uniforme de locks. Los diez hallazgos históricos H01–H07/R01–R03 se mantienen `arreglado-sin-verificar` por fuente+CI, sin ejecución independiente de mutaciones por el revisor.

**R05:** arreglado-sin-verificar por descomposición A/B0/B en develop; **R04:** parcial hasta que B esté REALMENTE desplegada en staging antes de C. `.github/workflows/migrate.yml` corre SQL **antes** de `deploy.yml`; una afirmación en Markdown no cumple el gate. `main` también pendiente. Evitar promover C junto con B sobre staging con writer viejo.

## Bloqueante PR364-R06 (ALTO) — prefijo Storage no literal
En `supabase/migrations/20261016210000_cc025_courier_document_replacement.sql:158-162`, la cláusula `NOT LIKE ('courier/' || uid || '/' || kind || '_%')` interpreta los `_` como comodines, inclusive dentro de `dni_front`. `licenseX1700000000000.png` coincide con `license_%`. La policy real de Storage (RLS v1, líneas 491–499) controla carpeta del courier, no el nombre del archivo. Si existe el objeto bajo su carpeta, la RPC podría aceptar un archivo cuyo nombre no corresponde al kind. Es inferencia por semántica SQL, **no un exploit ejecutado**.

Corregir con prefijo literal `courier/<uid>/<kind>_` usando `left`/ `starts_with`, sufijo `<timestamp>.<ext>` compatible con `buildCourierStoragePath`, no subcarpetas/traversal y consulta de existencia de Storage. PgTAP con documento rechazado y objetos presentes `licenseX...` / `license_...`: falso retorna `VALIDATION_ERROR`, 0 nuevas filas/eventos; verdadero reemplaza. Mutación sobre SQL real volviendo al LIKE debe dar RED con la MISMA prueba; restituir GREEN. Repetir para `dniXfront_`.

## Bloqueante PR364-R07 (ALTO) — INSERT directo inicial habilitado
La policy `courier_documents_insert_self` (C SQL líneas 84–104) deja a `authenticated` insertar el primer documento de un kind aun con `storage_path` falso o inexistente; el único índice parcial impide segundos vigentes, no la primera inserción indebida. `supabase/tests/cc025_courier_document_replacement.sql:201–215` afirma que ese INSERT directo DEBE funcionar. Es comportamiento del CC anterior que **el usuario acaba de descartar expresamente**, no desobediencia al viejo diseño.

**Opción A aprobada:** en C eliminar `courier_documents_insert_self` y `REVOKE INSERT ON TABLE public.courier_documents FROM public, anon, authenticated`, además de UPDATE/DELETE. Preservar SECURITY DEFINER, owner y EXECUTE de B0/replace; no alterar A/B0 ya mergeadas. PgTAP bajo rol authenticated: `has_table_privilege(...,'INSERT')=false`, INSERT inicial denegado `42501`, 0 filas; positivos bajo actor autenticado vía RPC B0 y replace tras rechazo, con documento verificado intacto. Mutación en DB efímera restaurando GRANT+policy -> RED real; restauración -> GREEN. No falsear mocks, tests o fixtures.

## Evidencias y límites
[CI #38986094196](https://github.com/cadeApp/cadeApp/actions/runs/38986094196) sobre SHA auditado: **137 suites/2484 unit PASS; 27 archivos/2406 pgTAP PASS**; checks lint/typecheck/build/audit/bundle-budget/approval-policy verdes. DB runner del autor documenta mutación real de locks B0+C (RED 40P01/GREEN 0 deadlocks) y backfill (RED fecha incorrecta/GREEN correcto). Estas ejecuciones NO cubren R06/R07 y el revisor no las reprodujo en Docker ni Supabase por decisión expresa de costo.

`e2e-preview=error: BLOCKED / REQUIRES DEVELOP MIGRATION` sobre SHA exacto; **NO éxito E2E**. No instalar C remotamente como atajo. El test E2E post-migración autorizada sigue pendiente. No se ejecutaron SQL remotos ni propios; `verificado_en_sha` de todos los hallazgos permanece null. No se detectaron ediciones del autor a `docs/revision-pr/pr-364/**` desde R4. No se corrió `analizar.mjs` sin clon local.

**No mergear #364, no comenzar #358 ni cerrar #363.** [Prompt agy](../prompt-agy-ronda-5.md) · [Evidencia](../evidencia/ronda-5.md).
