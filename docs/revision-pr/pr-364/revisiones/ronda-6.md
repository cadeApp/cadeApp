# Informe independiente — PR #364 / CC-025 / T-356 — Ronda 6

**Fecha:** 2026-10-17 (Argentina) · **SHA funcional auditado:** `f6168c03fedaa34d843c4192f46c6af1aae7b680` · **Rama:** `cc/CC-025-courier-document-replacement` · **Dictamen: SIN BLOQUEANTES FUNCIONALES NUEVOS; R06/R07 ARREGLADOS POR INSPECCIÓN + CI, SIN EJECUCIÓN INDEPENDIENTE. NO LISTA PARA MERGE por gate R04 PARCIAL y e2e-preview BLOQUEADO.** No aprobar ni mergear.

## Alcance, cambios desde R5 y decisión humana
Desde el commit independiente R5 `fede5696` hay 9 commits y merge(s) de develop. El diff FINAL contra develop (ahead 35 / behind 0) muestra cambios propios de CC-025 en migración C, tests SQL y runners, contrato y bitácora. Los archivos de T-363/PR386, ofertas, rutas, privacidad y mapas que aparecen en la comparación CRONOLÓGICA proceden de merge de develop, **no** son cambios propios de la PR actual. Ningún autor editó `docs/revision-pr/pr-364/**` después de R5. La única excepción de allowlist consentida explícitamente por Lautaro073 fue `supabase/tests/rls_matrix.sql`; se limita a esperar rechazo SQLSTATE 42501 y comprobar cero filas.

Decisiones vigentes: rollout **A: EXPAND → B0 → APP → CONTRACT** y **A nueva: prohibir todo INSERT directo authenticated sobre `courier_documents`**. No hay nueva decisión de producto que consultar en esta ronda.

## PR364-R06 (ALTO previo) — arreglado-sin-verificar
En `supabase/migrations/20261016210000_cc025_courier_document_replacement.sql:142–155`, `replace_courier_document` forma `v_expected_prefix := 'courier/' || v_actor_id::text || '/' || v_kind_text || '_'` y exige coincidencia de prefijo **literal** mediante `left(v_storage_path,length(v_expected_prefix)) <> v_expected_prefix` (rechazo), prohíbe `..` y subrutas, y exige sufijo `^[0-9]+[.](png|jpe?g|webp|pdf)$`. Conserva comprobación de objeto en `storage.objects` con bucket correcto.

La pgTAP C incorpora objetos existentes malnombrados `licenseX1700000000000.png` y `dniXfront_1700000000000.png`, ambos rechazados con `VALIDATION_ERROR`, sin nuevas filas ni eventos; además prueba reemplazo positivo de `license_1700000000000.jpg`. El runner `cc025_concurrency.mjs` muta la **definición SQL original** de replace sustituyendo la comparación literal por el `LIKE` vulnerable, invoca la RPC autenticada y **observa aceptación indebida de licenseX (RED)**, restaura SQL y obtiene **rechazo del path malo + éxito del correcto (GREEN)**. En [CI 38993728305](https://github.com/cadeApp/cadeApp/actions/runs/38993728305) se imprimen ambos resultados.

**Alcance de la evidencia:** la variante dniXfront se rechaza en una validación que precede al control de estado, no constituye por sí sola prueba de reemplazo exitoso de DNI previamente rechazado. La mutación específica licenseX sí demuestra que el prefijo literal evita la aceptación que ocurría con LIKE. No se ejecutó mutación independiente del revisor.

## PR364-R07 (ALTO previo) — arreglado-sin-verificar
Migración C líneas ~63–70: `REVOKE INSERT, UPDATE, DELETE ON TABLE public.courier_documents FROM public, anon, authenticated`, `DROP POLICY IF EXISTS courier_documents_write_admin` y `DROP POLICY IF EXISTS courier_documents_insert_self`. A/B0 ya mergeadas permanecen inalteradas. Se conservan EXECUTE de RPC B0 y replace `SECURITY DEFINER` para actor authenticated y privilegios técnicos service_role.

La pgTAP C verifica `has_table_privilege('authenticated',...,'INSERT') = false`, `anon` sin INSERT, INSERT/UPSERT directo inicial con ruta propia, falsa o ajena rechazado con 42501, conteo cero; **alta por RPC B0** authenticated con documentos actuales y **replace** autenticado tras rechazo siguen permitidos. `supabase/tests/rls_matrix.sql:540–554` modifica exactamente el positivo legacy `lives_ok` por `throws_ok(..., '42501')` y un `is(count,0)`, conforme la excepción autorizada, sin deshabilitar controles ni alterar otras reglas.

Runner de mutación de CI reintroduce `GRANT INSERT` + policy `insert_self` en SQL real y observa **1 inserción no autorizada (RED)**, restituye C y exige `42501 + 0 filas (GREEN)`. Los logs oficiales confirman estas propiedades, no un simple error genérico.

## Controles oficiales del SHA funcional
- [CI 38993728305](https://github.com/cadeApp/cadeApp/actions/runs/38993728305): **SUCCESS**. Unit **137 suites / 2515 tests**, DB **27 archivos / 2420 pgTAP PASS**; typecheck, lint, build, audit, bundle-budget y approval-policy success, tipos `db:types --local` regenerados y diff tipos limpio. Runner B0 8 documentos RED sin lock / 4 GREEN, C multisesión, mutación deadlock 40P01 RED/GREEN, backfill retención RED/GREEN, y nuevos R06/R07 RED/GREEN reales, ejecutados por Actions del autor.
- **E2E Preview sobre SHA funcional:** estado `error: BLOCKED / REQUIRES DEVELOP MIGRATION` ([run 38993803372](https://github.com/cadeApp/cadeApp/actions/runs/38993803372)); Supabase Preview skipped, Vercel success. No afirmar 80/80 E2E post C. No aplicar C remotamente como atajo.
- Comprobación `develop...HEAD`: ahead=35/behind=0, GitHub `mergeable=true` pero `mergeable_state=unstable` por gate. Sin verificación independiente de PostgreSQL, Docker ni tests locales (instrucción expresa de costo). El revisor no se atribuye los mutantes de CI y deja `verificado_en_sha=null` para los hallazgos.

## Dependencia pendiente R04 — gate operativo no ejecutado
La fase B está mergeada en `develop` (PR #376), pero el contrato advierte que staging usa aún escritor `.upsert()` y no tiene A+B0 aplicadas. `migrate.yml` ejecuta migración **antes** que `deploy.yml`; promover C sobre staging legacy rompería el onboarding. **No mergear #364 a develop antes de acordar y ejecutar un corte B-only seguro para staging**, o una alternativa equivalente aprobada y comprobada: preservar SHA B-only pre-C, promover A+B0+B a staging, confirmar `migrate-staging` + `deploy-staging` SUCCESS, comprobar versión activa y RPC B0, compatibilidad E2E y ausencia del writer legacy; recién después considerar C, y posteriormente main. El documento contractual no es prueba del gate.

**Próximos pasos:** mantener #364 abierta sin aprobación/merge, no arrancar #358 ni cerrar #363. La próxima intervención debe ser verificar el gate de B-only en staging con autorización expresa de Lautaro073, luego nueva verificación de CI/E2E del HEAD aplicable tras C en entorno autorizado. No exige ronda 7 de implementación si el código CC-025 propio no cambia.

[Prompt de continuidad](../prompt-agy-ronda-6.md) · [Evidencia y límites](../evidencia/ronda-6.md) · [Hallazgos](../hallazgos.jsonl).
