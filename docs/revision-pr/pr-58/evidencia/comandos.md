# Evidencia reproducible · PR #58 · ronda 1

Todo se ejecutó en `C:\Users\El Yisus Pai\Desktop\Proyectos\cadeApp-rev58`, worktree detached en `afe3631f46d450cdfdd128f73b46ccee56b02b76`. Los archivos de probe fueron temporales y se retiraron antes de escribir la revisión.

## Estado, alcance y PR

```powershell
git rev-parse HEAD
git status --short -- docs/revision-pr
gh pr diff 58 --name-only
gh pr view 58 --json comments,headRefOid,baseRefOid,statusCheckRollup
```

Resultado: 10 archivos, todos dentro del alcance original de T-006; ningún comentario previo; SHA `afe3631…`.

## Checks locales

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
git diff --check
```

- `typecheck`: exit 0.
- `lint`: exit 0 en la corrida final. Una corrida paralela coincidió con un fixture temporal de `verify-build-boundaries`; no fue un fallo del PR y se reejecutó secuencialmente.
- `test`: 94 Vitest + 19 workflows + 6 ADR, exit 0.
- cobertura real sin mutación: branches `states` 98,3 %, `rpc-fake` 90,21 %, demás archivos de dominio 100 %.

## CI leído por contenido

```powershell
gh run view 35799143714 --log
```

En `db-tests`, pese a pulls transitorios con `toomanyrequests`, la ejecución llegó a:

```text
Files=3, Tests=98
Result: PASS
```

`audit` terminó exit 1 con 50 vulnerabilidades: 4 low, 23 moderate, 18 high y 5 critical.

## Probe de autorización, schemas y fake

Se creó temporalmente `src/domain/review-pr58-probe.test.ts` y se ejecutó:

```powershell
pnpm vitest run src/domain/review-pr58-probe.test.ts
```

Primer barrido: **6/6 PASS**, demostrando que hoy se aceptan estos comportamientos que deben rechazarse:

```ts
expect(transitionRequest({ from: 'draft', to: 'published', actor: 'merchant', pilotActive: true }).ok).toBe(true);
expect(transitionRequest({ from: 'published', to: 'matched', actor: 'merchant' }).ok).toBe(true);
expect(transitionRequest({ from: 'matched', to: 'in_transit', actor: 'courier' }).ok).toBe(true);

expect(calculateRouteDistanceInputSchema.safeParse({ pickupLat: -27.6 }).success).toBe(true);
expect(adminUpdateSettingInputSchema.safeParse({ key: 'pilot_active', value: 1 }).success).toBe(true);
expect(publishRequestOutputSchema.safeParse({ /* salida válida salvo */ publishedAt: 'not-a-date' }).success).toBe(true);
```

También compiló una implementación de `publish_request` que devolvía `AAL2_REQUIRED`, probando el ensanchamiento de H05.

El mismo probe puso `initialActor: { role: null }`, armó inputs válidos y recorrió **las 13 RPC no administrativas**; las 13 devolvieron `ok: true`. Con actor del rol correcto y UUID ausente, **10 RPC de solicitud/oferta** también devolvieron éxito. Dos actores courier recibieron exactamente el mismo `offerId` fijo.

Segundo barrido: **4/4 PASS**:

```ts
// Las cuatro rutas que requieren motivo devuelven el genérico.
expect(result).toEqual(expect.objectContaining({ ok: false, code: 'VALIDATION_ERROR' }));

expect(calculateHaversineRouteDistanceM(point, point)).toBe(500);

const fake = createFakeRpcClient();
expect((await fake.submit_offer({ requestId, amountArs: 999 })).ok).toBe(false);
expect((await fake.submit_offer({ requestId, amountArs: 1000 })).ok).toBe(true);

expect(err('VALIDATION_ERROR', 'detalle interno')).toEqual({
  ok: false,
  code: 'VALIDATION_ERROR',
  message: 'detalle interno',
});
```

## Mutación del umbral de cobertura

1. Se movieron fuera del camino los artefactos de cobertura anteriores.
2. Se agregó temporalmente un módulo exportado con ramas superiores no ejecutadas.
3. Se ejecutó `pnpm test:coverage` desde estado limpio.

Resultado:

```text
src/domain   branches 38.77%
All files    branches 75.29%
Process exit code: 0
```

Después se restauraron las fuentes con `apply_patch`, se retiraron únicamente los directorios temporales de cobertura y `git status --short` volvió a quedar vacío. Esto demuestra H12 sin depender de inspección estática.

## Búsquedas de clase completa

```powershell
rg -n "isOwnerMerchant|isAssignedCourier" src/domain/states/index.ts
rg -n "create policy" supabase/migrations
rg -n "VALIDATION_ERROR|REASON_REQUIRED" src/domain/states src/domain/rpc-contracts.ts
rg -n "executeRpc\(|:\s*\(rawInput\)" src/domain/testing/rpc-fake.ts
rg -n "z\.string\(\)|paidUntil" src/domain/rpc-contracts.ts
rg -n "coverage-final|threshold" src/domain/domain.test.ts vitest.config.ts
```

No hay migraciones ni policies modificadas por PR #58. En dominio se recorrieron las 18 RPC y todas las transiciones antes de agrupar los hallazgos.

---

# Evidencia reproducible · PR #58 · ronda 2

Se ejecutó en `C:\Users\El Yisus Pai\Desktop\Proyectos\cadeApp-rev58-r2`, worktree detached en `ad630b98ac846a1b667bd4d37fb0d359b4f49deb`. Los dos archivos de prueba temporales fueron retirados antes de escribir y commitear la revisión.

## Inicio de ronda y alcance

```powershell
git status --short -- docs/revision-pr
gh pr view 58 --json comments,headRefOid,baseRefOid,statusCheckRollup
git show origin/develop:docs/tasks/T-006.md
gh pr diff 58 --name-only
git diff --stat origin/develop...HEAD
```

- SHA solicitado y revisado: `ad630b98ac846a1b667bd4d37fb0d359b4f49deb`.
- El cambio funcional está en `147ccf7fa1d1580ad578cf026d18d92633fe963c`; el último commit solo actualiza la bitácora.
- 18 archivos acumulados. `vitest.config.ts`, `package.json` y `pnpm-lock.yaml` estaban autorizados en ronda 1; en ronda 2 Lautaro073 autorizó además la actualización mayor de Next.js necesaria para salir de la rama sin soporte.

## Checks locales

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
pnpm audit --audit-level=high
```

Resultados:

```text
typecheck: exit 0
lint: exit 0
test: 11 files, 91 Vitest; 19 workflow; 6 ADR — exit 0
coverage: exit 0
  errors/index/priority/rpc-contracts/schemas: branches 100%
  states: branches 93.75%
  testing/rpc-fake: branches 90.08%
build: exit 0
audit: exit 0, pero 8 high (8 ignored) y 2 critical (2 ignored)
```

## Mutación independiente del threshold

Se agregó temporalmente `src/domain/review-threshold-probe.ts`, exportado desde el barrel, con funciones y ramas no cubiertas. Luego:

```powershell
pnpm test:coverage
```

Resultado esperado y observado: exit 1.

```text
ERROR Coverage for lines (25%) does not meet threshold (90%) for src/domain/review-threshold-probe.ts
ERROR Coverage for functions (0%) does not meet threshold (90%) for src/domain/review-threshold-probe.ts
ERROR Coverage for statements (25%) does not meet threshold (90%) for src/domain/review-threshold-probe.ts
```

El módulo y su export fueron eliminados. Una ejecución limpia volvió a pasar.

## Probe conductual de ronda 2

Se creó temporalmente `src/domain/review-pr58-r2-probe.test.ts` y se ejecutó:

```powershell
pnpm vitest run src/domain/review-pr58-r2-probe.test.ts
```

Resultado: **7 tests, 7 PASS**. Cada test afirma un comportamiento que el contrato debería rechazar:

```ts
fake.setForcedError('AAL2_REQUIRED');
expect(await fake.publish_request(validPublishInput)).toEqual({
  ok: false,
  code: 'AAL2_REQUIRED',
});

expect((await adminFake.admin_update_setting({ key: 'unknown', value: 1 })).code)
  .toBe('VALIDATION_ERROR');
expect((await adminFake.admin_update_setting({ key: 'pilot_active', value: 1 })).code)
  .toBe('VALIDATION_ERROR');

expect((await merchantFake.accept_offer({ offerId: orphanOfferId })).ok).toBe(true);

await expect(
  adminFake.admin_verify_document({ documentId: orphanDocumentId, decision: 'verified' })
).rejects.toBeInstanceOf(TypeError);

const noShow = await merchantFake.report_no_show({ requestId: matchedWithoutOfferId });
expect(noShow.ok).toBe(true);
expect(reportNoShowOutputSchema.safeParse(noShow.ok ? noShow.data : null).success).toBe(false);

expect((await merchantFake.report_incident({ requestId: draftRequestId, kind: 'other', description: 'x' })).ok)
  .toBe(true);

expect((await courierFake.submit_offer(validOfferInput)).data.offerId).toBe(seedOfferId);
expect(courierFake.getOffer(seedOfferId)?.courierId).toBe(newCourierId);
```

El probe fue eliminado después de guardar la salida:

```text
✓ src/domain/review-pr58-r2-probe.test.ts (7 tests)
Test Files  1 passed (1)
Tests       7 passed (7)
```

## Clase completa recorrida

```powershell
rg -n "isOwnerMerchant|isAssignedCourier" src/domain/states/index.ts
rg -n "executeRpc\(|ALLOWED_ROLES_BY_RPC|outputSchema" src/domain/testing/rpc-fake.ts src/domain/rpc-contracts.ts
rg -n "!;|acceptedOfferId!" src/domain/testing/rpc-fake.ts
rg -n "INCIDENT_WINDOW_EXPIRED|INVALID_SETTING" src/domain docs/master-plan.md
rg -n "create policy" supabase/migrations
```

- Ocho guardas protegidas enumeradas.
- Dieciocho RPC recorridas por actor, input, recurso, preestado, output y códigos.
- Ocho non-null assertions enumerados en el fake.
- `report_incident` cruzado contra Master Plan §5.1: viaje activo y ventana posterior de 24 h.
- Sin migraciones o policies RLS nuevas en el diff.

## CI leído por contenido

```powershell
gh run view 35803906079 --log |
  Select-String -Pattern 'Files=|Tests=|Result:|toomanyrequests|supabase start'
```

El arranque recibió varios `toomanyrequests: Rate exceeded`, reintentó y finalmente ejecutó pgTAP:

```text
Files=3, Tests=98
Result: PASS
```

Por eso `db-tests` no es un falso verde en este SHA, aunque la dependencia de pulls anónimos siga siendo frágil.

## Audit y decisión humana

```powershell
pnpm audit --audit-level=high
```

El comando sale 0 porque `package.json:66-78` contiene diez `ignoreGhsas`. La salida todavía declara:

```text
Severity: 2 low | 13 moderate | 8 high (8 ignored) | 2 critical (2 ignored)
```

Se cruzaron los IDs con las advisories primarias de GitHub y la política de soporte de Next.js. Lautaro073 autorizó actualizar a una versión soportada y parcheada, como mínimo 15.5.24. No se considera H14 verificado en `ad630b9`.
