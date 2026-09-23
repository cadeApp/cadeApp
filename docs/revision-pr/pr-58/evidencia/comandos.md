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
