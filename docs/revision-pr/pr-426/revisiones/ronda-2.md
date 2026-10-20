# Informe revisar-pr — PR #426 — Ronda 2

**Fecha:** 2026-10-19  
**HEAD funcional verificado:** 497172151c4ea003bb883ed27b7ee46138587f43  
**Staging base:** fb7db3f035251a78e5a9e32f5e3465735a36ba4f  
**Develop integrado:** d9b49647f484b5f1b5a502225e9f3b6f95d7402a  
**Estado:** **SIN BLOQUEANTES TÉCNICOS DE INTEGRACIÓN (0)**. **DRAFT. NO MERGEAR, NO APROBAR Y NO PROMOVER**.

## Cambios y compatibilidad

1. El commit 49717215 es merge real de padres 3340ea3ad9465e854718822c5b3212cdaa40c523 y d9b49647f484b5f1b5a502225e9f3b6f95d7402a. El segundo es el HEAD observado de develop; staging continúa en fb7db3f035251a78e5a9e32f5e3465735a36ba4f. La PR se verificó abierta, Draft y mergeable.
2. El diff de release respecto de develop actual contiene sólo documentos históricos de revisión y **cuatro personalizaciones de staging**: src/app/(public)/layout.tsx, src/app/layout.tsx, src/app/page.tsx y src/app/icon.svg. Se inspeccionó el contenido de esos archivos y no se observó pérdida de flujos ni cambios funcionales de release ajenos a la integración. Los 32 conflictos del merge funcional inicial son evidencia previa de ronda 1, no reejecutada aquí.
3. El árbol de release incluye **39 archivos de migración**, igual que develop; staging contiene **33**. Seis archivos pendientes, exactamente:
   - 20261016210000_cc025_courier_document_replacement.sql
   - 20261017090000_t369_publication_credits.sql
   - 20261017150000_cc030_courier_docs_orphan_reconciliation.sql
   - 20261017200000_t369_admin_list_publication_plans.sql
   - 20261018043250_cc031_courier_display_name_guard.sql
   - 20261019060000_cc032_request_cancellation_history_rpc.sql

   Comparación exclusiva de árbol Git: **no acredita el historial remoto** de supabase_migrations.schema_migrations ni la recuperabilidad del backup.
4. La PR #427 (T-374) ya está integrada. El job E2E de staging tiene timeout de 45 min, conserva el descubrimiento de todas las specs Chromium, --workers=1 y fallo obligatorio ante errores; no se añadió skip, only ni continue-on-error. El test de workflows exige 45 min. deploy.yml espera migración y despliegue antes de llamar al reusable E2E, propagando el SHA objetivo.
5. T-375 sólo está autorizada documentalmente en develop; su implementación no está presente. Las pruebas global-settings se excluyen intencionalmente de staging porque cambian settings compartidos. No se consideran aprobadas por esa exclusión.

## Checks del SHA revisado (GitHub, no ejecución local)

- [CI 39335801078](https://github.com/cadeApp/cadeApp/actions/runs/39335801078), intento 1: **success** para unit, typecheck, lint, db-tests, audit, build y bundle-budget.
- Log unit: **148 archivos/2890 pruebas Vitest passed**, workflows **79/79**, ADR **6/6**.
- Log db-tests: **Files=31, Tests=2868, Result: PASS**; hay fallos RED deliberados durante mutaciones, pero la restauración arroja PASS final.
- approval-policy: success sobre 49717215. Supabase Preview: skipped; **no contado como PASS**. No se ejecutó ni se certificó un E2E real de staging antes de su despliegue.
- Método de ronda 2: inspección remota de SHA, padres, diff incremental, archivos clave y logs CI. **No** hubo clone local, Docker, Supabase remoto, nuevos tests de runtime ni mutaciones independientes de timeout. La mutación RED→GREEN de T-374 fue reportada por la revisión de #427, y no se presenta aquí como ejecución propia.
- El commit que registra esta ronda sólo modificará docs/revision-pr/pr-426/**. La validación técnica apunta siempre a 49717215; **no exigir nuevo GREEN de CI sólo por documentación**, siguiendo la regla décima.

## Hallazgos y decisión

**BLOQUEANTES TÉCNICOS NUEVOS: 0.** Sin registros nuevos en hallazgos.jsonl.  
**MEJORAS: 0.**

**Decisión expresamente recibida:** A, 2026-10-19. Seguir con lote actual **sin implementar T-375 en esta PR**. T-375 sigue su ciclo independiente. La opción A permite continuar **hacia el preflight**, no autoriza merge ni cambio en ambiente remoto.

## Preflight obligatorio — todos los puntos sin verificar operativamente

- [ ] Confirmar, mediante revisión de configuración **sin revelar los valores sensibles**, que Supabase Develop, Staging y Production son proyectos separados. Comprobar existencia, integridad e historial de migraciones en Staging, incluida la tabla supabase_migrations.schema_migrations, contra las seis previstas.
- [ ] Acreditar **backup previo** con posibilidad real de restauración, responsable, ventana operativa y plan de detención. Prohibido ejecutar migraciones manuales, Supabase remoto o db push de laptops.
- [ ] Revisar environments de GitHub staging y Vercel **cadeapp-staging** independiente, URL pública, mapeo a Supabase Staging, Auth (email/SMTP/redirects), bucket privado courier-docs y sus permisos, Maps, VAPID, cron y Discord; no copiar secretos ni datos personales.
- [ ] Mantener pilot_active=true, y COURIER_DOCS_ORPHAN_PURGE_MODE=dry-run; **no** habilitar enforce, cobros, main ni producción.
- [ ] Registrar preflight sin secretos ni PII y **solicitar autorización nueva y expresa** a Lautaro073 para el merge. Mientras no exista, la PR sigue Draft y sin merge.

## Solamente DESPUÉS de la eventual autorización

1. Merge a staging por responsable; registrar SHA de merge; migrate-staging y db:types sin drift sobre ese SHA, comprobar las seis migraciones. Ante un error, detener antes del deploy.
2. deploy-staging al proyecto Vercel correcto sobre el mismo SHA, health HTTP 200 y E2E staging Chromium completo, sin interpretar cancelled/skipped como PASS. global-settings no se ejecuta en staging.
3. Smoke manual con cuentas de prueba: registro/confirmación/restablecimiento Auth, admin AAL2, documentos privados/reemplazo courier, publicación gratuita/créditos T-369, multi-drop, ofertas, cancelaciones/historial, mapas/push/cron; registrar lo pendiente T-319/T-310 según sus tareas.
4. No tocar main, production, pilot_active ni purge enforce.

**DICTAMEN:** integración técnica apta para **preflight**. **NO apta todavía para ejecutar la promoción**.
