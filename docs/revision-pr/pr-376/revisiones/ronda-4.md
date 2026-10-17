# Informe revisar-pr — PR #376 / CC-025 Fase B — Ronda 4

**Fecha:** 2026-10-16 · **Código auditado:** `9e194c346baa4366c402684cbc909a1cfb3445cf` · **Dictamen:** **SIN BLOQUEANTES NUEVOS DE IMPLEMENTACIÓN**. **Condición operativa para merge:** la rama está ahead 14 / behind 2 frente a develop y el commit de la revisión moverá el HEAD; integrar develop y obtener nuevamente CI + trusted E2E verdes sobre el SHA final. Este informe NO es una aprobación ni hace merge.

## Cambios inspeccionados
Se comparó el HEAD actual con el commit del informe R3 `7f901205` y con develop. La rama contiene los arreglos propios de onboarding en `src/features/courier-onboarding/actions.ts`, `actions.test.ts` y `e2e/specs/courier-onboarding.spec.ts`, bitácora y docs. Los archivos `docs/revision-pr/pr-377/**` y `docs/tasks/T-366.md` aparecieron en la comparación cronológica porque entraron desde un merge de develop; NO son modificaciones propias del diff final contra develop. Ningún archivo de `docs/revision-pr/pr-376/**` fue editado por el autor desde R3. No hay migraciones nuevas ni modificaciones a RPC B0 mergeada en esta PR.

### PR376-R01 (ALTO) — arreglado-sin-verificar
La spec E2E de onboarding positiva ya no inyecta rutas inexistentes. En `e2e/specs/courier-onboarding.spec.ts:337–524`, el actor courier de una fixture **segregada por test** sube realmente cuatro buffers PNG mediante los inputs de UI; se espera `data-status=success`, se cotejan los 4 paths canónicos `courier/<id>/<kind>_<timestamp>.png` persistidos en sessionStorage, se completa la UI y se comprueban 4 documentos `submitted/is_current` con paths iguales a los cargados y vehículo/DNI actualizados en DB. Cleanup en `finally` elimina documentos/Storage del usuario de prueba y lo restablece. La fixture `e2e/fixtures/roles.ts` crea un contexto de seed único por test con teardown global.

**Resultado del test real:** [trusted E2E run 38946438099](https://github.com/cadeApp/cadeApp/actions/runs/38946438099), job 117153680317, registra checkout explícito `HEAD is now at 9e194c3`; **78/78 Chromium PASS**, incluido `Flujo 1` (26.6s), y **3/3 global-settings PASS**. GitHub commit status exacto `e2e-preview=success`. **No se ejecutó Playwright por el revisor**, por eso no se atribuye verificación independiente runtime ni se completa `verificado_en_sha`.

### PR376-R02 (MEDIO) — arreglado-sin-verificar
`actions.ts:286–299` hace `adminClient.from('couriers').update(...).eq('profile_id',user.id).in('status',['pending','approved']).select('profile_id')` y después exige `error=null` y **exactamente una fila** en el RETURNING. Evita devolver `ok` si el courier quedó `suspended` o `rejected` entre el COMMIT de la RPC B0 y este UPDATE. Tests `actions.test.ts` casos t–x cubren status bloqueados (0 filas), pending/approved (1 fila) y error DB. El autor documentó RED quitando el guard de cardinalidad y GREEN al restaurarlo; CI de 2442 unit pasa.

La corrección del predicado y cardinalidad es real por inspección. Los tests t/u son unit mocks que simulan 0 filas y no reproducen una carrera PostgreSQL; la transacción de documentos y el UPDATE de metadatos siguen siendo dos operaciones. No declarar atomicidad completa con consentimiento/rol, y no exigir ampliación nueva sin una necesidad demostrada.

## Hallazgos de rondas previas
PR376-H01/H02/H03 continúan `arreglado-sin-verificar`: la aplicación usa RPC B0 transaccional y la CI de DB prueba simultaneidad de paths iguales/distintos, idempotencia y rechazo de status/documents; la mutación SQL `FOR UPDATE` produce 8 filas RED y 4 GREEN cuando se restaura. **La RLS legacy todavía permite INSERT directos con otra ruta** hasta fase C: limitación transitoria **explícitamente aceptada para B0**, NO corregida como garantía global. La fase C #364 debe cerrar el bypass con índice/RLS una vez que B esté desplegada y se haya descartado tráfico legacy.

## CI sobre SHA auditado y límites
- [CI run 38946283341](https://github.com/cadeApp/cadeApp/actions/runs/38946283341) SUCCESS, todos los jobs: `unit` **135 suites/2442 tests PASS**, `db-tests` **26 archivos/2341 pgTAP PASS**, typecheck, lint, build, audit, bundle-budget success. Logs db-tests: B0 multisesión PASS; mutación RED 8 doc vs GREEN 4 doc.
- [E2E run 38946438099](https://github.com/cadeApp/cadeApp/actions/runs/38946438099) SUCCESS, checkout SHA `9e194c346baa4366c402684cbc909a1cfb3445cf` en job de confianza; **78/78 Chromium, 3/3 global-settings**; commit status `e2e-preview=success`. `approval-policy` y Vercel OK en HEAD exacto.
- No se levantó Docker/Supabase local ni se ejecutó runner E2E desde la sesión de revisor, siguiendo instrucciones de costo. No mutaciones independientes, no inferir `arreglado-verificado` a partir del autor.
- Rama `ahead=14, behind=2` vs develop, Github `mergeable=true` al iniciar ronda. Una nueva integración de develop debe seguirse de checks y E2E del SHA actualizado, no usar la evidencia de `9e194c346baa4366c402684cbc909a1cfb3445cf` como sustituto.
- La PR está abierta; no se aprobó ni mergeó #376, #364 ni #358, ni se ejecutó migración remota ni se cerró issue #363. No hay decisiones nuevas de producto.

**Condición final:** **apta funcionalmente para merge una vez que** el autor integre `origin/develop` con merge sin force/rebase, se comprueben todos los checks y `e2e-preview` verdes en el nuevo HEAD, y Lautaro073 autorice expresamente el merge de #376. Fase C continúa bloqueada hasta despliegue y verificación de B en el entorno objetivo.

[Prompt de continuidad](../prompt-agy-ronda-4.md) · [Evidencia](../evidencia/ronda-4.md) · [Hallazgos](../hallazgos.jsonl).
