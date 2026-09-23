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

---

# Ronda 3 — `d100c3a`

Todo en un worktree detached, para no tocar el árbol que comparte el agy:

```bash
git worktree add --detach ../cadeApp-rev58 d100c3a
pnpm install --frozen-lockfile     # exit 0 · 27,5 s
# ... probes y checks ...
git worktree remove --force ../cadeApp-rev58
```

## H14 · La remediación, medida

```bash
pnpm audit --audit-level=high
```

```
2 vulnerabilities found
Severity: 2 moderate
exit=0
```

Contra la ronda 2: `25 vulnerabilities · 2 low | 13 moderate | 8 high (8 ignored) | 2 critical (2 ignored)`.

```bash
node -e "const p=require('./package.json'); console.log(p.dependencies.next, JSON.stringify(p.pnpm))"
```

```
15.5.26 {"overrides":{"glob":"10.5.0","handlebars":"4.7.9","postcss":"8.5.28","vite":"6.4.3"}}
```

`pnpm.auditConfig.ignoreGhsas` ya no existe.

### El job `audit` ahora es bloqueante, y por culpa de este PR

El `if` del workflow pide `src/domain/rpc-contracts.ts`, que este PR crea:

```bash
gh run view --job <audit> --log | grep -E "vulnerabilities|Severity|no bloquea"
```

```
2 vulnerabilities found
Severity: 2 moderate
```

No aparece el `Aviso: audit no bloquea antes de contracts-v1`, o sea que corrió la rama estricta.

## Probe de ronda 3 — los siete contracasos de la ronda 2, más uno

```bash
npx vitest run src/domain/review-pr58-r3-probe.test.ts
npx tsc --noEmit          # el probe también se tipa
```

```
✓ setForcedError rechaza un código que no pertenece a publish_request
✓ accept_offer rechaza una oferta cuyo courier no existe
✓ admin_verify_document devuelve NOT_FOUND y no un TypeError si falta el courier
✓ report_no_show sobre matched sin acceptedOfferId no devuelve un output inválido
✓ report_incident rechaza una solicitud draft
✓ report_incident produce INCIDENT_WINDOW_EXPIRED pasadas las 24 h de delivered
✓ una oferta sembrada con el primer ID de la secuencia sobrevive a submit_offer
✓ package.json no ignora avisos de seguridad
Tests  8 passed (8)
```

En la ronda 2, los siete primeros **pasaban demostrando el defecto**.

### Y tres correcciones del propio probe

La primera corrida dio 2 fallos que eran míos:

```
× admin_verify_document … → expected undefined to be 'NOT_FOUND'
× report_incident …       → expected undefined to be 'INCIDENT_WINDOW_EXPIRED'
```

`ActionFailure` expone `code`, no `error` (`errors.ts:55-58`). Corregido, quedó uno:

```
× admin_verify_document … → expected 'VALIDATION_ERROR' to be 'NOT_FOUND'
```

que tampoco era del fake: el campo de entrada es `decision`, no `status`, así que fallaba la
validación de input y nunca llegaba al handler —que sí tiene su guarda en `rpc-fake.ts:979`—.
Y `tsc --noEmit` sobre el probe encontró un tercero:

```
review-pr58-r3-probe.test.ts(68,56): error TS2353: 'reason' does not exist in type
  '{ requestId: string; republish?: boolean | undefined; }'
```

`report_no_show` no toma `reason`: ese test estaba pasando por el motivo equivocado. Con las tres
corregidas, 8/8 y `tsc` limpio.

## H15 · La mejora no bloqueante de la ronda 2

```
✓ clave invalida emite INVALID_SETTING_KEY y no el generico
✓ valor invalido emite INVALID_SETTING_VALUE y no el generico
✓ una clave valida con valor valido sigue funcionando
Tests  3 passed (3)
```

## Los ocho `!` de la ronda 2

```bash
grep -cE '[a-zA-Z0-9_)\]]![.\[]' src/domain/testing/rpc-fake.ts
```

```
0
```

Con `pnpm typecheck` en 0 y `strict`, eso significa que las guardas son reales.

```bash
for pat in ': any' 'as any' '@ts-ignore' '.only(' '.skip('; do ...; done
```

Cero ocurrencias de cada uno: cumple `AGENTS.md` §4.

## Checks completos

```bash
pnpm typecheck      # exit 0
pnpm lint           # exit 0
pnpm test           # 98 Vitest (11 archivos) · 19 workflows · 6 ADR
pnpm test:coverage  # exit 0 — domain 100 % · states 93,91 % ramas · rpc-fake 91,1 % ramas
pnpm build          # exit 0 — First Load JS 103 kB / 180 kB
npx prettier --check <archivos tocados>   # All matched files use Prettier code style!
```

```bash
gh pr checks 58     # 8 de 8
gh run view --job <db-tests> --log | grep -E "Tests=|Result:"
```

```
Files=3, Tests=98,  0 wallclock secs
Result: PASS
```

## Alcance

```bash
gh pr diff 58 --name-only    # 21 archivos
```

Los 21 caen dentro de «Archivos permitidos» de `docs/tasks/T-006.md`, que incluye las ampliaciones
autorizadas en las rondas 1 y 2 (`vitest.config.ts`, `package.json`, `pnpm-lock.yaml`,
`src/server/supabase/server.ts`, `tools/verify-build-boundaries.test.ts`). **0 fuera de alcance.**

El worktree se borró y el probe se retiró: ningún archivo del repositorio quedó modificado por la
revisión.
