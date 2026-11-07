# Ronda 1 — PR #528 · T-412 / CC-039
Fecha: 2026-10-22 · Código inspeccionado: `f20ed0db2c8923885c80adbe1b5aa365e6e7d43c` · Base: `e30656fe6fd8b722d39fe16944fd29cb8b9f4461`

**Resultado: SIN BLOQUEANTES DE T-412. ACEPTACIÓN TÉCNICA.** No aprobar ni mergear automáticamente.

## Verificación de dependencias y alcance
- PR #527 está **merged**, y `docs/contracts/CC-039.md` existe en develop; el contrato en la rama coincide con el integrado.
- `develop` es ancestro del HEAD: GitHub compare devolvió `ahead=3, behind=0`, mergeable=true. No hay conflictos observados en la integración remota.
- La ficha T-412 se lee de develop; el diff de la ficha en #528 es únicamente D01: el alcance se amplió para permitir renombrar «Editar plan» / su diálogo a «Abono y piloto». Lautaro073 decidió **D01=A**. La implementación mantiene ambos cambios en el admin.
- Los 21 archivos del diff final están dentro de «Archivos permitidos» de la ficha de la rama, y los cambios de admin se limitan a textos / tests asociados. No se incorporaron dependencias nuevas.

## Inspección de contrato, SQL, aplicación y pruebas
- `get_publication_offer`: función `stable security definer` con `search_path = public, pg_temp`. Exige `auth.uid()`, rol merchant, consentimiento active y fila de alta; `revoke` a public/anon y `grant execute` solo a authenticated. Lee catálogo sin abrir políticas RLS; limita a 50 activos, ordenados por sort/id y sin `code`.
- Parámetros de crédito suelto y descuento se leen con `app_private.publication_setting_int`; el descuento desaparece al existir fila en `merchant_launch_discounts`. La RPC no escribe.
- UI: mensajes `wa.me` a número configurado, sin datos privados; controles inhabilitados si no hay número; precios informativos y error aislado.
- **H02:** en `publication-offer-section.tsx`, la variable `discount` se renderiza tanto con lista como con estado vacío. El test `PR528-H02` ejercita `plans=[]`, `looseCreditReferencePriceArs=null`, `launchDiscountPct=15`.
- **H03:** `publicationOfferPlanSchema.refine` obliga a que `quota` tenga créditos y `unlimited` tenga null. El test `PR528-H03` rechaza ambas combinaciones inválidas y acepta la válida.
- **H01:** resuelto por merge de #527 + merge de origin/develop en la rama sin rebase; head confirmado.
- **D01:** se acepta A. «Créditos y plan» enlaza a los créditos; «Abono y piloto» representa el diálogo de abono anterior/extensión de piloto y no la asignación de catálogo.

## CI real por SHA
- Run [#39839093772](https://github.com/cadeApp/cadeApp/actions/runs/39839093772) sobre `f20ed0db2c8923885c80adbe1b5aa365e6e7d43c`: `unit` SUCCESS — **168 archivos / 3289 tests**; `typecheck`, `lint`, `build` y `bundle-budget`: SUCCESS.
- `db-tests` job **120035724044**: SUCCESS. Log contiene `Applying migration 20261022180000_cc039_get_publication_offer.sql`, `supabase/tests/cc039_get_publication_offer.sql .......... ok`, **Files=38, Tests=3153, Result: PASS**; comparación posterior de `src/types/database.types.ts` completada exitosamente. Los otros `Result: FAIL` intermedios del mismo log pertenecen a verificaciones de mutación preexistentes y el job concluyó success.
- PR experimental [#529](https://github.com/cadeApp/cadeApp/pull/529) **closed, never merged**: el job 120009327256 falló al no encontrar `public.get_publication_offer()`, reproduciendo el RED de la nueva suite pgTAP sin migración.
- `audit`: FAILURE por **GHSA-2464-fhr4-w9xw** (crítica) y **GHSA-p3m5-59mp-jv5r** (alta) en Next.js existente. Está documentado fuera del alcance de esta PR en [#530](https://github.com/cadeApp/cadeApp/issues/530); **no es CI completamente verde ni licencia para desplegar una dependencia vulnerable**.

## Calidad de evidencia y límites
- Revisión propia de código y logs del CI ejecutados en el SHA indicado. Las pruebas RED→GREEN H02/H03 fueron declaradas por el autor en la bitácora y los tests GREEN quedaron ejecutados en CI; **no se reprodujeron localmente mutaciones independientes** por ausencia de clon / dependencias accesibles en el entorno de revisión. Se aporta el harness completo de reproducción en `evidencia/comandos.md`, validado solo sintácticamente.
- No se ejecutaron Docker ni Supabase local, no se usaron claves ni credenciales remotas y no se forzaron pushes.
- `E2E` local de `merchant-publication-offer.spec.ts`: pendiente **después de mergear en develop y ejecutar migrate-develop, antes de staging/main** según DoD. No se presume GREEN.
- El comentario y los archivos de revisión modifican el HEAD sin cambiar el código inspeccionado; por regla 10 no se exige un nuevo GREEN únicamente por esa documentación.

**Conclusión:** aceptación técnica de T-412 / CC-039 sin hallazgos bloqueantes remanentes. Mantener abierto el seguimiento de seguridad #530; no desplegar a producción con audit crítico sin resolver.
