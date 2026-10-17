# Evidencia y comandos PR #360 — ronda 2

**HEAD leído:** aacf8291fdb331da53b94fa7471679b2792f5ecf. Revisor no tiene clone/pnpm ni red git hacia github.com; no se corrieron tests locales ni E2E ni mutaciones. Fuente: conector GitHub y logs de CI, no supabase remoto.

- Unit job 116235162530: `Test Files 130 passed (130)` y `Tests 2179 passed (2179)`; workflow checks 79 passed, ADR 6 passed.
- db-tests job 116235162614: `Files=22, Tests=2205, Result: PASS`; el check incluye `git diff --exit-code -- src/types/database.types.ts`.
- `e2e-preview` ausente entre los 13 check-runs del SHA. `approval-policy` rojo. Vercel Ready no es E2E.

## Comandos baseline para runner con repositorio

```bash
git fetch origin
git status --porcelain
git merge-tree --write-tree origin/develop HEAD > /tmp/pr360-merge-tree.txt
pnpm exec vitest run 'src/features/requests/components/request-offers.test.tsx' 'src/app/(merchant)/merchant/requests/[id]/page.test.tsx' > /tmp/pr360-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr360-unit.log | tail -4
pnpm typecheck > /tmp/pr360-tsc.log 2>&1
pnpm lint > /tmp/pr360-lint.log 2>&1
pnpm test > /tmp/pr360-full.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr360-full.log | tail -4
```

## Harness independiente completo: guardar bytes en memoria, nunca checkout

El test normal debe dar GREEN primero; un ancla faltante es SIN OBJETIVO (error del instrumento), no RED. No se ejecutó este script. Reproducir en worktree limpio con dependencias instaladas.

```bash
cat > /tmp/pr360_r2_mutaciones.py <<'PY'
from pathlib import Path
import subprocess, re, sys
root = Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip())
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): sys.exit('ABORT: árbol sucio')
def test(file):
    r = subprocess.run(['pnpm','exec','vitest','run',file],cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    summ = ' | '.join(s.strip() for s in r.stdout.splitlines() if 'Test Files' in s or re.search(r'\bTests\s+',s))
    return r.returncode,summ,r.stdout
cases=[
 ('terminal','src/app/(merchant)/merchant/requests/[id]/page.tsx',"request.status === 'cancelled' || request.status === 'expired'","request.status === 'cancelled'",'src/app/(merchant)/merchant/requests/[id]/page.test.tsx'),
 ('expiracion','src/features/requests/components/request-offers-list.tsx',"request.status === 'published' && !isExpired","request.status === 'published' && isExpired",'src/features/requests/components/request-offers.test.tsx'),
 ('replace','src/features/requests/components/request-offers-list.tsx','router.replace(`/trips/${request.id}`)','router.refresh()','src/features/requests/components/request-offers.test.tsx'),
 ('refresh-ya-asignada','src/features/requests/components/request-offers-list.tsx',"notify.error('Esta solicitud ya fue asignada a otro repartidor.');\n          setSelectedOffer(null);\n          router.refresh();","notify.error('Esta solicitud ya fue asignada a otro repartidor.');\n          setSelectedOffer(null);",'src/features/requests/components/request-offers.test.tsx'),
]
failed=[]
for name,path,needle,replacement,spec in cases:
    rc,summary,_ = test(spec)
    print(name,'GREEN baseline',rc,summary)
    if rc: failed.append(name+': baseline roja'); continue
    p=root/path
    before=p.read_bytes()
    content=before.decode('utf-8')
    if content.count(needle)!=1: failed.append(name+': SIN OBJETIVO'); continue
    try:
        p.write_bytes(content.replace(needle,replacement,1).encode('utf-8'))
        rc,summary,output=test(spec)
        red = rc!=0 and ('AssertionError' in output or re.search(r'\bexpected\b',output,re.I))
        print(name,'RED mutado',rc,bool(red),summary)
        if not red: failed.append(name+': mutación no detectada')
    finally: p.write_bytes(before)
    rc,summary,_=test(spec)
    print(name,'GREEN restaurado',rc,summary)
    if rc: failed.append(name+': no restauró GREEN')
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): failed.append('árbol sucio')
if failed: sys.exit('FALLOS: '+'; '.join(failed))
print('Mutaciones de producción detectadas')
PY
python3 /tmp/pr360_r2_mutaciones.py | tee /tmp/pr360-r2-mutations.log
```

**Pendiente para arreglo H02:** mutar además el nuevo latch de reconciliación (quitarlo del render y handlers), demostrar RED del test que verifica que Aceptar permanece oculto durante router.refresh, restaurar y GREEN. No atribuir esa mutación a este SHA porque no existe el latch.

## Preview sin producción

Playwright E2E de 2 sesiones, oráculo DB real, contacto prematch/postmatch, monto/pago, retroceso y refresh, sin cambiar fixtures para forzar verde. Capturar SHA, run, job y resultado `e2e-preview`; nunca ejecutar Docker ni Supabase local, ni disparar workflows manualmente.

```bash
node docs/revision-pr/analizar.mjs verificacion
git diff --check
git ls-remote origin feat/T-359-detalle-merchant-post-aceptacion
```

**Nada de lo anterior se presenta como ejecutado por el revisor.**

## Ronda 3 — 19439be7962e8f1b8cde4b02c910f7bbfd717577 (2026-10-15)

**Observado por el revisor sin ejecutar:** compare con ronda 2: sólo 4 archivos de implementación/test/bitácora modificados, todos dentro de ficha. Unit CI PASS (130/130, 2180 Vitest, 79 workflow, 6 ADR), db-tests PASS (Files=22 Tests=2205), lint/typecheck/build/audit/bundle PASS. approval-policy FAIL porque requiere aprobación vigente de Lautaro073. NO existe e2e-preview en check runs de este SHA. No se descargaron secretos ni se lanzó ningún workflow.

### Control independiente propuesto — producción mutada en memoria (NO ejecutado)

Se mantiene el harness de ronda 2 y se agrega este caso específico H02. La mutación debe partir de control GREEN y restaurar bytes en finally; el RED válido debe ser AssertionError de test real, NO falta de import ni SIN OBJETIVO.

```bash
cat >/tmp/pr360-r3-latch.py <<'PY'
from pathlib import Path
import subprocess, sys, re
root=Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip())
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): sys.exit('ABORT: árbol sucio')
file=root/'src/features/requests/components/request-offers-list.tsx'
testfile='src/features/requests/components/request-offers.test.tsx'
def run():
    p=subprocess.run(['pnpm','exec','vitest','run',testfile],cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    lines=[x.strip() for x in p.stdout.splitlines() if 'Test Files' in x or re.search(r'\bTests\s+',x)]
    return p.returncode,'; '.join(lines[-3:]),p.stdout
code,summary,_=run(); print('BASELINE',code,summary)
if code: sys.exit('SIN GREEN inicial')
before=file.read_bytes()
codeText=before.decode('utf-8')
old="request.status === 'published' && !isExpired && !isReconciling"
new="request.status === 'published' && !isExpired"
if codeText.count(old)!=1: sys.exit('SIN OBJETIVO: el código cambió, ajustar el control antes de evaluar')
try:
    file.write_bytes(codeText.replace(old,new,1).encode('utf-8'))
    code,summary,log=run()
    red=code!=0 and ('AssertionError' in log or re.search(r'\bexpected\b',log,re.I))
    print('MUTACION',code,'ASSERT_RED',bool(red),summary)
    if not red: sys.exit('No detectada: no contar como mutación roja')
finally:
    file.write_bytes(before)
code,summary,_=run(); print('RESTORED',code,summary)
if code: sys.exit('No regresó a GREEN')
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): sys.exit('Árbol sucio tras restauración')
print('CONTROL H02 DETECTADO')
PY
python3 /tmp/pr360-r3-latch.py | tee /tmp/pr360-r3-latch.log
```

### E2E — casos a verificar en Preview

Usar fixture existente de dos sesiones y `getRequestInspectionData`: acceptedOfferId único, correo de comercio en contextos separados, aceptación/concurrencia, loser determinado por error ALREADY_MATCHED o IDs aceptados, contacto/name del courier y monto/medio de pago. En la página viaje hacer **reload antes de goBack**, luego Back puede llevar a dashboard/login anterior (válido) pero nunca al selector activo. Tras Back navegar directo a `/merchant/requests/{id}` y exigir redirección a `/trips/{id}`. Registrar run/commit exactos del E2E de Preview. No hacer mutation E2E sin `e2e-mutation` aprobada.

### Comandos reproducibles finales para worktree limpio

```bash
git fetch origin
git merge-tree --write-tree origin/develop HEAD > /tmp/pr360-r3-merge-tree.txt
pnpm exec vitest run 'src/features/requests/components/request-offers.test.tsx' > /tmp/pr360-r3-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr360-r3-unit.log | tail -3
node docs/revision-pr/analizar.mjs verificacion
git diff --check
```

Estos comandos no fueron ejecutados en la sesión del revisor; el entorno carece de clone/pnpm. No se declaran mutaciones verificadas.

## Ronda 5 — inspección del SHA e1e7e53ee1c50bdfa89468132ff5194d6b781860 (2026-10-15)

- `compare efb22c421..e1e7e53ee1c50bdfa89468132ff5194d6b781860`: 1 commit, 1 archivo modificado `docs/tasks/log/T-359.md` (25+ / 1-). Ningún archivo de app, CI o E2E tocado.
- Check-runs GitHub: `unit` job 116253582996 SUCCESS; `db-tests` 116253583040 SUCCESS; typecheck/lint/build/audit/bundle-budget SUCCESS; approval-policy 116253579354 FAILURE; ningún `e2e-preview`.
- Log db-tests job 116253583040: `Files=22, Tests=2205`, `Result: PASS`.
- Log unit job 116253582996: `Test Files 130 passed (130)`; 79 workflows pass; 6 ADR pass. El cuerpo del PR declara 2180 tests Vitest, coherente con el job en verde.
- E2E dispatch `38683340222` (resolve job 116252553470) y `38683340102` (resolve job 116252552770): `resolve-preview success`, `e2e-preview skipped`, `report-preview-status skipped`, texto literal `El deployment no pertenece al proyecto Vercel de develop.`
- Runs adicionales `38683699875`, `38683734389`, `38683748905`, `38683868520`, `38684013129` muestran el mismo descarte, confirmados con logs de resolve; no se atribuye al código de la PR.
- `.github/workflows/e2e-preview-target.mjs` desde develop: `matchPreview` compara `payload.project.id` con `VERCEL_PROJECT_ID` del Environment develop, requiere PR abierta contra develop con SHA exacto y gate de duplicados.
- Vercel lectura: proyectos distintos `cadeapp-staging` y `cadeapp-develop`; ambos tienen deployment READY para `e1e7e53ee1c50bdfa89468132ff5194d6b781860` (ID del proyecto/deploy no se pega porque no es necesario). `get_webhooks` para develop devolvió 403 Forbidden; no se pudo acreditar configuración.
- No se ejecutó E2E/mutación local por el revisor. No se modificaron los workflows/secretos/entornos remotos.
- Reproducir una vez que webhook del proyecto develop esté validado: comprobar que run resolve declara `PR interna #360 contra develop`, que `needs.resolve.outputs.run=true`, que E2E Playwright pasa, y que `report-preview-status` publica `e2e-preview=success` en el SHA exacto.

## Ronda 6 — 2026-10-15 — HEAD ceb1161b07f1419992e764bbe17db9a28ea2fc2e

**Fuente real del RED:** https://github.com/cadeApp/cadeApp/actions/runs/38694202782, job https://github.com/cadeApp/cadeApp/actions/runs/38694202782/job/116286928820, `Run preview E2E gate`, SHA objetivo registrado por commit status `e2e-preview=failure`.

Resumen textual real de Playwright:
```
1 failed
  [chromium] › e2e/specs/main-flow.spec.ts:89:7 › ... › DoD: Aceptación concurrente en dos sesiones independientes navega a /trips/[id] y converge
75 passed (21.1m)
Error: expect.toBeVisible: Error: strict mode violation: getByText('$ 1.500') resolved to 2 elements
1) <span class="shrink-0 font-display text-lg font-bold text-foreground">$ 1.500</span>
2) <div class="rounded-lg border border-border/50 bg-background/80 p-2.5 text-sm italic text-muted-foreground">"Hola! Tu pedido va en camino con ...</div>
e2e/specs/main-flow.spec.ts:248:78
```
Hubo retries que fallaron con el mismo tipo de strict mode (valores $ 1.500 y $ 2.000). El test pudo ejecutar sus asserts previos a línea 248, no los posteriores. No concluir que WhatsApp, Back y reload están validados. La bitácora propia todavía no consigna este RED.

**Comparación de DOM en SHA inspeccionado:** `src/features/trips/components/trip-merchant-view.tsx` tiene `<Card><CardHeader><h2>Repartidor asignado</h2></CardHeader><CardContent>...<span>{formatArs(trip.amountArs)}</span>...</CardContent></Card>` y otra Card de "Avisale a tu cliente" con `dropCustomerMsg` (`src/lib/whatsapp.ts` lo construye incluyendo costo de envío). `getByText` amplio coincide con ambos.

**Causa exacta del RED** es demostrada por Playwright. **No se ejecutó mutación independiente ni Playwright local**: no hay clon/pnpm en este entorno. No inventar un comando verde.

**Alcance del merge previo:** `ceb1161b` tiene dos padres: `235559ec` y `cba78a29`. El E2E T-359 y T-360 coexisten, en tests merchant conviven T-359/T-364, y el source merchant-requests-list de develop ya tiene ruta /trips y acción de cancelar. `develop` volvió a avanzar a `3b9f4090`: esos cambios son otras rutas y schemas, sin conflicto demostrado; requiere revalidar el merge-tree antes del merge final.

**CI del HEAD:** `unit` SUCCESS: 132 suites Vitest, 79 workflow y 6 ADR; `db-tests` SUCCESS: `Files=22 Tests=2205 Result: PASS` (el job ejecutó otros checks de mutación RED/GREEN de CC-024, no confundir con evidencia T-359); `typecheck/lint/build/audit/bundle-budget` SUCCESS. `approval-policy` FAIL por aprobación vigente pendiente. `e2e-preview` commit status `failure`.

**Reproducción pedida al autor**: reemplazar SOLO selector amplio en las DOS aserciones de monto del spec (antes y después de reload). Seleccionar la Card usando el heading h2 `Repartidor asignado` y los dos niveles padre `locator('..').locator('..')`, dentro de ella `getByText(formatArs(acceptedOffer.amountArs), {exact:true})`, con `toHaveCount(1)` y `toBeVisible()`. Sin `first`, `nth`, temporizadores, fake DOM ni cambio de UI. Ejecutar test completo sobre Preview real del nuevo SHA, conservar el RED original y anotar GREEN si sucede.

No se ejecutó `git merge-tree` ni `pnpm` desde clon local; la PR figuraba `mergeable:true` y develop se movió desde la última sincronización, por lo que no se declara rebase completo.

## Ronda 7 — 2026-10-16 — SHA 6d2c4337

- Cambios exactos: compare `52549ad7...6d2c4337`, commits `ada6ee57` (locator) y `6d2c4337` (bitácora). Archivos: e2e/specs/main-flow.spec.ts, docs/tasks/log/T-359.md.
- RED anterior: https://github.com/cadeApp/cadeApp/actions/runs/38694202782: 75 passed / 1 failed, strict mode monto con 2 elementos.
- GREEN: https://github.com/cadeApp/cadeApp/actions/runs/38945199224, job 117122539233, 76 passed Chromium (19.2m), 3 passed global-settings (58.6s), caso dos sesiones en 33.9s. Reporter dejó estado `e2e-preview=success` contra 6d2c4337.
- CI: https://github.com/cadeApp/cadeApp/actions/runs/38945110606; unit job 117122154992, `Test Files 136 passed (136)`, `Tests 2435 passed (2435)`, verify-workflows 79/79, verify-adr 6/6. db-tests job 117122155366, `Files=26, Tests=2341, Result: PASS`. Mutaciones RED dentro del job DB son de otras tareas; no contarlas en T-359.
- Approval-policy: https://github.com/cadeApp/cadeApp/actions/runs/38946219097, aprobación de Lautaro073 vigente para SHA 6d2c4337.
- Desfase: develop af0cf1d7 vs base integrada cba78a29 = 36 commits nuevos, cambios de main-flow.spec.ts, TripMerchantView, whatsapp y CC-025/026/027/028. GitHub mergeable=true. No corrí merge-tree de clon ni E2E combinado contra develop nuevo.
- No se ejecutó pnpm ni mutaciones independientes en el entorno revisor por carencia de checkout/git remoto; verificado_en_sha = null.

## Ronda 8 — 2026-10-16 — HEAD inspeccionado fc5b0a0152b48c7d6716b3b0a0c975746e504ebc

- Merge padre `1c8182edff7f9ae95f6458785c29da090e559ea4`: dos padres `cb9b7848d9a072a83e2737c3acdd50a41e7e3e25` (PR T-359) y `af0cf1d72e9e33524cde5db138d940fee33ce6f6` (develop). HEAD posterior `fc5b0a01` solo documentó la integración en `docs/tasks/log/T-359.md`. No se detectó edición del autor en `docs/revision-pr/pr-360/**` ni cambio manual de contratos/código productivo.
- La prueba `e2e/specs/main-flow.spec.ts` mantiene el caso de dos sesiones en línea 89 y `acceptedAmount` delimitado por `courierCard`, con `toHaveCount(1)` y `toBeVisible()` tanto antes como después de reload; conserva T-360 y agregó aserciones de WhatsApp de develop en otra sección. Por inspección, sin ejecución Playwright actual.
- GitHub CI HEAD `fc5b0a01`: run [38950890801](https://github.com/cadeApp/cadeApp/actions/runs/38950890801). Job `unit` 117141673496: `Test Files 136 passed (136)`, `Tests 2435 passed (2435)`, verify-workflows 79/79 y ADR 6/6. Job `db-tests` 117141673428: resultado final `Files=26, Tests=2341, Result: PASS` (los RED intermedios son mutaciones intencionales de otras tareas; no se cuentan como fallas finales). Typecheck/lint/build/audit/bundle-budget SUCCESS. Approval-policy [38963478649](https://github.com/cadeApp/cadeApp/actions/runs/38963478649) SUCCESS con `Aprobación de Lautaro073 vigente.`
- Gate Preview confiable [run 38951040659](https://github.com/cadeApp/cadeApp/actions/runs/38951040659), SHA destino `fc5b0a01`, deployment `dpl_DNFzKhhKF3MQZQ8FHeA3UKm9N229`: `resolve-preview` reconoció `PR interna #360 contra develop` y `Preview listo para E2E`. Intentos 1, 2, 3: respectivos jobs `117142273870`, `117176406615`, `117184161515` => `cancelled`, cada uno con **0 pasos**. Los reportes publicaron `e2e-preview=error`; **NO se ejecutó el Playwright**. No atribuir causa exacta sin logs de scheduler. El grupo `cadeapp-develop-e2e` tiene `cancel-in-progress:false` y no configura FIFO; T-327/#205 decisión 5-A aceptó explícitamente la limitación de 1 running + 1 pending con posibles reemplazos y re-run. Es una posible explicación, no prueba del motivo de cada cancelación.
- Comparación HEAD feature vs develop más reciente observado `01054b148e9c11eda1358e591abc6e0b82a5af94`: sólo un commit adicional en develop posterior a base mergeada, cambios de administración/onboarding/repartidor; no conflicto directo demostrado con T-359; REST GitHub `mergeable:true`. No se corrió merge-tree local; aquí no hay clon. No inventar verificación de esa combinación.
- RED original [38694202782](https://github.com/cadeApp/cadeApp/actions/runs/38694202782) y GREEN original [38945199224](https://github.com/cadeApp/cadeApp/actions/runs/38945199224) son de commits **anteriores**. Exigir un E2E real GREEN nuevo contra commit HEAD/final; no marcar DoD completo.
- No se ejecutaron PNPM local, mutaciones independientes ni Docker/Supabase local desde el revisor. `verificado_en_sha` permanece NULL.

## Ronda 9 — 2026-10-17 — SHA c4eb0c4b864c966e5306ff9daa2a0d454cbaea44

**E2E Preview ejecutado realmente:** [run 38965095162](https://github.com/cadeApp/cadeApp/actions/runs/38965095162), attempt 4, job 117270529209, Vercel Preview de cadeapp-develop `dpl_Dm5rgpnFSTzUaSSgQJv4yBUM1pZo`. `resolve-preview` identificó PR #360; Playwright ejecutó `Running 79 tests using 1 worker`; resumen final `1 failed` (T-359 dos sesiones), `1 flaky` (T-360 feed: primer intento timeout de login en `e2e/pages/login.page.ts:64`, retry #1 pasó), `77 passed (26.0m)`. `Process completed with exit code 1`; commit status `e2e-preview=failure` (no CANCELLED). El bloqueante T-359 en `e2e/specs/main-flow.spec.ts:257`: `getByText(/Medio de pago:\s*Efectivo/i)` => `Expected visible`, `Received element(s) not found`, timeout 10000 ms. Reproducido también en `retry #1` y `retry #2` sin variar causa.

**Inspección de fuente:** `src/features/trips/components/trip-merchant-view.tsx` construye `coordinationMessage` con `trip.recipientPaymentMethod` (`buildTripCoordinationWhatsAppMessage`, `src/lib/whatsapp.ts`) pero en la Card `Repartidor asignado` sólo muestra precio, avatar/nombre, vehículo, WhatsApp y Llamar; no hay etiqueta de pago en el resto del componente. El aviso textual a destinatario `buildNotifyCustomerWhatsAppMessage` usa ahora texto natural por estado en T-361 **sin importe ni pago** (intencional por privacidad). El antiguo E2E usaba incidentalmente ese texto antes del refactor: fallo de cobertura que el revisor de rondas previas no detectó.

**Multidrop:** `TripDetails` tiene `recipientPaymentMethod` pero `TripDrop` posee cada uno `recipientPaymentMethod`; fixture multiDropTrip en `src/features/trips/components.test.tsx` incluye entregas cash y transfer. UI global única sería ambigua o incorrecta si los medios difieren. Existe formatter `formatRecipientPaymentMethod` en `src/features/trips/format.ts` con cash=Efectivo, transfer=Transferencia, to_agree=A coordinar. **No se agregó ni sugirió reintroducir pago al mensaje al cliente.**

**CI:** check-runs de SHA `c4eb0c4b`: unit/db-tests/build/typecheck/lint/audit/bundle-budget SUCCESS; approval-policy SUCCESS con aprobación del usuario. La CI principal no valida directamente la presencia del dato en el DOM. E2E sí la reclamó. No inventar mutaciones, ejecución de pnpm local ni resultados de test posteriores al arreglo.

**Base:** develop observado `cf65ce256f8fb45a9d9bc890f4531b1ae03cbea6` avanzó tras la última integración de develop `af0cf1d7`. GitHub indica PR `mergeable:true`; no afirmar que la integración de los nuevos cambios quedó comprobada. **Limitaciones:** sin checkout/pnpm/mutaciones independientes del revisor. A y C requieren autorización de cambio visual de P1, B ajusta test pero deja DoD visual parcialmente insatisfecho. `src/features/trips/components.test.tsx` queda fuera de archivos permitidos en ficha T-359; si se autoriza C, primero extender ficha de forma explícita para permitir esa prueba de componente, sin ampliar a otras áreas.

## Ronda 10 — 2026-10-17 · HEAD `8d5f6a840a2f56b468672698a3ed225e8c937592`

### Origen y alcance

- PR #391 mergeada a develop como `50c99b00`, ficha canónica `docs/tasks/T-359.md` permite `src/features/trips/components.test.tsx` para T-359 opción C. Merge normal en rama de autor: `7daacd6866cab8c19398c4b3570d72d2c762d87b`. Commit funcional `8c90e4b787baa8f8d843f29a3c49e3b01a1d4378` cambia EXCLUSIVAMENTE `trip-merchant-view.tsx`, `components.test.tsx`, `main-flow.spec.ts` y bitácora. HEAD `8d5f6a840a2f56b468672698a3ed225e8c937592` solo añade bitácora. Se revisaron todos los archivos modificados funcionalmente.
- Inspección: el componente usa `singleDrop = dropsList.length === 1 ? dropsList[0] : null`; single muestra `formatRecipientPaymentMethod(singleDrop.recipientPaymentMethod)` en Card de repartidor; multi lo muestra en cada Card de destinatario con `drop.recipientPaymentMethod`. No se modificó `src/lib/whatsapp.ts`. Unit tests `within(card)` y `within(cardAna/cardBeto/cardCarla)` separan métodos cash/transfer/to_agree y validan privacidad. E2E reusa locator `paymentLabel` anclado en `courierCard` antes y después de reload, sin eliminar oráculos ni test T-360.

### Evidencia remota real

- Autor declara RED unit: 3 failed/42 passed previo a UI; GREEN unit: 45/45 y 3 mutantes locales detectados. **El revisor NO reprodujo el RED de Vitest ni corrió los mutantes en Vitest; no se atribuye.**
- [CI del SHA funcional 8c90e4b7, run 39011124764](https://github.com/cadeApp/cadeApp/actions/runs/39011124764) JOBS unit/typecheck/lint/build/db-tests/audit/bundle-budget = SUCCESS. No confundirlo con ejecución local.
- [E2E real del SHA funcional 8c90e4b7, run 39011178930](https://github.com/cadeApp/cadeApp/actions/runs/39011178930), job `117333894466`, `81 passed (19.1m), 1 failed` en Chromium. T-359 dos sesiones `main-flow.spec.ts:89` PASS (31.2s), T-360 feed PASS (40.8s). El único FAIL reproducido en el intento y dos retries fue T-366 `request-states.spec.ts:1013`: `getByRole('button', {name:/aceptar/i})` no encuentra elemento, aunque `getByText('Expirada')` sí es visible. `global-settings` no se certifica GREEN en este run fallido. El HEAD `8d5f6a84` es posterior, con solo bitácora; su nuevo E2E estaba pendiente al consultar.
- Inspección T-366: en la fixture `status:'published'` con `expiresAt` 10 minutos atrás, E2E exige botón Aceptar visible en #1013 y luego prueba rechazo RPC `REQUEST_EXPIRED`. Ficha T-366 desde develop exige que **ofertas vencidas no puedan aceptarse**. Fuente `request-offers-list.tsx`: `isAcceptableStatus = request.status === 'published' && !isExpired && !isReconciling`; test T-359 H03 espera `toHaveLength(0)` en vencidas. El E2E de T-366 requiere lo contrario; la expectativa no prueba el DoD.
- GitHub PR HEAD `8d5f6a840a2f56b468672698a3ed225e8c937592` `mergeable:true`; base develop `256ae179dcba9f9e0f5d54f236c93b42ec41281c`. No se confirmaron conflictos. La aprobación `approval-policy` pasó en HEAD inspeccionado, no es el E2E.

### Controles y mutaciones ESTÁTICAS independientes (no Vitest)

Se ejecutaron dentro del proceso de revisión con los cinco archivos de fuente recibidos por GitHub (sin checkout ni modificar repo). **7/7 controles textuales base PASS; 4/4 mutaciones sobre copias en memoria detectadas**: (M1) cambiar drop propio a pago global single, (M2) pago global en multi, (M3) borrar asserts postreload, (M4) hacer selector Playwright global. Los controles verifican PATRONES de fuente: no ejecutan componentes React, Vitest ni Playwright y no sustituyen una batería de mutaciones runtime en worktree. No marcar `verificado_en_sha` por esta sola prueba.

Reproducible orientativo, sin ejecutar el archivo guardado desde checkout (revisor no tiene clon):

```js
// Inspector estático de PR #360 ronda 10; ejecutar desde raíz de worktree limpio (no modifica archivos).
// Este script comprueba SOLO patrones de fuente, NO corre Vitest ni Playwright.
import { readFileSync } from 'node:fs';
const sources = {
  ui:readFileSync('src/features/trips/components/trip-merchant-view.tsx','utf8'),
  tests:readFileSync('src/features/trips/components.test.tsx','utf8'),
  e2e:readFileSync('e2e/specs/main-flow.spec.ts','utf8'),
  req:readFileSync('e2e/specs/request-states.spec.ts','utf8'),
  offers:readFileSync('src/features/requests/components/request-offers-list.tsx','utf8'),
};
const controls=[
  ['single real drop',s=>s.ui.includes('formatRecipientPaymentMethod(singleDrop.recipientPaymentMethod)')&&s.ui.includes('const singleDrop = dropsList.length === 1 ? dropsList[0] : null;')],
  ['multi real drop',s=>s.ui.includes('formatRecipientPaymentMethod(drop.recipientPaymentMethod)')&&s.ui.includes('{dropsList.length > 1 && (')],
  ['single coverage all',s=>["method: 'cash'","method: 'transfer'","method: 'to_agree'","within(card)"].every(t=>s.tests.includes(t))],
  ['heterogeneous scoped',s=>['within(cardAna)','within(cardBeto)','within(cardCarla)'].every(t=>s.tests.includes(t))&&s.tests.includes("recipientPaymentMethod: 'transfer'")&&s.tests.includes("recipientPaymentMethod: 'to_agree'")],
  ['e2e scoped + reload',s=>s.e2e.includes('const paymentLabel = courierCard.getByText(/Medio de pago:\\s*Efectivo/i)')&&(s.e2e.match(/expect\(paymentLabel\)\.toHaveCount\(1\)/g)||[]).length===2&&(s.e2e.match(/expect\(paymentLabel\)\.toBeVisible\(\)/g)||[]).length===2],
  ['expired action hidden',s=>s.offers.includes("request.status === 'published' && !isExpired && !isReconciling")&&s.offers.includes("{isAcceptableStatus && (!offer.status || offer.status === 'pending') ? (")],
  ['T366 expectation incompatible',s=>s.req.includes("await expect(page.getByRole('button', { name: /aceptar/i })).toBeVisible({ timeout: 10000 });")]
];
const changes=[
  ['M1 use global for single','single real drop',s=>({...s,ui:s.ui.replace('formatRecipientPaymentMethod(singleDrop.recipientPaymentMethod)','formatRecipientPaymentMethod(trip.recipientPaymentMethod)')})],
  ['M2 use global for multi','multi real drop',s=>({...s,ui:s.ui.replace('formatRecipientPaymentMethod(drop.recipientPaymentMethod)','formatRecipientPaymentMethod(trip.recipientPaymentMethod)')})],
  ['M3 remove postreload checks','e2e scoped + reload',s=>({...s,e2e:s.e2e.replace('await expect(paymentLabel).toHaveCount(1);\n      await expect(paymentLabel).toBeVisible();\n      await expect(winnerPage.getByRole(\'button\'','await expect(winnerPage.getByRole(\'button\'')})],
  ['M4 unscoped E2E payment','e2e scoped + reload',s=>({...s,e2e:s.e2e.replace('const paymentLabel = courierCard.getByText(/Medio de pago:\\s*Efectivo/i)','const paymentLabel = winnerPage.getByText(/Medio de pago:\\s*Efectivo/i)')})]
];
for(const [name,fn] of controls){const ok=fn(sources);console.log('BASE',ok?'PASS':'FAIL',name);if(!ok)process.exitCode=1;}
for(const [name,target,mutate] of changes){const fn=controls.find(c=>c[0]===target)?.[1];if(!fn)throw Error(target);const detected=fn(sources)&&!fn(mutate(sources));console.log('STATIC MUTATION',detected?'DETECTED':'MISSED',name);if(!detected)process.exitCode=1;}
```

### Pendiente

P1 debe decidir si: A) botón Aceptar visible pero deshabilitado con test corregido para estado disabled; B) visible habilitado y RPC rechaza (no recomendado por UX); C) conservar ocultación y corregir el E2E T-366 en PR separada. Recomendación C: `await expect(page.getByRole('button',{name:/^aceptar$/i})).toHaveCount(0)`, manteniendo `expectRpcFailure(..., 'REQUEST_EXPIRED')`. Como `request-states.spec.ts` NO está entre los archivos permitidos de T-359, no autorizar que agy lo edite en #360 sin resolución formal. Sí está permitido en ficha T-366; se puede usar una PR específica T-366 desde develop tras elección P1. No se editó producto ni CI. No aprobar ni mergear.
