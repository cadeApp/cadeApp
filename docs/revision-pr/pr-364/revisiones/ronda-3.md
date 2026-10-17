# Informe independiente — PR #364 / CC-025 — ronda 3

**SHA funcional auditado:** `6c1d124ce17e271858915df3bb57de9beeb1aa6e` · **Fecha:** 2026-10-15 · **Resultado: CON BLOQUEANTES. NO MERGEAR.**
**Decisiones cerradas:** 1C,2C,3B,4C y retención B (30 días desde reemplazo). Ninguna consulta de producto nueva.

## Evidencia del HEAD
GitHub Actions [run 38702747664](https://github.com/cadeApp/cadeApp/actions/runs/38702747664): **133 suites / 2254 unit**, **23 archivos / 2262 pgTAP**, typecheck, lint, build, audit y bundle-budget PASS. Los logs demuestran migración cc025 aplicada y tipos generados. Este revisor no ejecutó SQL en entorno local/remoto ni mutaciones funcionales independientes, por lo que un CI GREEN no se registra como `arreglado-verificado`. RED/GREEN en dicho run son de T-340 y CC-024, no CC-025.

## Ronda 2: seguimiento
- **H01, H03, H04, H07**: corregidos por inspección y respaldados por pgTAP, pendientes de mutación independiente.
- **R01**: corregido por inspección: writer cambió de `upsert` a `insert`, tests reales muestran INSERT admitido y ON CONFLICT DO UPDATE denegado.
- **R02**: corregido por inspección: policy incorpora `idempotency_key IS NULL`, pgTAP de bloqueo de INSERT con key pasa.
- **H05**: parcial. Recovery del onboarding maneja `23505` pero no `42501` causado por RLS bajo carrera (R03).
- **H02**: parcial. Orden courier→document consistente pero sin prueba multisesión de CC-025. La declaración de que CI no admite sesiones simultáneas es incorrecta: el job db-tests **sí ejecuta** `supabase/tests/integration/t340_concurrency.mjs` y `cc024_atomic_concurrency.mjs`; esas prueban otras RPC.
- **H06**: parcial. Backfill usa `now()+30 days` correcto, pero pgTAP inserta histórico **después** de aplicar migración y replica manualmente la sentencia SQL. Mutar la migración original no afectaría ese test.

## NUEVO PR364-R03 — ALTO — idempotencia rota en carrera con RLS
En `src/features/courier-onboarding/actions.ts:182–245`, la app lee docs actuales y luego inserta. SQL `courier_documents_insert_self` incluye `NOT EXISTS` de documento vigente. Interleaving: A lee vacío; B inserta los cuatro documentos y COMMIT; A ejecuta INSERT con datos idénticos. La RLS lo rechaza con **SQLSTATE 42501** por existencia, aunque los paths sean idénticos. La propia pgTAP CC-025 sección 3 demuestra que una inserción duplicada produce `violates row-level security`; en cambio el código sólo ejecuta reconciliación para `23505` o mensajes `unique`. Resultado: `INTERNAL_ERROR` al reintento legítimo. Esto surge por inspección del control real, no por ejecutar dos sesiones sobre este escenario.

**Arreglo:** mantener INSERT/RLS/REVOKE. Probar recovery de error RLS 42501 sólo si actor/consent siguen autorizados, relectura actual confirma TODOS los kinds vigentes, paths exactos y estados permitidos; caso contrario no devolver success. No aceptar cualquier 42501 indiscriminadamente. Tests: primer SELECT vacío + INSERT 42501 + relectura válida → éxito; relectura con faltantes/path diferente/consent inválido → error; escenario dual-sesión real; mutación quitar recovery → RED manteniendo aserciones.

## NUEVO PR364-R04 — MEDIO — rollout documentado invierte orden seguro
El contrato `docs/contracts/CC-025.md`, sección Compatibilidad/rollout, propone **primero** migración (revoca UPDATE), **después** frontend/backend con `insert`. Durante la ventana, la versión vieja de la Server Action utiliza UPSERT y requiere UPDATE, bloqueando el primer onboarding. **Arreglo:** desplegar/verificar el nuevo writer INSERT **antes** de aplicar la migración; establecer matriz DB antigua/app nueva y DB nueva/app nueva, condición que prohíba DB nueva/app antigua, y rollback adecuado.

## Pruebas de seguridad todavía obligatorias
1. H02: reutilizar patrón de CI de scripts de dos conexiones, pero con RPC reales `admin_verify_document` y `replace_courier_document`; carreras en ambos órdenes sin SQLSTATE 40P01, único current, auditoría correcta. No atribuir tests T-340 a CC-025.
2. H06: preparar fixture de duplicados previos a aplicar la migración real en DB efímera de CI y probar retención, unicidad y backfill. RED al mutar el SQL de migración original a `uploaded_at+30 days`, no al mutar copia del test.
3. H01/H03/H04/H07/R01/R02: mutaciones independientes de código producción, con mismas pruebas y fixtures, antes de cambiar estado a `arreglado-verificado`.

## Integración
Al consultar: branch ahead 13/behind 1 respecto de develop, GitHub mergeable=true. Integrar último develop mediante MERGE, no rebase, repetir CI en nuevo SHA. No se hizo merge/approval. Fuera de alcance de esta revisión implementar T-356 UI (PR #358).

**Ver:** [Prompt para agy](../prompt-agy-ronda-3.md) · [evidencia](../evidencia/ronda-3.md).