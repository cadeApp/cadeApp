# Informe revisar-pr — T-359 — PR #360 — ronda 3

**Fecha:** 2026-10-15 · **HEAD de autor inspeccionado:** `19439be7962e8f1b8cde4b02c910f7bbfd717577` · **Base develop:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b`

**Resultado: CON BLOQUEANTES.** 3 defectos/persistencias de cobertura E2E H05, R01 y R02; observación de evidencia H07. Sin pruebas ejecutadas por el revisor en su contenedor (no hay clone ni pnpm); se comparó el código con la ficha y logs de CI. No hay decisión humana adicional.

## Apertura y alcance

- Se leyeron `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, ficha T-359 **desde develop**, comentarios, bitácora y diferencias de `c6506df` a HEAD. Compare: dos commits de asako669 tras ronda 2; únicamente cuatro archivos tocados y permitidos.
- Resto de la PR ya incorporaba la carpeta de revisión; en los dos commits nuevos el autor **no la tocó**.
- No hay divergencia conocida frente a develop según PR (base `14c28ed`, mergeable=true). No se corrió `git merge-tree` en shell (sin clon).
- Decisión B de terminales sigue correctamente implementada por inspección; no reabrir.

## Arreglos de ronda 2 — juicio específico

### H02 · arreglado-sin-verificar

Se confirmó guard cliente `isReconciling` en render de botón, `handleOpenAcceptModal` y `handleConfirmAccept`, activado inmediatamente antes de `router.refresh()` para `ALREADY_MATCHED` y `REQUEST_EXPIRED`. Esta solución cierra la ventana de repetición visible sin tocar RPCs. Test unitario comprueba 0 botones y acción original contada 1 vez; **su título dice 'segundo click' pero no realiza un segundo click**, por lo que esa parte no está probada literalmente. No lo transformamos en bloqueante funcional sin un caso real; completar control si se toca el test.

### R01 · parcial (riesgo específico restante)

Ahora `expect.poll` aguarda que **alguna** página termine en `/trips/{id}` antes de asignar `winnerPage`, lo que corrige el problema de lectura demasiado temprana. Pero esa URL **no identifica al ganador real de la RPC**: la perdedora llama `router.refresh()` y puede redirigirse al mismo `/trips/{id}`. Que una página sea la primera en navegar no dice qué oferta fue aceptada; `winnerPage` puede ser la sesión perdedora. Separar actor rechazado del actor ganador mediante banner `ALREADY_MATCHED` capturado antes de navegar, o asociando las ofertas precargadas a `acceptedOfferId` del oráculo. No aumentar timeouts ni usar `waitForTimeout`.

### H07 · parcial (documental)

La bitácora ahora incluye **un comando y dos líneas RED+GREEN plausibles para H02**, y el CI confirma GREEN posterior de unit. Sin embargo no se conservan logs/SHAs de los RED históricos declarados para otras pruebas de H01/H06, y no se re-ejecutaron mutaciones por el revisor. Anotar lo no preservado como tal; demostrar sólo RED nuevas efectivamente reproducidas en memoria, jamás fabricar resultados.

## H05 · ALTO — E2E no termina de ejercer DoD

**`e2e/specs/main-flow.spec.ts`:** el test tiene dos contextos, un oracle DB fuerte (`acceptedCount===1`, `matchedWinner`), nuevo chequeo de cero botones en perdedor y `formatArs` + enlace WhatsApp. Pero *no comprueba identidad del repartidor ganador* aun teniendo `inspection.offers[].courierId` y `stagingContext.courierUsers[].displayName`, tampoco **medio de pago** de la vista, ni relación del enlace WhatsApp con `courierUsers[].phone`. El `if (winningOffer)` silenciosamente omite la aserción del dinero si es null, en vez de fallar; es un control condicional innecesario después de que DB comprobó acceptedCount=1.

**Arreglo:** hacer `expect(winningOffer).toBeDefined()` y `if (!winningOffer) throw`; mapear `courierUsers.find(x=>x.id===winningOffer.courierId)`, afirmar nombre visible como heading, monto, método del fixture, enlace exacto de contacto (sólo si courierPhone realmente sembrado; fixtures lo proveen) y privacidad prematch (reutilizar prueba existente). Mantener control de DB y cleanup.

**E2E Preview**: en check runs del SHA no se encontró job `e2e-preview`; Vercel Preview Ready no basta. Dejar DoD correspondiente `[ ]` y documentar bloqueo. No disparar workflows manualmente ni alterar CI.

## R02 · ALTO — Test contradice el historial real de `router.replace`

**`e2e/specs/main-flow.spec.ts`: líneas 226–235.** `BasePage.goto` llama `page.goto('/merchant/requests/id')`, después la aceptación ejecuta `router.replace('/trips/id')`: `replace` **sustituye la entrada actual** en history pero deja entradas anteriores (login, dashboard). `page.goBack()` puede navegar a una de esas entradas; exigir `toHaveURL(/trips/id/)` inmediatamente después es una afirmación contraria al contrato del navegador y puede fallar aunque el producto cumpla el DoD. Además el test hace `reload()` después de Back y por eso asume una URL equivocada para esa recarga. Hallazgo derivado por semántica de navegación; Playwright Preview sin ejecutar.

**Arreglo:** en la ganadora, hacer `reload()` mientras sigue en `/trips/id`, verificar viaje/identidad/monto y cero Aceptar; **después** `goBack()` y esperar a que la navegación termine. Si vuelve a dashboard/login, no exigir `/trips` sino ausencia de selector y coherencia; si vuelve a `/merchant/requests/id`, esperar redirección server a `/trips/id` y cero Aceptar. Finalmente `page.goto('/merchant/requests/id')` y comprobar redirección canónica a viaje. El oráculo es «no oferta aceptable tras match», **no** «Back permanece en trip». Para probar regresión del guard, mutar de manera controlada en el flujo aprobado `e2e-mutation` cuando exista; no alterar RPC ni deploy inseguro.

## CI del SHA inspeccionado

| Check | Estado comprobado |
|---|---|
| unit | PASS: 130 suites, 2180 Vitest, 79 workflows, 6 ADR |
| typecheck/lint/build/audit/bundle-budget | PASS en GitHub Actions |
| db-tests | PASS: Files=22 Tests=2205 Result PASS (sin levantar Supabase local) |
| e2e-preview | NO CONSTA; check específico ausente |
| approval-policy | FAIL: requiere aprobación vigente de Lautaro073; no es fallo técnico del build. **No solicitarla hasta cerrar bloqueantes** |
| Mutaciones independientes del revisor | NO EJECUTADAS: sin checkout/pnpm en esta sesión |

## No tocar / cierre

Fuera de alcance: backend/RPC/SQL, src/domain, src/ui, .github, .agents, dependencias, secrets, tests adulterados. El autor sólo corrige E2E y evidencia si corresponde. No aprobar ni mergear. Prompt completo para agy en el mismo comentario de cierre de ronda 3.
