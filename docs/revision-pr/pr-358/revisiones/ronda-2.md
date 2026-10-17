# PR #358 — T-356 — Revisión independiente Ronda 2 (2026-10-17)

**RESULTADO: CON BLOQUEANTES. NO MERGEAR.**
Rama: feat/T-356-recarga-documentos-rechazados. SHA funcional auditado: affe835b8ea075519159ea888cc1e30e3c184d52. HEAD documental: 78b2e79bcaeff540604f23951c9f4331fa2fa95b. Base PR develop@293c3a2; develop ya avanzó tres commits de documentación a c4dd918.

## Aspectos correctos
El CC-025 está mergeado y su migración C aplicada en Develop; SQL revoca INSERT directo y garantiza índice único vigente. La Server Action valida sesión/rol/prefijo literal y usa replace_courier_document con cliente autenticado. Consultas de courier filtran is_current y proyectan motivo público; notas audit_log privadas no se consultan. Admin distingue históricos y deshabilita revisión, con respaldo RPC. Cambios dentro de allowlist. H01/H02 de Ronda 1 pasan a arreglado-sin-verificar por lectura + CI del autor, no por ejecución propia.

## Bloqueantes
**PR358-R01 ALTO.** document-replacement-card.tsx:49-102 sube cada vez con nuevo timestamp y crea crypto.randomUUID después del upload. Ante commit RPC y respuesta perdida, reintento cambia path/key y puede fallar INVALID_STATE_TRANSITION. Si RPC falla después de subir, archivo sin fila DB no es elegible para el cron sweep.ts:138-157; policy de storage sólo da INSERT al courier. Conservar intento (path, key, file) y repetir misma RPC sin resubir; diseñar limpieza segura sin abrir DELETE indiscriminado. Test falsador: DB commit, respuesta perdida y retry deben conservar un solo upload y la misma clave/path.
**PR358-R02 MEDIO.** status-view.tsx:96-153,205-238 computa checklist de props iniciales y no utiliza callback onReplaced, mientras tarjeta hija muestra submitted; en CourierProfileView el badge exterior también es stale. Propagar al padre y verificar salida de rechazado tras éxito sin cambiar otros kinds. Test RED si se omite refresh.
**PR358-R03 MEDIO.** E2E courier-onboarding.spec.ts:812-955 siembra rejected directamente con service role en vez de rechazar mediante admin_verify_document, y no inspecciona la vista admin de nueva versión submitted. Agregar prueba real de rechazo admin -> motivo courier -> reemplazo -> revisable admin, histórica bloqueada.

## CI y limitaciones
GitHub Actions CI 39019886169 sobre 78b2e79b pasó unit (137 suites / 2543), db-tests (27 archivos / 2420 pgTAP PASS), lint, typecheck, build, audit, bundle. approval-policy 39019933041 SUCCESS.
e2e-preview 39019961766: resolve success, ejecución E2E cancelled, report publicó status ERROR. **NO PASÓ** la nueva prueba E2E.
Esta revisión usó lectura de código y logs GitHub, SIN ejecución propia de tests/DB/mutaciones. Las mutaciones RED-GREEN declaradas en bitácora son del autor. No presentar hallazgos como verificados en runtime.

## Continuidad
Decisiones 1C,2C,3B,4C y retención 30 días vigentes; sin nueva decisión humana en esta ronda. No tocar migraciones CC-025, .github, scripts CI ni docs/revision-pr desde agy. Agy corrige y prueba cambios funcionales, luego pide ronda 3. No exigir CI nuevo por commit exclusivamente documental de esta revisión; sí por fixes funcionales y E2E real. No aprobar/mergear #358 ni promover C a staging/main, issue #363 abierto. El prompt completo aparece en el mismo comentario de la PR que este informe.
