# Ronda 4 — revisión independiente PR #360 / T-359

**SHA inspeccionado:** `efb22c421b1ded80f48380fef4edc9e4981831f5` · **Base develop:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b` · **Fecha:** 2026-10-15.

**Conclusión: SIN NUEVOS BLOQUEANTES DE CÓDIGO POR INSPECCIÓN. CON BLOQUEO DE MERGE POR EVIDENCIA E2E PENDIENTE.** No se aprueba ni mergea. La PR está abierta, Ready for review y GitHub informa mergeable=true, lo cual no reemplaza el DoD.

## Alcance y proceso

1. Lectura previa: `docs/revision-pr/COMO-ENTREGAR.md`, catálogo `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, ficha `docs/tasks/T-359.md` desde `develop`; luego comentarios, bitácora, diff completo de la PR y compare `2385f54b...efb22c42`.
2. Únicamente 3 archivos alterados desde ronda 3: `e2e/specs/main-flow.spec.ts`, `docs/tasks/log/T-359.md` y títulos de dos tests en `src/features/requests/components/request-offers.test.tsx`. Todos son permitidos.
3. **Corrección de proceso de la revisión:** como asako669 es P2, la documentación de esta ronda pertenece a `docs/revisiones`; las tres rondas anteriores se conservaron/copiarán desde la feature sin mover su HEAD. Las rondas previas sí movían la rama funcional, en contradicción con COMO-ENTREGAR.
4. No hay modificaciones nuevas a RPC, RLS, SQL, migraciones, src/domain, src/ui, src/server ni .github.

## Comprobación de R01 (parcial anterior → arreglado-sin-verificar)

**`e2e/specs/main-flow.spec.ts:143–183`**: `loserIndex` ahora se captura al observar `alreadyMatchedAlert` en `expect.poll`, luego selecciona los contextos y espera la URL del ganador. Se abandona la heurística «el primero en /trips ganó». Se verifica además que el perdedor no conserva Aceptar antes del `goto`. Diseño acorde al error de concurrencia, sin ejecución real de Playwright. La alerta puede ser temporal si el refresh redirige de inmediato: observar en Preview; no afirmar fallo de carrera sin reproducción.

## Comprobación de R02 (abierto → arreglado-sin-verificar)

**`e2e/specs/main-flow.spec.ts:260–286`**: primero `reload()` en /trips y asserts de estado/identidad/monto/sin Aceptar; después `goBack()` sin asumir que el historial siempre termina en /trips; finalmente `goto('/merchant/requests/id')` y comprobar redirección al viaje. Resuelve la contradicción de `router.replace` con el Back específico que marcó la ronda 3. La prueba de Back debe validarse en navegador real para descartar intermitencia por redirección.

## Comprobación de H05 (parcial, pendiente de E2E)

**`e2e/specs/main-flow.spec.ts:185–290`**: dos `browser.newContext()` y login independiente, oráculo `acceptedCount=1`, coincidencia `acceptedOfferId`, courier real por `stagingContext.courierUsers` y `acceptedOffer.courierId`, nombre en heading, monto `formatArs`, medio de pago `Efectivo` (fixture siembra `recipient_payment_method:'cash'`), WhatsApp enlazado al teléfono del courier. `acceptedOffer` ya no puede faltar en silencio. Reusa la verificación de privacidad prematch al comienzo del spec; la vista del viaje no expone contactos pre-match.
**No hay check `e2e-preview` sobre `efb22c421b1ded80f48380fef4edc9e4981831f5`.** No es evidencia válida que el test exista, que CI unit pase, ni que Vercel haya terminado el deployment. La ficha exige Preview + Supabase Develop con run, job, SHA y resultado real. **Bloquea merge.**

## H02 y H07

- H02: latch `isReconciling` permanece en producción; no fue alterado. Test de no botones tras ALREADY_MATCHED y REQUEST_EXPIRED permanece unit green, pero mutación independiente no se ejecutó. Los dos títulos de test ahora no prometen el segundo click que no ejecutan; mejora documental.
- H07: bitácora de ronda 4 reconoce expresamente que los logs RED previos de H01/H06 no se conservaron; RED/GREEN de H02 está documentado como evidencia del autor. No inventar salidas históricas ni etiquetar `arreglado-verificado`. La carencia de mutación independiente queda anotada para futura ejecución.

## CI verificado / no verificado

| Check (HEAD del autor) | Estado al consultar |
|---|---|
| `unit` | SUCCESS: 130 suites Vitest; 79 workflow; 6 ADR (logs GitHub Actions) |
| `typecheck`, `lint`, `build`, `audit`, `bundle-budget` | SUCCESS |
| `db-tests` | IN PROGRESS al cierre de lectura (no atribuir PASS a este SHA) |
| `e2e-preview` | NO FIGURA en check-runs; no hay run/resultado |
| `approval-policy` | FAIL: «El PR requiere aprobación vigente de Lautaro073»; no es fallo de tipos ni compilación |
| Mutaciones/E2E locales del revisor | NO EJECUTADAS, porque no hay checkout/pnpm y no debe fabricarse evidencia |

## Cierre y recomendación

No hay más modificaciones de implementación exigibles por lectura actual. **No mergear** hasta obtener una corrida E2E Preview real y exitosa en SHA final, o registrar de forma explícita el bloqueo y resolver su causa dentro de un CC/flujo separado autorizado; no desactivar el gate ni activar `skip`/mocks. El bloqueo de `approval-policy` se resuelve mediante la aprobación de Lautaro073, **sólo cuando él decida aprobar y la validación esté completa**. La revisión no aprueba ni mergea y no pide nuevas decisiones de diseño.

**No se repiten como bloqueantes los defectos de R01/R02/H02 ya corregidos por inspección.**
